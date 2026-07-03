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
  email?: string;
  redirectUrl?: string;
  metadata?: Record<string, string>;
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

    // Basic shape validation on caller-provided email.
    if (typeof userEmail !== 'string' || userEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      return errorResponse('Invalid email address', 400);
    }

    const admin = getServiceClient();

    // Rate limiting for the unauthenticated types (password_reset, magic_link)
    // to prevent using this endpoint as an email-spam relay to arbitrary
    // inboxes. Max 3 requests per (email + type) per 10 minutes and max 10
    // requests per email per hour, tracked via dkai_email_tokens rows.
    if (!requiresAuth) {
      const nowMs = Date.now();
      const tenMinAgo = new Date(nowMs - 10 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(nowMs - 60 * 60 * 1000).toISOString();

      const { count: recentPerType } = await admin
        .from('dkai_email_tokens')
        .select('token', { count: 'exact', head: true })
        .eq('email', userEmail)
        .eq('type', type)
        .gte('created_at', tenMinAgo);
      if ((recentPerType ?? 0) >= 3) {
        return errorResponse('Too many requests. Please try again later.', 429);
      }

      const { count: recentPerEmail } = await admin
        .from('dkai_email_tokens')
        .select('token', { count: 'exact', head: true })
        .eq('email', userEmail)
        .gte('created_at', oneHourAgo);
      if ((recentPerEmail ?? 0) >= 10) {
        return errorResponse('Too many requests. Please try again later.', 429);
      }
    }


    const code = generateSecureCode();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await admin.from('dkai_email_tokens').upsert({
      token,
      code,
      email: userEmail,
      user_id: userId,
      type,
      expires_at: expiresAt,
      used: false,
    }, { onConflict: 'token' });

    const { subject, html } = buildEmailContent(type, { code, token, redirectUrl, metadata, email: userEmail });

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

// ── Branded email wrapper matching the Resend template design ──
function wrapEmail(content: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="width=device-width" name="viewport" />
    <link rel="preload" as="image" href="https://resend-attachments.s3.amazonaws.com/0d1471fa-d4e9-4798-9029-675292148f2a" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta content="IE=edge" http-equiv="X-UA-Compatible" />
    <meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection" />
  </head>
  <body style="margin:0;padding:0;">
    <table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center">
      <tbody><tr><td>
        <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"
          style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;font-size:1.0769230769230769em;min-height:100%;line-height:155%">
          <tbody><tr><td>
            <table align="left" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"
              style="align:left;width:100%;padding-left:0px;padding-right:0px;line-height:155%;max-width:600px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
              <tbody><tr><td>
                <p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><br /></p>
                <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                  <tbody style="width:100%"><tr style="width:100%">
                    <td align="left" data-id="__react-email-column">
                      <img alt="DK AI Marketplace logo displayed in elegant serif typography on a dark background." height="187"
                        src="https://resend-attachments.s3.amazonaws.com/0d1471fa-d4e9-4798-9029-675292148f2a"
                        style="display:block;outline:none;border:none;text-decoration:none;max-width:100%;border-radius:8px" width="249" />
                    </td>
                  </tr></tbody>
                </table>
                <p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><br /></p>
                ${content}
                <p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><br /></p>
              </td></tr></tbody>
            </table>
          </td></tr></tbody>
        </table>
      </td></tr></tbody>
    </table>
  </body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0;padding:0;font-size:2.25em;line-height:1.44em;padding-top:0.389em;font-weight:600"><span>${text}</span></h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><span>${text}</span></p>`;
}

function spacer(): string {
  return `<p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><br /></p>`;
}

function codeBlock(code: string): string {
  return `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
  <tbody><tr><td align="center">
    <span style="display:inline-block;background:#f3f4f6;color:#111827;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:8px;font-family:monospace;">${code}</span>
  </td></tr></tbody>
</table>`;
}

function buttonBlock(url: string, label: string): string {
  return `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
  <tbody><tr><td align="center">
    <a href="${url}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:16px;text-align:center;" target="_blank">${label}</a>
  </td></tr></tbody>
</table>`;
}

function footer(text: string): string {
  return `<p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><span style="color:rgb(153, 153, 153)"><span style="color:rgb(153, 153, 153);font-family:Inter, Arial, sans-serif;font-size:12px;font-style:normal;font-variant-ligatures:normal;font-variant-caps:normal;font-weight:400;letter-spacing:normal;orphans:2;text-align:start;text-indent:0px;text-transform:none;widows:2;word-spacing:0px;-webkit-text-stroke-width:0px;white-space:normal;background-color:rgb(255, 255, 255);text-decoration-thickness:initial;text-decoration-style:initial;text-decoration-color:initial;display:inline !important;float:none">${text}</span></span></p>`;
}

function brandLink(text: string): string {
  return `<strong><a href="https://dkaimarketplace.lovable.app/" rel="noopener noreferrer nofollow" style="color:#0670DB;text-decoration-line:none;text-decoration:underline" target="_blank">${text}</a></strong>`;
}

function buildEmailContent(
  type: EmailType,
  ctx: { code: string; token: string; redirectUrl?: string; metadata?: Record<string, string>; email: string }
): { subject: string; html: string } {
  const baseUrl = ctx.redirectUrl || 'https://dkaimarketplace.lovable.app';

  switch (type) {
    case 'verification':
      return {
        subject: 'Verify your email – DK AI Marketplace',
        html: wrapEmail([
          heading('Welcome aboard'),
          paragraph(`Thanks for signing up for ${brandLink('DK AI Marketplace')} — the ultimate marketplace for AI agents and software solutions.`),
          paragraph('Please confirm your email address by clicking the button below:'),
          spacer(),
          buttonBlock(`${baseUrl}/auth/verify?token=${ctx.token}&type=verification`, 'Confirm Email'),
          spacer(),
          spacer(),
          footer("If you didn't create an account, you can safely ignore this email."),
        ].join('')),
      };

    case 'password_reset':
      return {
        subject: 'Reset your password – DK AI Marketplace',
        html: wrapEmail([
          heading('Reset your password'),
          paragraph(`We received a request to reset the password for your ${brandLink('DK AI Marketplace')} account. Click the button below to set a new password:`),
          spacer(),
          buttonBlock(`${baseUrl}/auth/reset-password?token=${ctx.token}&type=password_reset`, 'Reset Password'),
          spacer(),
          paragraph('This link will expire in <strong>15 minutes</strong>. If you didn\'t request a password reset, you can safely ignore this email — your password will remain unchanged.'),
          spacer(),
          footer("If you didn't request a password reset, you can safely ignore this email."),
        ].join('')),
      };

    case 'magic_link':
      return {
        subject: 'Your sign-in link – DK AI Marketplace',
        html: wrapEmail([
          heading('Sign in to your account'),
          paragraph(`We received a sign-in request for your ${brandLink('DK AI Marketplace')} account. Click the button below to sign in instantly — no password needed.`),
          spacer(),
          buttonBlock(`${baseUrl}/auth/verify?token=${ctx.token}&type=magic_link`, 'Sign In'),
          spacer(),
          paragraph('This link will expire in <strong>15 minutes</strong>.'),
          spacer(),
          footer("If you didn't request this sign-in link, you can safely ignore this email."),
        ].join('')),
      };

    case 'reauthentication':
      return {
        subject: 'Your security code – DK AI Marketplace',
        html: wrapEmail([
          heading('Security Verification'),
          paragraph(`A sensitive action was requested on your ${brandLink('DK AI Marketplace')} account. Use the code below to confirm your identity:`),
          spacer(),
          codeBlock(ctx.code),
          spacer(),
          paragraph('This code will expire in <strong>15 minutes</strong>. If you didn\'t request this, please secure your account immediately.'),
          spacer(),
          footer("If you didn't initiate this action, please change your password and contact support."),
        ].join('')),
      };

    case 'invitation':
      return {
        subject: "You're invited to DK AI Marketplace",
        html: wrapEmail([
          heading('You have been invited'),
          paragraph(`${ctx.metadata?.inviterName || 'Someone'} has invited you to join ${brandLink('DK AI Marketplace')} — the ultimate marketplace for AI agents and software solutions.`),
          spacer(),
          buttonBlock(`${baseUrl}/invite?token=${ctx.token}`, 'Accept Invitation'),
          spacer(),
          paragraph('This invitation will expire in <strong>15 minutes</strong>.'),
          spacer(),
          footer("If you weren't expecting this invitation, you can safely ignore this email."),
        ].join('')),
      };

    case 'email_change':
      return {
        subject: 'Confirm your new email – DK AI Marketplace',
        html: wrapEmail([
          heading('Confirm your new email'),
          paragraph(`You requested to change the email address on your ${brandLink('DK AI Marketplace')} account. Use the code below to confirm this change:`),
          spacer(),
          codeBlock(ctx.code),
          spacer(),
          paragraph('This code will expire in <strong>15 minutes</strong>. If you didn\'t request this change, please secure your account immediately.'),
          spacer(),
          footer("If you didn't request an email change, you can safely ignore this email."),
        ].join('')),
      };
  }
}
