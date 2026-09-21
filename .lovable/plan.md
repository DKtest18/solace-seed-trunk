# Public previews for products awaiting review

## What exists today (inspection summary)

- Product lifecycle lives in one place (`draft → submitted → in_review → approved / changes_requested / rejected / delisted`), shared by the app and the backend functions.
- Marketplace, homepage, top products and the product page all load **only** `approved + published` products. Nothing else is visible to visitors.
- Buying is already blocked on the server: every checkout entry point (signed-in and guest) first calls the existing purchasability check, which requires approval, publication and a genuinely connected payout account. A preview therefore cannot be bought even by sending a request directly — this stays the single source of truth.
- Product images/videos come from a media table; product deliverables, review samples and credentials live in separate private storage that visitors never touch.
- Three languages (EN/DE/FR) are already wired through the existing translation files.

Conclusion: previews are a **new, consent-gated visibility layer**. Purchase protection needs no weakening and no new bypass.

## What will be added

### 1. Seller consent (new, off by default)
- A new optional, unchecked control in the seller submission/edit flow: "Show a public preview of this listing while it is under review".
- A separate, also unchecked control for the demo video: internal review videos stay private unless the seller ticks the public-demo box.
- Plain-language list of exactly what becomes public: title, description, approved preview images, planned price, public seller name, and the public features/requirements/setup text.
- Sellers can withdraw consent at any time; withdrawal removes the preview instantly, including direct links and preview-only media.

### 2. Public preview visibility
- Previews appear only for products that are genuinely submitted or in review and have consent. Drafts, rejected, withdrawn, suspended, delisted and deleted products never appear.
- Marketplace, search and category results include previews after all purchasable products.
- Preview cards carry a text badge — EN "Under review", DE "In Prüfung", FR "En cours d'examen" — plus the availability line "Preview only — not yet available for purchase." (translated). Readable without colour, keyboard accessible.
- New "Available to buy" filter lets visitors hide previews.

### 3. Preview detail page
- Reuses the existing product page layout, but shows only allowlisted public fields, no purchase/cart/download actions, and a prominent notice that the product is awaiting review and not approved or available for purchase.
- Planned price is labelled "Planned price — subject to change"; no release date.
- Seller identity badges are visually and textually separated from product approval.

### 4. Data protection
- A restricted database view/function returns only the allowlisted public preview fields — private columns never reach the browser.
- No private storage bucket is made public. Public preview media is limited to assets the seller explicitly marked public.
- Row-level rules ensure that knowing a product ID or guessing a file path exposes nothing.

### 5. Lifecycle correctness
- Consent is stored separately from review status; turning a preview on never approves anything or marks payouts ready.
- After approval: if payouts are still missing, the listing shows an accurate "not yet available" state instead of "under review".
- Rejection, suspension, withdrawal or consent removal drops the preview immediately.
- Founding-seller benefits, commissions and review priority are untouched.

## Backend handover (your external Supabase project `dwqpkdatzdqhplgyhigg`)

I have no credentials for your Supabase project in this environment, so I cannot run SQL or deploy functions. I will prepare everything in the repository and hand you:

1. One additive, repeat-safe SQL script (new consent columns, public-preview media flag, restricted public view, row-level policies, grants) with execution order and verification queries.
2. The complete source of any changed function plus exact deployment steps and a copy-paste Supabase AI prompt.
3. Verification queries to confirm nothing existing changed.

Nothing will be claimed as deployed.

## One thing I need from you

I cannot read your live database, so I cannot identify Andrian Vladyka's seller account or his submitted products and demo video. I will include a short lookup query in the handover; please send me his account ID, the product IDs and which video file is the public demo, and I will record his LinkedIn-sourced authorisation with the real timestamp of entry. Until then his listings stay private and his permission is applied to nobody else.

## Validation planned

Build and TypeScript checks, browser checks of marketplace/preview page/filters on desktop and mobile, confirmation that non-consented and non-eligible products stay invisible, that direct checkout requests for previews fail server-side, and that existing purchasable products still work.
