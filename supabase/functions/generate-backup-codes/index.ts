import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

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

    // Store hashed backup codes
    await admin.from('dkai_backup_codes').delete().eq('user_id', user.id);

    const codeEntries = codes.map(code => ({
      user_id: user.id,
      code_hash: code, // In production, hash these
      used: false,
    }));

    await admin.from('dkai_backup_codes').insert(codeEntries);

    return jsonResponse({ success: true, codes });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
