# Handover: public previews for products awaiting review

Target project: **existing external Supabase project `dwqpkdatzdqhplgyhigg`**.
Lovable Cloud is not used, enabled or provisioned anywhere in this change.

## Status

| Item | State |
| --- | --- |
| Frontend code | Prepared in this repository (live in the preview) |
| SQL script | Prepared — **not executed**, no Supabase credentials available here |
| Edge Function changes | **None needed** (see below) |
| Live database / storage verification | **Not performed** |

## Step 1 — Run the SQL (only backend step)

1. Open Supabase Dashboard → project `dwqpkdatzdqhplgyhigg` → **SQL Editor** → New query.
2. Paste the full contents of `db/migrations/20260921_public_preview_pending_products.sql` and run it once.
   It is additive and repeat-safe (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`), so re-running is harmless.
3. What it adds:
   - `dkai_products`: `public_preview_enabled` (default **false**), `public_preview_consented_at`,
     `public_preview_consent_source`, `public_preview_demo_video_allowed` (default **false**).
   - `dkai_product_media`: `is_public_preview` (default **false**).
   - Restricted public API (allowlisted fields only, `SECURITY DEFINER`, granted to `anon`/`authenticated`):
     `dkai_public_previews()`, `dkai_public_preview(uuid)`, `dkai_public_preview_media(uuid)`,
     `dkai_preview_eligible(uuid)`.
   - Seller consent RPC `dkai_set_public_preview_consent(uuid, boolean, boolean, text)` — own products only.
   - Trigger `dkai_preview_lifecycle_guard_trg`: leaving `submitted`/`in_review`, deactivation or deletion
     switches the preview off automatically (rejection, approval, suspension, delete).
4. Operations that touch existing data: only the new columns are added, all defaulting to "no consent".
   No existing row changes meaning, no policy is dropped, nothing is deleted.

## Step 2 — Verification queries

Run the queries in the comment block at the end of the SQL file. They report:

- that no consent was invented (`preview_live` must be 0 immediately after the migration),
- how many existing submissions are eligible vs. still need seller confirmation,
- that every preview returns `false` from `dkai_product_purchasable`,
- that media of non-consented products returns no rows.

I cannot run these for you — please paste the output of query (b) and I will report the counts.

## Edge Functions

**No new or modified Edge Function is required.** Purchase protection already lives in
`supabase/functions/_shared/purchasable.ts` + `_shared/separate-checkout.ts`, which call
`public.dkai_product_purchasable(uuid)`. That function requires `review_status IN ('approved',
'locked_exclusive')` plus a connected payout account, and `create-product-checkout` /
`create-checkout-session` call it before any Stripe object is created — for signed-in buyers,
guests and direct API requests alike. A preview (`submitted`/`in_review`) can therefore never be
charged, and nothing about previews is trusted from the request body. No secrets change.

## Storage

No bucket visibility is changed. Deliverables, source/workflow packages, review samples and
credentials stay in their private buckets. Preview media is limited to rows explicitly flagged
`is_public_preview`, and videos additionally require the separate demo-video consent.

Note on media URLs: public preview media is served from URLs that browsers, CDNs and networks may
cache for a while. Withdrawing consent removes the preview and stops new access, but files a
visitor already downloaded cannot be recalled.

## Existing submissions

No consent is backfilled. Sellers see a **"Show public preview" / "Withdraw public preview"**
control on each product in the "In review" tab of *My products*; confirming shows the preview
immediately. New submissions require an explicit acknowledgement checkbox before the publish
action runs, with a separate, unchecked checkbox for the public demo video.
