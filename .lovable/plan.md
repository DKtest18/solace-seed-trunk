# Migration: Direct Charges → Separate Charges and Transfers (+ 7-day hold)

Investigation only. No code was changed.

---

## 1. Every place a Stripe charge is created

| File | Charge type | `application_fee_amount` | `Stripe-Account` / `stripe_account` | `on_behalf_of` |
|---|---|---|---|---|
| `supabase/functions/create-checkout-session/index.ts` (canonical, guest + logged-in) | Checkout Session, `mode=payment`, with `payment_intent_data[transfer_data][destination]` = seller acct → **destination charge on the platform account** | Yes, `payment_intent_data[application_fee_amount]` | No header (created on platform) | **Yes** — set for `tier2`/`tier3` only |
| `supabase/functions/create-product-checkout/index.ts` (legacy path, auth-only) | Same: Checkout Session + `transfer_data[destination]` | Yes | No | No |
| `supabase/functions/paypal-create-order/index.ts` | PayPal, not Stripe | n/a | n/a | n/a |

No other function creates a charge. Other Stripe calls: `stripe-connect-onboarding` / `stripe-connect-onboard` (`/v1/accounts`, `/v1/account_links`), `stripe-connect-status` (`/v1/accounts/{id}`), `stripe-connect-dashboard` (`login_links`), `stripe-connect-disconnect`, `stripe-payment-methods` (capabilities), `stripe-create-price` (**the only place that sends a `Stripe-Account` header** — it creates products/prices on the connected account).

Note: technically today's charges are *destination charges*, not true direct charges (`Stripe-Account` header is not used at charge time). That is good news — see §8, the change is smaller than a full direct-charge migration.

## 2. Current end-to-end flow

1. Buyer opens `/checkout` (`src/pages/Checkout.tsx`), accepts buyer terms (guests accept locally), clicks **Pay with Card**.
2. Logged-in → `supabase.functions.invoke('create-checkout-session')`; guest → `src/lib/publicFunctionInvoke.ts` (apikey only). `verify_jwt = false` for that function.
3. Inside the function, in order:
   - `isProductPurchasable()` guard (`_shared/purchasable.ts` → RPC `dkai_product_purchasable`).
   - Load product (`dkai_products`: id, title, price, seller_id, delivery_tier, review_status); require `review_status = approved`.
   - Resolve the seller's Stripe account from `dkai_seller_payment_configs` (fallback `dkai_profiles.stripe_account_id`).
   - Fee: `getPlatformFeePercent()` → RPC `dkai_effective_platform_fee_percent`.
   - Read `dkai_payout_config` for `auto_release_days` by tier.
   - **Insert the order** into `dkai_orders` (`status='pending_payment'`, `payout_status` = `pending` for tier1 else `held`, `auto_release_at`, `platform_fee`, `seller_earnings`, `application_fee_amount`, `held_amount`).
   - `POST /v1/checkout/sessions` with `application_fee_amount`, `transfer_data[destination]`, `on_behalf_of` (tier2/3), metadata `order_id`.
   - Store `stripe_session_id` on the order; return the session URL.
4. Buyer pays on Stripe. Stripe splits automatically: fee to platform, remainder to the connected account.
5. `supabase/functions/stripe-webhook/index.ts` verifies the signature, de-duplicates in `webhook_events`, then on `checkout.session.completed` / `payment_intent.succeeded` sets `status='paid'`, `escrow_status` released/held, `payout_status`, `auto_release_at`, `eu_withdrawal_waiver_at`, `stripe_payment_intent_id` (guarded by `status='pending_payment'`, so idempotent), then emails buyer + seller.
6. `supabase/functions/auto-release-payouts/index.ts` (pg_cron, hourly) flips `payout_status='held' → 'auto_released'` past `auto_release_at` with no dispute, and increments `dkai_seller_balances.available_balance`. **It creates no Stripe object** — the money already moved at charge time. So today the "hold" is bookkeeping only, not a real hold.

## 3. Tables and columns involved

