import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// Base32 decode
function base32Decode(secret: string): Uint8Array {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32Chars.indexOf(cleanSecret[i]);
    if (val === -1) throw new Error('Invalid Base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

// Generate TOTP code for a given time counter
async function generateTOTPCode(secret: string, timeCounter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  const timeBytes = new Uint8Array(8);
  let counter = timeCounter;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBytes);
  const hash = new Uint8Array(signature);
  const offset = hash[hash.length - 1] & 0xf;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

// Verify TOTP with ±1 window
async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  if (!secret || !token || token.length !== 6) return false;
  const currentTime = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    const expectedCode = await generateTOTPCode(secret, currentTime + i);
    if (expectedCode === token) return true;
  }
  return false;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { code } = await req.json();
    if (!code || code.length !== 6) {
      return jsonResponse({ valid: false, error: 'Invalid code format' });
    }

    const admin = getServiceClient();

    // --- Rate Limiting: check recent failed attempts ---
    const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const { count: failCount } = await admin
      .from('dkai_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action', '2fa_verify')
      .gte('created_at', windowStart);

    if ((failCount ?? 0) >= MAX_ATTEMPTS) {
      return jsonResponse({
        valid: false,
        error: `Too many attempts. Please wait ${LOCKOUT_MINUTES} minutes before trying again.`,
        locked: true,
      }, 429);
    }

    // Fetch secret SERVER-SIDE only — never sent to client
    const { data: twoFAData } = await admin
      .from('dkai_user_2fa')
      .select('totp_secret, is_enabled')
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .single();

    let isValid = false;

    if (!twoFAData?.totp_secret) {
      // Fallback: check profiles table (legacy)
      const { data: profile } = await admin
        .from('profiles')
        .select('two_fa_secret, is_2fa_enabled')
        .eq('id', user.id)
        .single();

      if (!profile?.two_fa_secret || !profile?.is_2fa_enabled) {
        return jsonResponse({ valid: false, error: '2FA not enabled' });
      }

      isValid = await verifyTOTP(profile.two_fa_secret, code);
    } else {
      isValid = await verifyTOTP(twoFAData.totp_secret, code);
    }

    if (!isValid) {
      // Record failed attempt
      await admin.from('dkai_rate_limits').insert({
        user_id: user.id,
        action: '2fa_verify',
      });

      const remaining = MAX_ATTEMPTS - ((failCount ?? 0) + 1);
      return jsonResponse({
        valid: false,
        error: remaining > 0
          ? `Invalid code. ${remaining} attempt(s) remaining.`
          : `Too many attempts. Please wait ${LOCKOUT_MINUTES} minutes.`,
        remaining,
      });
    }

    // Success — clear failed attempts for this user/action
    await admin
      .from('dkai_rate_limits')
      .delete()
      .eq('user_id', user.id)
      .eq('action', '2fa_verify');

    return jsonResponse({ valid: true });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
