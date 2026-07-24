
# Adaptive Product Wizard — 5 Parts

## SQL you must run first (idempotent)

```sql
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS subscription_period_deliverables text,
  ADD COLUMN IF NOT EXISTS subscription_cancellation_note text,
  ADD COLUMN IF NOT EXISTS license_personal_description text,
  ADD COLUMN IF NOT EXISTS license_commercial_description text,
  ADD COLUMN IF NOT EXISTS license_agency_description text,
  ADD COLUMN IF NOT EXISTS license_exclusive_description text,
  ADD COLUMN IF NOT EXISTS exclusive_source_files_description text,
  ADD COLUMN IF NOT EXISTS max_active_subscribers integer,
  ADD COLUMN IF NOT EXISTS delivery_mode text,
  ADD COLUMN IF NOT EXISTS delivery_window_hours integer,
  ADD COLUMN IF NOT EXISTS setup_no_credentials boolean NOT NULL DEFAULT false;

-- Widen billing_interval to accept 'day'|'week'|'month'|'year' (already text, no-op if so)
-- Nothing to do if column is already text; verify:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dkai_products' AND column_name='billing_interval'
  ) THEN
    ALTER TABLE public.dkai_products ADD COLUMN billing_interval text;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
```

`dkai_product_setup_requirements` (secret specs) already exists from Part C work — reused as-is.

## Part 1 — Custom billing interval (PricingStep)

Rewrite the recurring section so the seller has a free integer input + unit select that never snap back. Presets are prefill buttons, not radios. Validate Stripe limits (day ≤ 365, week ≤ 52, month ≤ 12, year ≤ 1). Persist `billing_interval` + `billing_interval_count` + `is_subscription=true`. `subscriptionLabel()` in `src/lib/money.ts` already renders "every 2 weeks" style — verified.

Files: `src/components/product-creation/PricingStep.tsx`.

## Part 2 — Adaptive AdditionalDetailsStep

Rewrite `AdditionalDetailsStep.tsx` to branch on `pricing_model`, `delivery_mode` (read from formData), and enabled license tiers:
- One-time: Estimated Delivery only when `delivery_mode==='manual'`.
- Subscription: add `subscription_period_deliverables`, `subscription_cancellation_note` (prefilled), relabel Quantity → "Max active subscribers".
- Per enabled tier: optional "What's included" textarea → `license_{tier}_description`.
- Exclusive enabled: required `exclusive_source_files_description`.
- Remove per-product refund field; replace with read-only info note pointing to Return Policy step.

Files: `AdditionalDetailsStep.tsx`, `CreateProduct.tsx` & `EditProduct.tsx` (formData + save/load mapping).

## Part 3 — Adaptive DeliveryFilesStep

Refactor `DeliveryFilesStep.tsx` to expose 3 delivery modes as a toggle group:
1. Instant download — needs ≥1 file.
2. Manual delivery — needs `delivery_window_hours` (12/24/48).
3. Setup by seller — surfaces Setup Requirements (secret specs) inline; needs ≥1 spec OR `setup_no_credentials=true` checkbox.

Suggested-files hint text switches on `product_type` (agent / workflow / prompt / dataset / template). Exclusive info box appears when `license_exclusive_enabled`. Next-button validation lives in `CreateProduct.tsx` `validateStep(8)`.

Secret spec CRUD reuses the existing `SellerSetupRequirements.tsx` logic; extract its form into a small `SetupRequirementsInline` sub-component and reuse in both places.

Files: `DeliveryFilesStep.tsx`, new `src/components/product-creation/SetupRequirementsInline.tsx`, `CreateProduct.tsx` validation.

## Part 4 — Adaptive Return Policy + Terms

`ReturnPolicyStep.tsx`: keep platform-wide policy text, append conditional bullets driven by formData (subscription / manual / setup+secrets / agency / exclusive). Each conditional block ships its own required acknowledgement checkbox in the local `acknowledgements` state; `CreateProduct.validateStep(9)` requires all visible ones checked.

`TermsAcceptanceStep.tsx`: add the hosting/liability notice block (limitation wording, "subject to lawyer review" tag). Same notice appended to `src/pages/SellerGuidelines.tsx`.

Files: `ReturnPolicyStep.tsx`, `TermsAcceptanceStep.tsx`, `SellerGuidelines.tsx`, `CreateProduct.tsx` validation.

## Part 5 — Buyer-side consistency

- `ProductDetail.tsx`: show subscription interval next to price via `formatProductPrice()` (already), render "Requires from you after purchase: …" list from `dkai_product_setup_requirements`, render exclusive warning when applicable, render delivery mode + window line.
- `src/components/LicenseSelector.tsx`: render per-tier `license_*_description` under each tier row.
- `src/pages/Checkout.tsx`: order summary shows chosen license tier label + `subscriptionLabel(product)`.

Files: `ProductDetail.tsx`, `LicenseSelector.tsx`, `Checkout.tsx`.

## Test matrix I will verify with a build + type check

| Scenario | Save | Product page | Checkout |
|---|---|---|---|
| One-time + instant, 1 file | ✅ | price only | one-time |
| One-time + manual, 24h window | ✅ | "Manual delivery within 24h" | one-time |
| Subscription every 2 weeks | ✅ | "CHF 20 / 2 weeks" | recurring label |
| 2 secret specs (setup mode) | ✅ | "Requires: X, Y" list | setup notice |
| Agency + Exclusive enabled | ✅ | both tier descriptions; exclusive warning | tier label in summary |

## Non-goals / do-not-touch

Stripe Connect flow, guest checkout gating, admin review edge functions, delivery-files-dirty trigger, encryption of credentials, existing RLS.

Approve and I ship in this order: SQL note → Part 1 → 2 → 3 → 4 → 5, single response each with the files diffed and a build check at the end.
