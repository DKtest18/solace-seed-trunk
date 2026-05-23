import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

const NOTIFICATION_TYPES = [
  'new_sale',
  'order_confirmation',
  'purchase_confirmation',
  'order_status_update',
  'meeting_created',
  'meeting_invitation',
  'dispute_opened',
  'dispute_resolved',
  'review_received',
  'payout_processed',
  'product_approved',
  'product_rejected',
  'account_suspension',
  'account_ban',
  'account_warning',
  'account_deactivation',
  'account_deletion',
  'sanction_lifted',
  'refund_requested',
  'refund_accepted',
  'refund_declined',
  'refund_completed',
  'waitlist_approved',
  'waitlist_declined',
] as const;

type NotificationType = typeof NOTIFICATION_TYPES[number];

interface NotificationEmailRequest {
  type: NotificationType;
  recipientEmail: string;
  data: Record<string, any>;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    // Invoked only by other trusted edge functions, which authenticate with
    // the service-role key. Reject any other (external) caller so this cannot
    // be used as an unauthenticated phishing/spam relay.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey || req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
      return errorResponse('Unauthorized', 401);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return errorResponse('Email service not configured', 500);

    const body: NotificationEmailRequest = await req.json();
    const { type, recipientEmail, data } = body;

    if (!type || !NOTIFICATION_TYPES.includes(type)) {
      return errorResponse(`Invalid notification type. Must be one of: ${NOTIFICATION_TYPES.join(', ')}`, 400);
    }

    if (!recipientEmail) return errorResponse('recipientEmail is required', 400);

    const { subject, html } = buildNotificationEmail(type, data);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DK AI Marketplace <noreply@dkaimarketplace.com>',
        to: recipientEmail,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return errorResponse('Failed to send email', 500);
    }

    return jsonResponse({ success: true, message: 'Notification email sent' });
  } catch (err) {
    console.error('send-notification-email error:', err);
    return errorResponse(err.message, 500);
  }
});

// ── Branded email wrapper ──
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

function h(text: string): string {
  return `<h1 style="margin:0;padding:0;font-size:2.25em;line-height:1.44em;padding-top:0.389em;font-weight:600"><span>${text}</span></h1>`;
}

function p(text: string): string {
  return `<p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><span>${text}</span></p>`;
}

function br(): string {
  return `<p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><br /></p>`;
}

function btn(url: string, label: string): string {
  return `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
  <tbody><tr><td align="center">
    <a href="${url}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:16px;text-align:center;" target="_blank">${label}</a>
  </td></tr></tbody>
</table>`;
}

function ft(text: string): string {
  return `<p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em"><span style="color:rgb(153, 153, 153)"><span style="color:rgb(153, 153, 153);font-family:Inter, Arial, sans-serif;font-size:12px;font-style:normal;font-variant-ligatures:normal;font-variant-caps:normal;font-weight:400;letter-spacing:normal;orphans:2;text-align:start;text-indent:0px;text-transform:none;widows:2;word-spacing:0px;-webkit-text-stroke-width:0px;white-space:normal;background-color:rgb(255, 255, 255);text-decoration-thickness:initial;text-decoration-style:initial;text-decoration-color:initial;display:inline !important;float:none">${text}</span></span></p>`;
}

function link(text: string): string {
  return `<strong><a href="https://dkaimarketplace.lovable.app/" rel="noopener noreferrer nofollow" style="color:#0670DB;text-decoration-line:none;text-decoration:underline" target="_blank">${text}</a></strong>`;
}

function infoRow(label: string, value: string): string {
  return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
    <span style="color:#6b7280;font-size:14px;min-width:120px;">${label}</span>
    <span style="font-weight:600;font-size:14px;">${value}</span>
  </div>`;
}

function infoBox(rows: string): string {
  return `<div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:8px 0;">${rows}</div>`;
}

