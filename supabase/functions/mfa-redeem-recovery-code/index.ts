import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { hashRecoveryCode } from '../_shared/recovery-codes.ts';

const MAX_FAILS = 5;
const LOCKOUT_MINUTES = 5;

/**
 * Redeems a one-time recovery code. On success the code is marked used and the
 * account's TOTP factors are removed, so the holder can sign in and re-enroll.
 */
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { code } = await req.json();
    if (typeof code !== 'string' || code.trim().length < 8) {
      return jsonResponse({ success: false, error: 'Invalid recovery code format.' }, 400);
    }

    const admin = getServiceClient();

    // Server-side brute-force protection.
    const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const { count: failCount } = await admin
      .from('dkai_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action', 'mfa_recovery_redeem')
      .gte('created_at', windowStart);

    if ((failCount ?? 0) >= MAX_FAILS) {
      return jsonResponse(
        {
          success: false,
          error: `Too many attempts. Please wait ${LOCKOUT_MINUTES} minutes before trying again.`,
        },
        429,
      );
    }

    const hash = await hashRecoveryCode(code);

    const { data: match, error: selError } = await admin
      .from('dkai_mfa_recovery_codes')
      .select('id, used_at')
      .eq('user_id', user.id)
      .eq('code_hash', hash)
      .is('used_at', null)
      .maybeSingle();

    if (selError) return jsonResponse({ success: false, error: selError.message }, 400);

    if (!match) {
      await admin
        .from('dkai_rate_limits')
        .insert({ user_id: user.id, action: 'mfa_recovery_redeem' });
      return jsonResponse({ success: false, error: 'Invalid or already used recovery code.' });
    }

    const { error: updError } = await admin
      .from('dkai_mfa_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', match.id)
      .is('used_at', null);
    if (updError) return jsonResponse({ success: false, error: updError.message }, 400);

    // Remove TOTP factors so the user regains access and must re-enroll.
    const { data: factorList, error: listError } = await (admin.auth.admin as any).mfa.listFactors({
      userId: user.id,
    });
    if (listError) return jsonResponse({ success: false, error: listError.message }, 400);

    for (const factor of factorList?.factors ?? []) {
      await (admin.auth.admin as any).mfa.deleteFactor({ userId: user.id, id: factor.id });
    }

    await admin
      .from('dkai_rate_limits')
      .delete()
      .eq('user_id', user.id)
      .eq('action', 'mfa_recovery_redeem');

    return jsonResponse({ success: true, reenrollRequired: true });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
