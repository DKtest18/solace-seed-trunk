# Plan

## Scope
Finish the interrupted Stripe Connect migration for the existing external Supabase project only, and fix the visible logo/text issues without generating new assets.

## Order of work
1. Preserve the already-correct separate-charges work and patch only missing/incorrect parts.
2. Harden the database migration SQL so it is additive, idempotent, and safe to run after the earlier Step-1 migration.
3. Finish Edge Functions:
   - platform Checkout Sessions for new payments, without application fees, transfer data, or on-behalf-of fields
   - Stripe webhook handling for paid, failed, refunded, disputed, duplicate, and out-of-order events
   - transfer worker with database leases, frozen idempotency, retry/backoff, and recovery
   - Stripe Connect onboarding with declared seller country and allowlist
4. Update seller-facing pages for country choice, payout status, and accurate Stripe-only payment wording.
5. Fix login/footer logos by removing dark wrappers and using the existing transparent header logo at larger sizes.
6. Validate locally where possible and report exactly what was tested.
7. Apply/deploy to the external Supabase project only if authorized access exists; otherwise provide complete manual SQL and deploy commands.

## Required conditions before deployment
- Verify legacy charge types from the original checkout code and Stripe account context; do not assume the old `destination` label is financially accurate.
- Preserve 5% commission, existing founding-seller benefits, seller-borne processing fees, and the seven-day transfer eligibility delay.
- Verify seller-country support for a Swiss platform before enabling CH, LI, DE, AT, and US in live onboarding.
- Confirm any deployment connection targets external Supabase project `dwqpkdatzdqhplgyhigg`; never use Lovable Cloud.
- Test critical payment scenarios in Stripe test mode before deployment.
- Keep the production payout scheduler disabled until explicit approval.
- Generate no new logo assets; if the existing header logo is unsuitable, ask for a transparent original.

## Technical details
- External Supabase project reference: `dwqpkdatzdqhplgyhigg` from `supabase/config.toml`.
- Lovable Cloud will not be enabled or used.
- Existing direct-charge orders remain `charge_mode = 'destination'` and are serviced in their legacy Stripe account context.
- New payments are platform charges with `transfer_group = order_<order_id>` and seller transfers only after the hold and checks pass.
- Seller payout wording will say `Eligible for transfer after [date]`, never bank-arrival language.
- Stripe docs to apply: separate charges and transfers, cross-border payouts, and account capabilities.
