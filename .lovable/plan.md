# Fix public marketplace visibility and Stripe checkout

## Scope
- Make English the default for every fresh visitor while preserving an explicit manual language choice.
- Make homepage, marketplace, product detail, and checkout consistently load every admin-approved/published product for signed-in and guest visitors.
- Fix the client checkout payload and redirect handling so the Edge Function receives a safe canonical origin.
- Supply one complete additive SQL script for public grants/RLS, approval auto-publishing, legacy-row normalization, and the public purchasability RPC.
- Supply deploy-ready Supabase AI prompts for the Stripe checkout functions; no Lovable Cloud changes.

## Implementation
1. Remove geo-based automatic language switching and initialize i18n to stored manual choice or English.
2. Centralize the public-product visibility query conditions and apply them to homepage and marketplace, treating legacy null flags safely.
3. Send the canonical production origin from production and localhost only during local development; improve `INVALID_ORIGIN` feedback without hiding server details.
4. Validate the frontend with focused tests/build signals and guest browser checks where the local backend permits.

## Technical requirements for supplied backend changes
- Public `SELECT` is limited by RLS to approved/published products; seller drafts and rejected products remain private.
- Approval sets publication/readiness fields automatically and safely handles optional legacy columns.
- Checkout loads product, price, seller, and Stripe account server-side; request-body price/seller data is never trusted.
- Guest checkout is supported (`buyer_id = NULL`), invalid bearer tokens are rejected, Stripe collects guest email, and redirect origins use an explicit allowlist including `https://dkaimarketplace.com`, `https://www.dkaimarketplace.com`, and the Lovable domains.
