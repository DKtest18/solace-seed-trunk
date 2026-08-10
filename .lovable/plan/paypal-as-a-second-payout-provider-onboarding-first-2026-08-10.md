# PayPal as a second payout provider (onboarding first)

Yes — this is possible. PayPal's equivalent of Stripe Connect is the **PayPal Commerce Platform**: you (the platform) onboard sellers as connected merchants via **Partner Referrals**, and later charge buyers with `Orders v2` using `payee.merchant_id` plus `platform_fees` for your platform cut. Since you have a Partner/Commerce Platform account, we can mirror the Stripe Connect flow almost 1:1.

This first phase covers **seller onboarding + connection status only**. Buyer-side PayPal checkout comes as a second phase.

## What the seller will see

Payment Settings gets a two-card layout:

```text
┌── Stripe ──────────────┐  ┌── PayPal ──────────────┐
│ Connected (Live)       │  │ Not connected          │
│ Charges / Payouts / …  │  │ [Connect PayPal]       │
│ [Dashboard][Disconnect]│  │                        │
└────────────────────────┘  └────────────────────────┘
Accepted at checkout:  [x] Cards (Stripe)   [ ] PayPal
```

- A seller can connect Stripe, PayPal, or both.
- Toggles let the seller disable a provider they've connected; at least one must stay enabled.
- Onboarding is blocked from completing until at least one provider is fully connected (today it requires Stripe — that gate becomes "any provider").

## Steps

1. **Database** — extend `dkai_seller_payment_configs` with PayPal columns (merchant id, tracking id, onboarding status, permission/consent flags, payments-receivable + email-confirmed booleans, timestamps) and two `accepts_*` provider toggles. SQL will be given in chat, as always.
2. **Secrets** — add `DKAIM_PAYPAL_CLIENT_ID`, `DKAIM_PAYPAL_SECRET`, `DKAIM_PAYPAL_BN_CODE` (partner attribution / BN code) and `DKAIM_PAYPAL_ENV` (`sandbox` | `live`). Requested via the secure secret form, never in code.
3. **Edge functions** (prompts delivered in chat for you to run in Supabase AI, matching how the Stripe ones were deployed):
   - `paypal-connect-onboarding` — OAuth token, then `POST /v2/customer/partner-referrals` with a `tracking_id` = seller user id, `PAYPAL_MERCHANT_INTEGRATION` product, and `return_url` back to Payment Settings. Returns the `action_url` for the seller to complete PayPal signup.
   - `paypal-connect-status` — resolves the merchant id via `/v1/customer/partners/{partner_id}/merchant-integrations?tracking_id=…`, then reads the integration to get `payments_receivable`, `primary_email_confirmed`, and granted permissions. Syncs the result into `dkai_seller_payment_configs` (same aggressive-sync pattern the Stripe status function uses).
   - `paypal-connect-disconnect` — clears the stored PayPal merchant data for the seller.
4. **Frontend**
   - `src/lib/paypalConnectStatus.ts` — mirror of `stripeConnectStatus.ts` (status type, fetch, onboarding link, `pollPaypalConnectStatus` so the badge updates right after return from PayPal).
   - `src/pages/SellerPaymentSettings.tsx` — add the PayPal card, connect/disconnect actions, live status badge, and the two accepted-methods toggles.
   - `src/pages/SellerOnboardingPayment.tsx` — allow either provider to satisfy the payment step; show both options side by side.
   - `src/hooks/useSellerOnboardingProgress.tsx` and `ProfileCompletionIndicator` — treat "payment connected" as Stripe **or** PayPal.
5. **Not touched in this phase** — checkout, `create-checkout-session`, webhooks, earnings/payout pages, product wizard, homepage. Stripe behaviour stays exactly as it is today.

## Technical notes

- PayPal returns to your `return_url` with `merchantIdInPayPal` and `permissionsGranted` query params, but those are advisory: status is always re-verified server-side against the PayPal API before we mark a seller connected — same trust rule as Stripe.
- A seller is "PayPal ready" only when `payments_receivable === true`, `primary_email_confirmed === true`, and the `PARTNER_FEE` permission is granted (that permission is what allows your platform fee later).
- Sandbox vs live is driven by `DKAIM_PAYPAL_ENV` so we can test with your sandbox partner account first; the UI shows a "Sandbox" tag exactly like the Stripe card does.
- PayPal Commerce Platform onboarding is not available in every country. Sellers in unsupported countries will get a status of `unsupported_country` and the card explains they must use Stripe.

## Phase 2 (after you approve this)

Buyer-side PayPal: `paypal-create-order` / `paypal-capture-order` edge functions with `platform_fees`, a PayPal button on Checkout shown only when the seller has PayPal enabled, PayPal webhooks writing into `dkai_orders`, and refunds via `/v2/payments/captures/{id}/refund`.
