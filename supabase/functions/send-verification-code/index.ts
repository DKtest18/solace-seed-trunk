import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const admin = getServiceClient();

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Store code in database
    await admin.from('dkai_verification_codes').upsert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
      verified: false,
    }, { onConflict: 'user_id' });

    // Send email via Supabase Auth or email service
    // For now, log the code (in production, send via email service)
    console.log(`Verification code for ${user.email}: ${code}`);

    // Try sending via Resend if configured
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'DK AI Marketplace <noreply@dkai.market>',
          to: user.email,
          subject: 'Your Verification Code',
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
        }),
      });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
