

## Fix All Broken Table References, Storage, and Stripe Integration

### Problem Summary
The app has critical errors caused by inconsistent table naming. The `dkai_` prefix convention is not followed everywhere, causing 404 errors (`relation "public.products" does not exist`). Additionally, storage buckets may not be set up, and the Stripe checkout doesn't route 10% to the platform via Stripe Connect.

---

### 1. Fix all `products` -> `dkai_products` references (13 files)

Every file using `supabase.from('products')` must switch to `db.from('dkai_products')`:

| File | Change |
|------|--------|
| `src/components/FeaturedProducts.tsx` | `supabase.from('products')` -> `db.from('dkai_products')` |
| `src/pages/TopProducts.tsx` | Same |
| `src/pages/EditProduct.tsx` | Same (5 occurrences) |
| `src/pages/CreateProduct.tsx` | Same |
| `src/pages/Checkout.tsx` | Same |
| `src/pages/SellerEarnings.tsx` | Same |
| `src/pages/SellerProfile.tsx` | Same |
| `src/pages/MyProducts.tsx` | Same (4 occurrences) |
| `src/pages/Marketplace.tsx` | Same (tags query) |
| `src/pages/Statistics.tsx` | Already uses `db` but wrong table name |
| `src/pages/AdminFeaturedProducts.tsx` | Same |
| `src/pages/ProductCreationSteps/ReviewStep.tsx` | Same |
| `src/components/ProductReviews.tsx` | Same |

### 2. Fix `seller_payment_configs` -> `dkai_seller_payment_configs`

| File | Change |
|------|--------|
| `src/pages/SellerPaymentSettings.tsx` | `supabase.from("seller_payment_configs")` -> `db.from("dkai_seller_payment_configs")` |
| `src/pages/SellerOnboardingPayment.tsx` | Same |
| `src/components/meetings/SellerMeetingsSettings.tsx` | Same |
| `src/components/product-creation/PaymentOptionsStep.tsx` | Same |

### 3. Fix `profiles` -> `dkai_profiles`

In `src/pages/CreateProduct.tsx` line 324: `supabase.from('profiles')` -> `db.from('dkai_profiles')`

### 4. Storage Buckets SQL (run in Supabase SQL Editor)

Provide SQL for `avatars`, `product-images`, and `post-images` buckets with proper RLS policies.

### 5. Fix Stripe Checkout to use Connect with 10% application fee

Update `supabase/functions/create-product-checkout/index.ts`:
- Get the seller's `stripe_account_id` from `dkai_seller_profiles`
- Use Stripe Connect with `application_fee_amount` (10%) and `transfer_data[destination]` to route payment to seller, keeping 10% on the platform

### 6. Fix Stripe Connect Edge Functions

The existing Stripe functions (`stripe-connect-onboard`, `stripe-connect-status`, `stripe-connect-disconnect`, `stripe-connect-dashboard`) use `dkai_seller_profiles` which is correct for the edge function context. Provide the SQL to create these tables if they don't exist.

---

### SQL to Run in Supabase (provide in chat)

```sql
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('product-images', 'product-images', true),
  ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for each bucket (avatars, product-images, post-images)
-- Upload, update, delete, public read policies

-- dkai_seller_profiles table (if not exists)
-- With stripe_account_id, stripe_onboarded columns

-- dkai_seller_payment_configs table (if not exists)  
-- With stripe_account_id, stripe_onboarding_status, card_payments_enabled
```

---

### Technical Details

- All files importing `supabase` directly for table queries will also need `import { db } from '@/lib/dkaiDb'`
- The `db` client is an untyped wrapper that avoids TypeScript errors for `dkai_` tables not in the generated types
- Stripe Connect checkout will use `payment_intent_data[application_fee_amount]` and `payment_intent_data[transfer_data][destination]` to split payments
- The edge function `create-product-checkout` already references `dkai_products` correctly but needs the Connect split logic added

### Estimated Changes
- ~15 frontend files updated (table name fixes)
- 1 edge function updated (Stripe Connect payment split)
- SQL provided in chat for storage + tables