**`dkai_orders`** — `id`, `buyer_id` (nullable, guests), `guest_email`, `product_id`, `seller_id`, `price`, `currency`, `platform_fee`, `seller_earnings`, `application_fee_amount`, `held_amount`, `payment_method`, `status` (`pending_payment|paid|delivered|completed|refunded|refund_requested|failed`), `escrow_status` (legacy, retired), `payout_status` (`pending|held|released|auto_released|refunded|disputed`), `auto_release_at`, `released_at`, `dispute_opened_at`, `delivery_tier`, `stripe_session_id`, `stripe_payment_intent_id`, `stripe_transfer_id` (**exists but never written today**), `stripe_capture_method`, `refund_deadline`, `paid_at`, `buyer_confirmed_at`, PayPal columns (`paypal_order_id`, `paypal_capture_id`, `paypal_platform_fee`, `paypal_refund_id`, `paypal_merchant_id`, `paypal_is_sandbox`), exclusive/handover columns, `shipping_address`, `created_at`, `updated_at`.

**`dkai_seller_payment_configs`** — one row per `seller_id`: `stripe_account_id`, `charges_enabled`, `card_payments_enabled`, `stripe_onboarded`, `stripe_onboarding_status`, `onboarding_status`, PayPal fields. Canonical payout-account source.

**`dkai_profiles`** — `platform_fee_percent` (default 5), `seller_type` (`founding|private|standard`), `is_founding_seller`, `founding_granted_at`, `founding_granted_by`, `founding_free_sales_limit` (default 4), legacy `stripe_account_id` / `stripe_onboarded`, country, company fields.

**`dkai_seller_balances`** — `seller_id`, `available_balance`, `held_balance`, `pending_balance`, `currency`. Internal ledger only, never reconciled against Stripe.

**`dkai_platform_ledger_entries`** — `user_id`, amount/type/timestamp rows shown in the seller earnings UI.

**`dkai_payout_config`** — `tier`, `auto_release_days`, `dispute_window_days`.

**`dkai_refund_requests`** — `order_id`, `buyer_id`/`buyer_email` (guest-safe), `seller_id`, `reason`, `description`, `evidence_paths`, `status` (`pending|under_review|approved|rejected|refunded|failed`), `admin_notes`, `decided_by`, `decided_at`, `stripe_refund_id`, `refund_amount`.

**`dkai_disputes`** — `order_id`, `buyer_id`, `seller_id`, `product_id`, `type`, `reason`, `status`, `refund_amount`, `resolution`, `resolution_notes`, `resolved_at`, `resolved_by`.

**`dkai_user_balances`** — buyer-side internal credit (used by `resolve-dispute`).

**`webhook_events`** — `provider`, `provider_event_id`, `event_type`, `payload`, `processed`, `processed_at`, `error_message`.

## 4. How refunds work today

Two parallel systems, and **neither calls the Stripe refund API from this repo**:

- `request-refund` (legacy, buyer-initiated) validates the product return window (24h floor, 90d cap, optional 0–30% return fee), creates a `dkai_disputes` row and sets `status='refund_requested'`.
- `dkai_refund_requests` + `admin-decide-refund-request` — the UI (`src/pages/AdminRefundRequests.tsx`) invokes that function and displays `stripe_refund_id`, but **the function does not exist in this repository** (deployed only, or missing). This is the biggest unknown and must be inspected in the Supabase dashboard before migration.
- `resolve-dispute` (admin) marks the order refunded and credits `dkai_user_balances` (internal store credit) — no Stripe refund, no reversal of the application fee, no debit of `dkai_seller_balances`.
- `admin-escrow-action` marks refunded, or "releases" and credits the seller via RPC `increment_seller_balance` (hardcoded `price * 0.9` fallback — stale 10% assumption).

Consequence today: on a destination charge, a refund pulls the money back from the platform, the connected account keeps its transfer unless a reversal is requested, and the application fee is only refunded if `refund_application_fee` is passed — which nothing does. **Refunds are currently financially incorrect.**

