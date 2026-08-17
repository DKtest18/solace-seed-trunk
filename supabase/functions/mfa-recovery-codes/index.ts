import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { hashRecoveryCode, randomRecoveryCode } from '../_shared/recovery-codes.ts';

/**
 * Issues one-time MFA recovery codes. Plaintext is returned exactly once in the
 * response; only salted SHA-256 hashes are ever persisted.
 * body: { count?: number } | { action: 'clear' }
 */
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json().catch(() => ({}));
    const admin = getServiceClient();

    if (body?.action === 'clear') {
      const { error: delError } = await admin
        .from('dkai_mfa_recovery_codes')
        .delete()
        .eq('user_id', user.id);
      if (delError) return jsonResponse({ success: false, error: delError.message }, 400);
      return jsonResponse({ success: true });
    }

    const count = Math.min(Math.max(Number(body?.count ?? 8) || 8, 1), 16);

    const codes = Array.from({ length: count }, () => randomRecoveryCode());
    const rows = await Promise.all(
      codes.map(async (code) => ({
        user_id: user.id,
        code_hash: await hashRecoveryCode(code),
      })),
    );

    // Regenerating replaces any previous set.
    const { error: delError } = await admin
      .from('dkai_mfa_recovery_codes')
      .delete()
      .eq('user_id', user.id);
    if (delError) return jsonResponse({ success: false, error: delError.message }, 400);

    const { error: insError } = await admin.from('dkai_mfa_recovery_codes').insert(rows);
    if (insError) return jsonResponse({ success: false, error: insError.message }, 400);

    return jsonResponse({ success: true, codes });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