function quoteBlock(label: string, text: string): string {
  return `<div style="background:#f9fafb;border-left:4px solid #2563eb;border-radius:4px;padding:16px 20px;margin:8px 0;">
    <p style="margin:0;padding:0;font-size:13px;color:#6b7280;font-weight:600;margin-bottom:8px;">${label}</p>
    <p style="margin:0;padding:0;font-size:14px;color:#111827;line-height:1.6;">${text}</p>
  </div>`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function buildNotificationEmail(
  type: NotificationType,
  data: Record<string, any>
): { subject: string; html: string } {
  const baseUrl = 'https://dkaimarketplace.lovable.app';

  switch (type) {
    // ── WAITLIST APPROVED ──
    case 'waitlist_approved': {
      const name = data.name || 'there';
      const actionUrl = data.actionUrl || 'https://dkaimarketplace.com';
      return {
        subject: "You're in — welcome to DK AI Marketplace",
        html: wrapEmail([
          h("You're in."),
          p(`Hi ${name},`),
          p(`Great news — your application to ${link('DK AI Marketplace')} has been approved. You now have full access to the platform.`),
          br(),
          p('You can browse the marketplace, list products as a seller, book meetings, and join the community.'),
          br(),
          btn(actionUrl, 'Enter the marketplace'),
          br(),
          ft('Welcome aboard. — The DK AI team'),
        ].join('')),
      };
    }

    // ── WAITLIST DECLINED ──
    case 'waitlist_declined': {
      const name = data.name || 'there';
      const reason = data.reason || 'No reason provided.';
      return {
        subject: 'Update on your DK AI Marketplace application',
        html: wrapEmail([
          h('Application update'),
          p(`Hi ${name},`),
          p(`Thank you for applying to ${link('DK AI Marketplace')}. After reviewing your application, we are unable to approve access at this time.`),
          br(),
          quoteBlock('Reason from our team', reason),
          br(),
          p('We appreciate your interest and wish you the best.'),
          br(),
          ft('— The DK AI team'),
        ].join('')),
      };
    }

    // ── NEW SALE (seller notification) ──
    case 'new_sale': {
      const productTitle = data.productTitle || 'Unknown Product';
      const price = Number(data.price) || 0;
      const platformFee = price * 0.1;
      const earnings = price - platformFee;
      const buyerName = data.buyerName || 'A buyer';
      const orderId = data.orderId || '';

      return {
        subject: `New sale: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('New Sale'),
          p(`Congratulations! <strong>${buyerName}</strong> has purchased your product on ${link('DK AI Marketplace')}.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Sale Price', formatCurrency(price)),
            infoRow('Marketplace Fee (10%)', `<span style="color:#dc2626;">- ${formatCurrency(platformFee)}</span>`),
            infoRow('Your Earnings', `<span style="color:#16a34a;font-weight:700;">${formatCurrency(earnings)}</span>`),
          ].join('')),
          br(),
          p('The payment is held in escrow until the buyer confirms receipt. You can view the order details in your seller dashboard.'),
          br(),
          btn(`${baseUrl}/seller-orders`, 'View Orders'),
          br(),
          ft(`Order ID: ${orderId}`),
        ].join('')),
      };
    }

    // ── ORDER CONFIRMATION (buyer notification) ──
    case 'order_confirmation': {
      const productTitle = data.productTitle || 'Unknown Product';
      const price = Number(data.price) || 0;
      const sellerName = data.sellerName || 'the seller';
      const orderId = data.orderId || '';

      return {
        subject: `Order confirmed: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Order Confirmed'),
          p(`Your order on ${link('DK AI Marketplace')} has been placed successfully.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Seller', sellerName),
            infoRow('Total Paid', formatCurrency(price)),
          ].join('')),
          br(),
          p('Your payment is held securely in escrow. Once you receive and confirm the delivery, the funds will be released to the seller.'),
          br(),
          btn(`${baseUrl}/purchases`, 'View Your Orders'),
          br(),
          ft(`Order ID: ${orderId}`),
        ].join('')),
      };
    }

    // ── PURCHASE CONFIRMATION (buyer – with payment method) ──
    case 'purchase_confirmation': {
      const productTitle = data.productTitle || 'Unknown Product';
      const price = Number(data.price) || 0;
      const sellerName = data.sellerName || 'the seller';
      const paymentMethod = data.paymentMethod || 'Card';
      const orderId = data.orderId || '';

      return {
        subject: `Purchase successful: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Purchase Successful'),
          p(`Thank you for your purchase on ${link('DK AI Marketplace')}. Here is a summary of your order:`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Seller', sellerName),
            infoRow('Total Paid', `<strong>${formatCurrency(price)}</strong>`),
            infoRow('Payment Method', paymentMethod),
          ].join('')),
          br(),
          p('Your payment is held securely in escrow. Once you receive and confirm the delivery, the funds will be released to the seller. You will have a 24-hour refund window after confirming receipt.'),
          br(),
          btn(`${baseUrl}/purchase-history`, 'View Your Orders'),
          br(),
          ft(`Order ID: ${orderId}. If you have any issues with your purchase, please contact support@dkaimarketplace.com.`),
        ].join('')),
      };
    }

    // ── ORDER STATUS UPDATE ──
    case 'order_status_update': {
      const productTitle = data.productTitle || 'Unknown Product';
      const status = data.status || 'updated';
      const orderId = data.orderId || '';

      return {
        subject: `Order ${status}: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Order Status Update'),
          p(`The status of your order on ${link('DK AI Marketplace')} has been updated.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('New Status', `<strong style="text-transform:capitalize;">${status}</strong>`),
          ].join('')),
          br(),
          btn(`${baseUrl}/purchases`, 'View Order Details'),
          br(),
          ft(`Order ID: ${orderId}`),
        ].join('')),
      };
    }

    // ── MEETING CREATED ──
    case 'meeting_created': {
      const meetingDate = data.meetingDate || 'Date TBD';
      const meetingTime = data.meetingTime || 'Time TBD';
      const duration = data.durationMinutes || 30;
      const participantName = data.participantName || 'A participant';

      return {
        subject: 'New meeting created – DK AI Marketplace',
        html: wrapEmail([
          h('New Meeting Created'),
          p(`A new meeting has been scheduled on ${link('DK AI Marketplace')}.`),
          br(),
          infoBox([
            infoRow('Date', meetingDate),
            infoRow('Time', meetingTime),
            infoRow('Duration', `${duration} minutes`),
            infoRow('Participant', participantName),
          ].join('')),
          br(),
          p('To view the Meeting ID and Meeting Code, join the meeting from your dashboard.'),
          br(),
          btn(`${baseUrl}/my-meetings`, 'View My Meetings'),
          br(),
          ft('Meeting details including ID and code are available in your meeting dashboard for security purposes.'),
        ].join('')),
      };
    }

    // ── MEETING INVITATION ──
    case 'meeting_invitation': {
      const inviterName = data.inviterName || 'Someone';
      const meetingDate = data.meetingDate || 'Date TBD';
      const meetingTime = data.meetingTime || 'Time TBD';
      const duration = data.durationMinutes || 30;
      const inviteLink = data.inviteLink || `${baseUrl}/meetings`;
      const message = data.message || '';

      return {
        subject: `Meeting invitation from ${inviterName} – DK AI Marketplace`,
        html: wrapEmail([
          h('Meeting Invitation'),
          p(`<strong>${inviterName}</strong> has invited you to a meeting on ${link('DK AI Marketplace')}.`),
          br(),
          infoBox([
            infoRow('Date', meetingDate),
            infoRow('Time', meetingTime),
            infoRow('Duration', `${duration} minutes`),
            infoRow('Invited by', inviterName),
          ].join('')),
          ...(message ? [br(), p(`Message from ${inviterName}: <em>"${message}"</em>`)] : []),
          br(),
          p('Accept the invitation to view the full meeting details including the Meeting ID and Meeting Code.'),
          br(),
          btn(inviteLink, 'View Invitation'),
          br(),
          ft("If you weren't expecting this invitation, you can safely ignore this email."),
        ].join('')),
      };
    }

    // ── DISPUTE OPENED ──
    case 'dispute_opened': {
      const productTitle = data.productTitle || 'Unknown Product';
      const reason = data.reason || 'No reason provided';
      const disputeId = data.disputeId || '';
      const openedBy = data.openedBy || 'A user';

      return {
        subject: `Dispute opened: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Dispute Opened'),
          p(`A dispute has been opened regarding an order on ${link('DK AI Marketplace')}.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Opened by', openedBy),
            infoRow('Reason', reason),
          ].join('')),
          br(),
          p('Please review the dispute details and respond within the given timeframe. Our team will mediate if needed.'),
          br(),
          btn(`${baseUrl}/disputes/${disputeId}`, 'View Dispute'),
          br(),
          ft(`Dispute ID: ${disputeId}`),
        ].join('')),
      };
    }

    // ── DISPUTE RESOLVED ──
    case 'dispute_resolved': {
      const productTitle = data.productTitle || 'Unknown Product';
      const resolution = data.resolution || 'resolved';
      const disputeId = data.disputeId || '';

      return {
        subject: `Dispute resolved: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Dispute Resolved'),
          p(`A dispute regarding your order on ${link('DK AI Marketplace')} has been resolved.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Resolution', resolution),
          ].join('')),
          br(),
          btn(`${baseUrl}/disputes/${disputeId}`, 'View Details'),
          br(),
          ft(`Dispute ID: ${disputeId}`),
        ].join('')),
      };
    }

    // ── REVIEW RECEIVED (seller notification – with review text) ──
    case 'review_received': {
      const productTitle = data.productTitle || 'Unknown Product';
      const rating = data.rating || 0;
      const reviewerName = data.reviewerName || 'A buyer';
      const reviewText = data.reviewText || '';
      const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));

      const content = [
        h('New Review Received'),
        p(`<strong>${reviewerName}</strong> has left a review on your product on ${link('DK AI Marketplace')}.`),
        br(),
        infoBox([
          infoRow('Product', productTitle),
          infoRow('Rating', `${stars} (${rating}/5)`),
        ].join('')),
      ];

      if (reviewText) {
        content.push(br());
        content.push(quoteBlock('What they wrote:', reviewText));
      }

      content.push(
        br(),
        btn(`${baseUrl}/my-products`, 'View Your Products'),
        br(),
        ft('Reviews help build trust with buyers. Thank you for being part of DK AI Marketplace.'),
      );

      return {
        subject: `New review on ${productTitle} – DK AI Marketplace`,
        html: wrapEmail(content.join('')),
      };
    }

    // ── PAYOUT PROCESSED ──
    case 'payout_processed': {
      const amount = Number(data.amount) || 0;
      const method = data.method || 'bank transfer';
      const payoutId = data.payoutId || '';

      return {
        subject: `Payout processed: ${formatCurrency(amount)} – DK AI Marketplace`,
        html: wrapEmail([
          h('Payout Processed'),
          p(`Your payout from ${link('DK AI Marketplace')} has been processed.`),
          br(),
          infoBox([
            infoRow('Amount', `<strong>${formatCurrency(amount)}</strong>`),
            infoRow('Method', method),
          ].join('')),
          br(),
          p('The funds should arrive in your account within 2-5 business days depending on your payment provider.'),
          br(),
          btn(`${baseUrl}/seller-earnings`, 'View Earnings'),
          br(),
          ft(`Payout ID: ${payoutId}`),
        ].join('')),
      };
    }

    // ── PRODUCT APPROVED ──
    case 'product_approved': {
      const productTitle = data.productTitle || 'Your product';
      const productId = data.productId || '';

      return {
        subject: `Product approved: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Product Approved'),
          p(`Your product <strong>${productTitle}</strong> on ${link('DK AI Marketplace')} has been reviewed and approved. It is now live on the marketplace.`),
          br(),
          btn(`${baseUrl}/product/${productId}`, 'View Product'),
          br(),
          ft('Your product is now visible to all marketplace visitors.'),
        ].join('')),
      };
    }

    // ── PRODUCT REJECTED ──
    case 'product_rejected': {
      const productTitle = data.productTitle || 'Your product';
      const reason = data.reason || 'No specific reason provided.';

      return {
        subject: `Product not approved: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Product Not Approved'),
          p(`Your product <strong>${productTitle}</strong> on ${link('DK AI Marketplace')} was reviewed but could not be approved at this time.`),
          br(),
          infoBox(infoRow('Reason', reason)),
          br(),
          p('You can edit your product and resubmit it for review from your seller dashboard.'),
          br(),
          btn(`${baseUrl}/my-products`, 'Edit Products'),
          br(),
          ft('If you believe this was a mistake, please contact our support team.'),
        ].join('')),
      };
    }

    // ── ACCOUNT BAN (permanent) ──
    case 'account_ban': {
      const reason = data.reason || 'Serious violation of platform terms of service.';

      return {
        subject: 'Account Permanently Banned – DK AI Marketplace',
        html: wrapEmail([
          h('Account Permanently Banned'),
          p(`Your account on ${link('DK AI Marketplace')} has been permanently banned due to a serious violation of our platform policies.`),
          br(),
          infoBox([
            infoRow('Action', '<strong style="color:#dc2626;">Permanent Ban</strong>'),
            infoRow('Reason', reason),
          ].join('')),
          br(),
          p('This action is permanent. You will no longer be able to access your account, list products, or participate in the marketplace.'),
          br(),
          p('If you believe this action was taken in error, please contact our support team at <strong>support@dkaimarketplace.com</strong> with your account details and any relevant information.'),
          br(),
          ft('This is an automated notification from the DK AI Marketplace moderation team.'),
        ].join('')),
      };
    }

    // ── ACCOUNT WARNING (strike) ──
    case 'account_warning': {
      const warningNumber = data.warningNumber || '1';
      const reason = data.reason || 'Violation of community guidelines.';
      const consequences = data.consequences || 'Repeated violations may result in temporary suspension or permanent ban.';

      return {
        subject: `Account Warning (Strike ${warningNumber}) – DK AI Marketplace`,
        html: wrapEmail([
          h('Account Warning'),
          p(`Your account on ${link('DK AI Marketplace')} has received a formal warning from our moderation team.`),
          br(),
          infoBox([
            infoRow('Warning', `<strong style="color:#d97706;">Strike ${warningNumber}</strong>`),
            infoRow('Reason', reason),
          ].join('')),
          br(),
          `<div style="background:#fef3c7;border-left:4px solid #d97706;border-radius:4px;padding:16px 20px;margin:8px 0;">
            <p style="margin:0;padding:0;font-size:13px;color:#92400e;font-weight:600;margin-bottom:8px;">What happens next:</p>
            <p style="margin:0;padding:0;font-size:14px;color:#92400e;line-height:1.6;">${consequences}</p>
          </div>`,
          br(),
          p('Please review our <strong>Terms of Service</strong> and <strong>Community Guidelines</strong> to avoid further action.'),
          br(),
          p('If you believe this warning was issued in error, please contact <strong>support@dkaimarketplace.com</strong>.'),
          br(),
          ft('This is an automated notification from the DK AI Marketplace moderation team.'),
        ].join('')),
      };
    }

    // ── ACCOUNT DEACTIVATION ──
    case 'account_deactivation': {
      const deactivationDate = data.deactivationDate || new Date().toLocaleDateString('en-US');

      return {
        subject: 'Account Deactivated – DK AI Marketplace',
        html: wrapEmail([
          h('Account Deactivated'),
          p(`Your account on ${link('DK AI Marketplace')} has been deactivated as of <strong>${deactivationDate}</strong>.`),
          br(),
          infoBox(`<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">Your profile, products, and listings are no longer visible to other users. Any pending orders will continue to be processed normally. Your data will be retained for 30 days before permanent deletion.</p>`),
          br(),
          p('If you would like to reactivate your account within the 30-day window, simply log in again.'),
          br(),
          btn('https://dkaimarketplace.lovable.app/login', 'Reactivate Account'),
          br(),
          ft('If you did not request this deactivation, please contact support@dkaimarketplace.com immediately.'),
        ].join('')),
      };
    }

    // ── ACCOUNT DELETION ──
    case 'account_deletion': {
      const deletionDate = data.deletionDate || new Date().toLocaleDateString('en-US');

      return {
        subject: 'Account Deleted – DK AI Marketplace',
        html: wrapEmail([
          h('Account Deleted'),
          p(`Your account on ${link('DK AI Marketplace')} has been permanently deleted as of <strong>${deletionDate}</strong>.`),
          br(),
          infoBox(`<p style="margin:0;font-size:14px;color:#374151;font-weight:600;margin-bottom:8px;">What has been removed:</p>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.8;">
              - Your profile and personal information<br />
              - All product listings<br />
              - Review and rating history<br />
              - Meeting history and scheduled meetings<br />
              - Community posts and comments
            </p>`),
          br(),
          p('Any outstanding payments or pending payouts have been processed according to our terms of service. This action cannot be undone.'),
          br(),
          p('We are sorry to see you go. If you ever wish to return, you are welcome to create a new account at any time.'),
          br(),
          ft('If you did not request this deletion, please contact support@dkaimarketplace.com immediately.'),
        ].join('')),
      };
    }

    // ── SANCTION LIFTED (account reinstated) ──
    case 'sanction_lifted': {
      const originalSanction = data.originalSanction || 'Temporary Suspension';
      const liftedDate = data.liftedDate || new Date().toLocaleDateString('en-US');

      return {
        subject: 'Account Reinstated – DK AI Marketplace',
        html: wrapEmail([
          h('Account Reinstated'),
          p(`Your account on ${link('DK AI Marketplace')} has been reinstated as of <strong>${liftedDate}</strong>.`),
          br(),
          infoBox([
            infoRow('Previous Sanction', originalSanction),
            infoRow('Status', '<strong style="color:#16a34a;">Active</strong>'),
          ].join('')),
          br(),
          p('You now have full access to all marketplace features again, including listing products, making purchases, and participating in meetings. Please make sure to follow our platform guidelines going forward.'),
          br(),
          btn('https://dkaimarketplace.lovable.app/', 'Go to Marketplace'),
          br(),
          ft('Welcome back to DK AI Marketplace. Thank you for your understanding.'),
        ].join('')),
      };
    }

    // ── REFUND REQUESTED (seller notification) ──
    case 'refund_requested': {
      const productTitle = data.productTitle || 'Unknown Product';
      const buyerName = data.buyerName || 'A buyer';
      const reason = data.reason || 'No reason provided';
      const orderId = data.orderId || '';
      const price = Number(data.price) || 0;

      return {
        subject: `Refund requested: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Refund Requested'),
          p(`<strong>${buyerName}</strong> has requested a refund for an order on ${link('DK AI Marketplace')}.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Buyer', buyerName),
            infoRow('Amount', formatCurrency(price)),
          ].join('')),
          br(),
          quoteBlock('Reason for refund:', reason),
          br(),
          p('Our team will review this request. You may be asked to provide additional information. You can view the dispute details in your seller dashboard.'),
          br(),
          btn(`${baseUrl}/seller-orders`, 'View Orders'),
          br(),
          ft(`Order ID: ${orderId}. If you have questions, contact support@dkaimarketplace.com.`),
        ].join('')),
      };
    }

    // ── REFUND ACCEPTED (buyer notification) ──
    case 'refund_accepted': {
      const productTitle = data.productTitle || 'Unknown Product';
      const price = Number(data.price) || 0;
      const paymentMethod = data.paymentMethod || 'your original payment method';
      const orderId = data.orderId || '';

      return {
        subject: `Refund approved: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Refund Approved'),
          p(`Your refund request for an order on ${link('DK AI Marketplace')} has been reviewed and <strong>approved</strong>.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Refund Amount', `<strong style="color:#16a34a;">${formatCurrency(price)}</strong>`),
            infoRow('Payment Method', paymentMethod),
          ].join('')),
          br(),
          p(`The refund of <strong>${formatCurrency(price)}</strong> will be returned to you via <strong>${paymentMethod}</strong>. Please allow 3-10 business days for the funds to appear in your account, depending on your payment provider.`),
          br(),
          p('You will receive a confirmation email once the refund has been fully processed.'),
          br(),
          btn(`${baseUrl}/purchase-history`, 'View Your Orders'),
          br(),
          ft(`Order ID: ${orderId}. If you have questions, contact support@dkaimarketplace.com.`),
        ].join('')),
      };
    }

    // ── REFUND DECLINED (buyer notification) ──
    case 'refund_declined': {
      const productTitle = data.productTitle || 'Unknown Product';
      const reason = data.reason || 'No specific reason provided.';
      const orderId = data.orderId || '';

      return {
        subject: `Refund request denied: ${productTitle} – DK AI Marketplace`,
        html: wrapEmail([
          h('Refund Request Denied'),
          p(`Your refund request for an order on ${link('DK AI Marketplace')} has been reviewed and <strong>denied</strong>.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Decision', '<strong style="color:#dc2626;">Denied</strong>'),
          ].join('')),
          br(),
          quoteBlock('Reason:', reason),
          br(),
          p('If you believe this decision was made in error, you can open a dispute or contact our support team for further assistance.'),
          br(),
          btn(`${baseUrl}/disputes`, 'Open a Dispute'),
          br(),
          ft(`Order ID: ${orderId}. Contact support@dkaimarketplace.com for assistance.`),
        ].join('')),
      };
    }

    // ── REFUND COMPLETED (buyer confirmation – money arrived) ──
    case 'refund_completed': {
      const productTitle = data.productTitle || 'Unknown Product';
      const price = Number(data.price) || 0;
      const paymentMethod = data.paymentMethod || 'your original payment method';
      const orderId = data.orderId || '';

      return {
        subject: `Refund completed: ${formatCurrency(price)} – DK AI Marketplace`,
        html: wrapEmail([
          h('Refund Completed'),
          p(`Your refund from ${link('DK AI Marketplace')} has been successfully processed and the funds have been returned.`),
          br(),
          infoBox([
            infoRow('Product', productTitle),
            infoRow('Refunded Amount', `<strong style="color:#16a34a;">${formatCurrency(price)}</strong>`),
            infoRow('Returned via', paymentMethod),
            infoRow('Status', '<strong style="color:#16a34a;">Completed</strong>'),
          ].join('')),
          br(),
          p(`<strong>${formatCurrency(price)}</strong> has been returned to your account via <strong>${paymentMethod}</strong>. If you do not see the funds within 5 business days, please contact your payment provider or our support team.`),
          br(),
          btn(`${baseUrl}/purchase-history`, 'View Your Orders'),
          br(),
          ft(`Order ID: ${orderId}. Thank you for using DK AI Marketplace.`),
        ].join('')),
      };
    }
  }
}