## 5. How disputes work today

`open-dispute` / `seller-respond-dispute` / `resolve-dispute` + `dkai_disputes` are a purely internal, in-app dispute workflow. `dkai_orders.dispute_opened_at` blocks auto-release. There is **no handling of Stripe's own `charge.dispute.created` / `.closed` events** — the webhook only handles `payment_intent.succeeded`, `checkout.session.completed`, `payment_intent.payment_failed`. Card chargebacks are invisible to the app today.

## 6. Founding-seller 0% logic

SQL, in `db/migrations/20260902_admin_directory_founding_logos.sql`:
- `dkai_effective_platform_fee_percent(_seller_id)` — reads `platform_fee_percent` (default 5), `is_founding_seller`, `founding_free_sales_limit` (default 4); if founding and `dkai_seller_settled_sales_count(seller) < limit` returns **0**, else the per-seller percent clamped 0–100.
- `dkai_seller_settled_sales_count()` counts orders in completed/delivered/released states, excluding refunded/reversed and approved refund requests.
- `dkai_admin_set_founding_seller()` — admin-only toggle, hard cap 5 founding sellers.
- Consumed by `supabase/functions/_shared/platform-fee.ts` (`getPlatformFeePercent`, `DEFAULT_PLATFORM_FEE_PERCENT = 5`) from both checkout functions.

## 7. Which sellers are affected

Not answerable from the repo — the database is your standalone Supabase and this environment has no connection to it. Run this in the SQL editor:

```sql
SELECT c.seller_id, p.email, p.country, p.seller_type, p.is_founding_seller,
       c.stripe_account_id, c.charges_enabled, c.stripe_onboarding_status,
       (SELECT count(*) FROM public.dkai_orders o
         WHERE o.seller_id = c.seller_id
           AND o.status IN ('paid','delivered','completed')) AS settled_sales,
       (SELECT count(*) FROM public.dkai_orders o
         WHERE o.seller_id = c.seller_id AND o.payout_status = 'held') AS held_orders
FROM public.dkai_seller_payment_configs c
JOIN public.dkai_profiles p ON p.id = c.seller_id
WHERE c.stripe_account_id IS NOT NULL
ORDER BY settled_sales DESC;
```

Also check legacy holders: `SELECT id, email, stripe_account_id FROM public.dkai_profiles WHERE stripe_account_id IS NOT NULL;`

---

# Migration plan

## 8. What changes in the charge creation call

In `create-checkout-session` (and `create-product-checkout`, which should become a thin proxy):

**Remove**
- `payment_intent_data[application_fee_amount]`
- `payment_intent_data[transfer_data][destination]`
- `payment_intent_data[on_behalf_of]`

**Keep / add**
- Session created on the platform account (no `Stripe-Account` header) — unchanged.
- `payment_intent_data[transfer_group]` = order id, so charge and later transfer are linked in Stripe reporting.
- Metadata unchanged (`order_id`, `seller_id`, `product_id`).
- Currency must equal your platform settlement currency (`chf` in the canonical function; the legacy function still says `usd` — fix that inconsistency during the migration).

The full price now lands on your platform balance. The seller's share moves later via `POST /v1/transfers` with `amount`, `currency`, `destination = acct_…`, `transfer_group = order_id`, `source_transaction = ch_… ` (recommended: ties the transfer to the specific charge so it only becomes available when the charge settles and reversals are clean), plus an **`Idempotency-Key` of the order id** so a retry can never double-pay.

## 9. New database columns

