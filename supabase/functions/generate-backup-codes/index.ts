import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { hashBackupCode } from '../_shared/twofa-crypto.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { count = 10 } = await req.json();
    const admin = getServiceClient();

    // Generate backup codes
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }

    // Store only hashed backup codes; the plaintext is returned once below.
    await admin.from('dkai_backup_codes').delete().eq('user_id', user.id);

    const codeEntries = await Promise.all(
      codes.map(async (code) => ({
        user_id: user.id,
        code_hash: await hashBackupCode(code),
        used: false,
      })),
    );

    await admin.from('dkai_backup_codes').insert(codeEntries);

    return jsonResponse({ success: true, codes });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
