import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const EMAIL_TYPES = [
  'verification',
  'password_reset',
  'magic_link',
  'reauthentication',
  'invitation',
  'email_change',
] as const;

type EmailType = typeof EMAIL_TYPES[number];

interface EmailRequest {
  type: EmailType;
  email?: string;        // target email (for invitation / unauthenticated flows)
  redirectUrl?: string;   // where to redirect after action
  metadata?: Record<string, string>; // extra data for templates
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return errorResponse('Email service not configured', 500);

    const body: EmailRequest = await req.json();
    const { type, email: targetEmail, redirectUrl, metadata } = body;

    if (!type || !EMAIL_TYPES.includes(type)) {
      return errorResponse(`Invalid email type. Must be one of: ${EMAIL_TYPES.join(', ')}`, 400);
    }

    // Some types require auth, some don't (e.g. password_reset by email)
    const requiresAuth = !['password_reset', 'magic_link'].includes(type);
    let userId: string | null = null;
    let userEmail: string | null = targetEmail || null;

    if (requiresAuth) {
      const { user, error } = await getAuthenticatedUser(req);
      if (error || !user) return errorResponse('Unauthorized', 401);
      userId = user.id;
      userEmail = targetEmail || user.email;
    }

    if (!userEmail) return errorResponse('Email address is required', 400);

    const admin = getServiceClient();

    // Generate secure token/code
    const code = generateSecureCode();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    // Store token in database
    await admin.from('dkai_email_tokens').upsert({
      token,
      code,
      email: userEmail,
      user_id: userId,
      type,
      expires_at: expiresAt,
      used: false,
    }, { onConflict: 'token' });

    // Build email content
    const { subject, html } = buildEmailContent(type, { code, token, redirectUrl, metadata, email: userEmail });

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DK AI Marketplace <noreply@dkaimarketplace.com>',
        to: userEmail,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return errorResponse('Failed to send email', 500);
    }

    return jsonResponse({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('send-auth-email error:', err);
    return errorResponse(err.message, 500);
  }
});

function generateSecureCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

function buildEmailContent(
  type: EmailType,
  ctx: { code: string; token: string; redirectUrl?: string; metadata?: Record<string, string>; email: string }
): { subject: string; html: string } {
  const baseUrl = ctx.redirectUrl || 'https://dkaimarketplace.com';
  const styles = {
    container: 'font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #ffffff;',
    heading: 'color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 16px;',
    text: 'color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 16px;',
    code: 'display: inline-block; background: #f3f4f6; color: #111827; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px; font-family: monospace;',
    button: 'display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;',
    footer: 'color: #9ca3af; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;',
  };

  const wrap = (content: string) => `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f9fafb;">
      <div style="${styles.container}">
        <div style="text-align:center;margin-bottom:32px;">
          <h2 style="color:#2563eb;font-size:20px;font-weight:800;">DK AI Marketplace</h2>
        </div>
        ${content}
        <div style="${styles.footer}">
          <p>This email was sent by DK AI Marketplace. If you didn't request this, you can safely ignore it.</p>
          <p>&copy; ${new Date().getFullYear()} DK AI Marketplace. All rights reserved.</p>
        </div>
      </div>
    </body></html>`;

  switch (type) {
    case 'verification':
      return {
        subject: 'Verify your email – DK AI Marketplace',
        html: wrap(`
          <h1 style="${styles.heading}">Verify Your Email</h1>
          <p style="${styles.text}">Welcome to DK AI Marketplace! Use the code below to verify your email address:</p>
          <div style="text-align:center;margin:32px 0;">
            <span style="${styles.code}">${ctx.code}</span>
          </div>
          <p style="${styles.text}">This code expires in 15 minutes.</p>
        `),
      };

    case 'password_reset':
      return {
        subject: 'Reset your password – DK AI Marketplace',
        html: wrap(`
          <h1 style="${styles.heading}">Reset Your Password</h1>
          <p style="${styles.text}">We received a request to reset your password. Use the code below:</p>
          <div style="text-align:center;margin:32px 0;">
            <span style="${styles.code}">${ctx.code}</span>
          </div>
          <p style="${styles.text}">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
        `),
      };

    case 'magic_link':
      return {
        subject: 'Your sign-in link – DK AI Marketplace',
        html: wrap(`
          <h1 style="${styles.heading}">Sign In to DK AI Marketplace</h1>
          <p style="${styles.text}">Click the button below to sign in:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${baseUrl}/auth/verify?token=${ctx.token}&type=magic_link" style="${styles.button}">Sign In</a>
          </div>
          <p style="${styles.text}">Or use this code: <strong>${ctx.code}</strong></p>
          <p style="${styles.text}">This link expires in 15 minutes.</p>
        `),
      };

    case 'reauthentication':
      return {
        subject: 'Your security code – DK AI Marketplace',
        html: wrap(`
          <h1 style="${styles.heading}">Security Verification</h1>
          <p style="${styles.text}">A sensitive action was requested on your account. Use this code to confirm:</p>
          <div style="text-align:center;margin:32px 0;">
            <span style="${styles.code}">${ctx.code}</span>
          </div>
          <p style="${styles.text}">This code expires in 15 minutes. If you didn't request this, please secure your account immediately.</p>
        `),
      };

    case 'invitation':
      return {
        subject: `You're invited to DK AI Marketplace`,
        html: wrap(`
          <h1 style="${styles.heading}">You've Been Invited!</h1>
          <p style="${styles.text}">${ctx.metadata?.inviterName || 'Someone'} has invited you to join DK AI Marketplace.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${baseUrl}/invite?token=${ctx.token}" style="${styles.button}">Accept Invitation</a>
          </div>
          <p style="${styles.text}">This invitation expires in 15 minutes.</p>
        `),
      };

    case 'email_change':
      return {
        subject: 'Confirm your new email – DK AI Marketplace',
        html: wrap(`
          <h1 style="${styles.heading}">Confirm Email Change</h1>
          <p style="${styles.text}">You requested to change your email address. Use this code to confirm:</p>
          <div style="text-align:center;margin:32px 0;">
            <span style="${styles.code}">${ctx.code}</span>
          </div>
          <p style="${styles.text}">This code expires in 15 minutes. If you didn't request this, please secure your account.</p>
        `),
      };
  }
}
