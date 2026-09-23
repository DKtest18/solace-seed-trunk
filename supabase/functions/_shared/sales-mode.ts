// GLOBAL SALES SWITCH (server-side, not overridable by any request parameter).
//
// While `SALES_ENABLED` is false the marketplace runs in PREVIEW-ONLY mode:
// no new Stripe Checkout Session, PaymentIntent, PayPal order or any other new
// payment object may be created — for guests OR signed-in buyers.
//
// Deliberately NOT affected by this switch:
//  - payment webhooks (stripe-webhook, paypal webhooks) so already existing
//    transactions keep being processed correctly,
//  - refunds, disputes, payouts/transfer bookkeeping,
//  - all existing payment logic, which stays intact for the later sales launch.
//
// To go live later: set SALES_ENABLED = true and redeploy the checkout
// functions. Product approval, preview consent or a deployment alone must
// never flip this flag.
export const SALES_ENABLED = false;

export const SALES_PAUSED_MESSAGE =
  'Purchases are currently disabled. DK AI Marketplace is running in preview mode: listings can be viewed, but no purchase can be made yet.';

export const SALES_PAUSED_CODE = 'SALES_DISABLED';

/**
 * Returns a 403 Response when sales are globally disabled, otherwise null.
 * Call this as the FIRST thing inside every checkout entry point, before any
 * payment object is created and before any request body is trusted.
 */
export function salesDisabledResponse(extraHeaders: HeadersInit = {}): Response | null {
  if (SALES_ENABLED) return null;
  return new Response(
    JSON.stringify({ error: SALES_PAUSED_MESSAGE, code: SALES_PAUSED_CODE }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...extraHeaders,
      },
    },
  );
}
