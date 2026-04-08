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

async function generateTOTPCode(secret: string, timeCounter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  const timeBytes = new Uint8Array(8);
  let counter = timeCounter;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw', secretBytes.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
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

async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  if (!secret || !token || token.length !== 6) return false;
  const currentTime = Math.floor(Date.now() / 1000 / 30);
  // Wider window (±2 = ±60 seconds) to account for clock skew
  for (let i = -2; i <= 2; i++) {
    const expectedCode = await generateTOTPCode(secret, currentTime + i);
    if (expectedCode === token) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { secret, code, recoveryKey } = await req.json();

    if (!secret || !code) {
      return jsonResponse({ success: false, error: 'Secret and code required' });
    }

    // Verify TOTP code SERVER-SIDE before storing the secret
    const isValid = await verifyTOTP(secret, code);
    if (!isValid) {
      return jsonResponse({ success: false, error: 'Invalid verification code' });
    }

    const admin = getServiceClient();

    // Store in dkai_user_2fa table
    await admin.from('dkai_user_2fa').upsert({
      user_id: user.id,
      totp_secret: secret,
      is_enabled: true,
      recovery_key: recoveryKey || null,
      enabled_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Update dkai_profiles
    await admin.from('dkai_profiles').upsert({
      id: user.id,
      is_2fa_enabled: true,
      two_fa_secret: secret,
    }, { onConflict: 'id' });

    return jsonResponse({ success: true });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