On `dkai_orders`:
- `sale_completed_at timestamptz` — when the sale counts as completed (payment success, or delivery confirmation if you prefer).
- `transfer_eligible_at timestamptz` — `sale_completed_at + interval '7 days'` (store explicitly so the window can be extended per order).
- `transfer_state text` default `'pending'`, check in (`pending`,`eligible`,`processing`,`transferred`,`reversed`,`blocked`,`failed`).
- `stripe_transfer_id text` — already exists, start writing it.
- `stripe_transfer_created_at timestamptz`
- `stripe_transfer_amount numeric(12,2)`
- `stripe_transfer_error text`
- `stripe_charge_id text` — needed as `source_transaction`.
- `stripe_transfer_reversal_id text` — for refunds after transfer.
- `platform_fee_locked numeric(12,2)` — the fee decided at sale time, so a later change to the founding counter cannot alter historical payouts.
- Partial index on `(transfer_state, transfer_eligible_at) WHERE transfer_state IN ('pending','eligible')`.
- Unique index on `stripe_transfer_id` (guards double transfers).

## 10. Triggering the delayed transfer — recommendation

Options in this stack:
- **pg_cron → edge function via `net.http_post`** — already proven here: `20260602_delivery_tier_payouts.sql` schedules `dkai-auto-release-payouts` hourly with the service-role bearer. Zero new infrastructure.
- Supabase scheduled functions / cron config — newer, another moving part, and this project deploys functions manually.
- External scheduler (GitHub Actions, Upstash) — extra secret surface, extra vendor.
- Stripe-side delay — not possible; transfers must be created by you.

**Recommendation: pg_cron calling a new `process-seller-transfers` edge function, hourly.** It reuses the exact pattern and auth model already working in production, keeps the schedule visible in the database next to the data, and needs no new vendor. Design rules for that function: batch ~50 orders, claim rows atomically (`UPDATE … SET transfer_state='processing' WHERE transfer_state='eligible' RETURNING`), skip orders with an open dispute/refund request, one `POST /v1/transfers` per order with the order id as idempotency key, write id/status/errors back, and leave failures in `failed` for admin review rather than retrying blindly.

## 11. How refunds must change

Every refund now hits your platform balance first, so the two cases differ:

**Before the transfer (within 7 days) — the good case.**
1. `POST /v1/refunds` with `charge` / `payment_intent`, `amount` = policy amount.
2. Set `transfer_state='blocked'`, `payout_status='refunded'`, order `status='refunded'` so the cron never transfers it.
3. Seller earnings are simply never paid out. Nothing to claw back. No `refund_application_fee` needed, since you no longer take an application fee — your margin was never separated.
4. Partial refund: reduce the pending transfer amount to `seller_earnings − refunded_seller_share` and leave it eligible.

**After the transfer — the recovery case.**
1. `POST /v1/transfers/{tr_…}/reversals` with the seller's share; store `stripe_transfer_reversal_id`. This works only while the connected account holds enough balance.
2. Then refund the buyer from the platform.
3. If the reversal fails for insufficient funds, you carry the loss. Mitigations, in order of strength: keep the 7-day hold (already the plan), net future transfers against an outstanding negative balance you track yourself (`dkai_seller_balances.held_balance` or a new `outstanding_debt` column), require the seller's agreement to cover reversals (already in the seller terms per the platform-rules memory), and place repeat offenders on a longer hold.

**Also required, and missing today:** handle `charge.dispute.created` (block the transfer, mark `payout_status='disputed'`), `charge.dispute.closed` (release or write off), `charge.refunded`, and `transfer.reversed` in `stripe-webhook`. And `resolve-dispute` / `admin-escrow-action` must stop crediting internal balances without a matching Stripe action — that is the current correctness hole.

## 12. How the founding-seller fee logic changes

The SQL stays the single source of truth; only its consumer changes.

- At sale time (checkout), still call `dkai_effective_platform_fee_percent(seller_id)` and **freeze** the result into `platform_fee_locked`, `platform_fee`, `seller_earnings`. This is important: with a delayed transfer, the founding counter may cross the 4-sale threshold between payment and payout, and the payout must use the fee that applied at purchase.
- At transfer time, the transfer amount is simply `seller_earnings` (in cents) — no percentage recomputation.
- Founding 0% now means "transfer 100% of the price", not "set application_fee_amount = 0". Practical bonus: with separate transfers you can express any split, including holding back a partial amount, which a single `application_fee_amount` could not do cleanly.
- Keep `dkai_seller_settled_sales_count()` as is; it counts settled sales and is unaffected.

## 13. Existing connected accounts during migration

- **Express accounts stay valid.** `acct_…` ids, onboarding state and `charges_enabled` are unchanged; nothing needs re-onboarding.
- Separate charges and transfers only need the **`transfers` capability** on the connected account. Existing accounts onboarded for `card_payments` + `transfers` are fine; accounts with only `card_payments` need `transfers` requested. Check per account via `/v1/accounts/{id}` and, if needed, `stripe-payment-methods`-style capability requests.
- Because the charge now sits on your platform account, **cross-border payouts become possible** — that is the whole point, and it unlocks EEA/UK/US/CA sellers. Your platform account country determines which destination countries are supported; verify the list for a Swiss platform account with Stripe before promising markets.
- What changes for sellers: statement descriptor and receipts now come from DK AI Marketplace (you are the merchant of record for the charge), the Express dashboard no longer shows the charge — only incoming transfers, and payout timing changes from "Stripe schedule after charge" to "7 days after sale, then Stripe schedule".
- **In-flight orders must not be double-paid.** Orders already paid under destination charges already sent the seller their share. Backfill them as `transfer_state='transferred'` (with a note, no `stripe_transfer_id`) so the new cron ignores them. This backfill is mandatory before the cron is scheduled.
- Manual payout schedule on connected accounts (used today for tier2/3 holds) is no longer needed and can be set back to automatic, since the hold now lives on your side.
- The legacy `dkai_profiles.stripe_account_id` fallback should be backfilled into `dkai_seller_payment_configs` and then dropped from the read path.

## 14. Test-mode checklist before live money

**Charge**
1. Guest checkout (no account) → Stripe collects email → payment succeeds → order `paid`, `buyer_id` NULL, `guest_email` filled.
2. Logged-in checkout → same, `buyer_id` set.
3. Charge lands on the **platform** balance in full; no application fee, no transfer created at payment time.
4. `transfer_group` and `stripe_charge_id` recorded; `sale_completed_at` and `transfer_eligible_at` = +7 days.
5. Declined card (`4000000000000002`) → order `failed`, no transfer row.
6. Webhook replay of the same event → no duplicate write (existing `webhook_events` idempotency still holds).

**Transfer**
7. Cron picks up an order only after `transfer_eligible_at`; not one second before.
8. Transfer amount equals frozen `seller_earnings` to the cent, for a 5% seller and for a founding 0% seller.
9. Founding seller crossing the 4-sale threshold between payment and transfer still gets 0% on the earlier order.
10. Running the cron twice in the same hour creates exactly one transfer (idempotency key).
11. Seller with `transfers` capability missing → order goes `failed` with a readable error, no crash, admin sees it.
12. Cross-border seller (test accounts in DE, GB, US, CA) receives the transfer successfully.
13. Order with an open dispute or pending refund request is skipped.

**Refund and dispute**
14. Full refund before 7 days → buyer refunded, transfer never created, order `refunded`.
15. Partial refund before 7 days → reduced transfer later, amounts reconcile.
16. Refund after transfer → reversal created, then buyer refund; balances reconcile.
17. Reversal against an emptied connected balance → failure recorded, outstanding amount tracked, no silent success.
18. Chargeback via test dispute card (`4000000000000259`) → `charge.dispute.created` blocks the transfer; `closed` as won releases it, as lost writes it off.
19. Refund on an order that was already backfilled as `transferred` during migration behaves as the post-transfer path.

**Reconciliation and access**
20. Stripe platform balance, transfers report, and `dkai_orders` / `dkai_seller_balances` agree for a full test day.
21. Seller earnings UI shows correct pending vs available vs paid amounts under the new timing.
22. No edge function trusts amount, price or product id from the request body.
23. PayPal checkout path still works and is unaffected.
24. Currency consistency: no order created in a currency other than the platform settlement currency.
