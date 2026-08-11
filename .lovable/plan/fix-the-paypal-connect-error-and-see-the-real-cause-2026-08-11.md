# Fix the PayPal connect error (and see the real cause)

Not done yet — the "Connect with PayPal" click is failing. Right now all you see is the generic `Edge Function returned a non-2xx status code`, because the frontend throws on the transport error without reading the response body the function sent back. So the first job is to make the real reason visible, then fix it.

Most likely causes, in order:
1. `paypal-connect-onboarding` is not deployed yet, or deployed under a different name.
2. The PayPal secrets are missing/misspelled in Supabase (`DKAIM_PAYPAL_CLIENT_ID`, `DKAIM_PAYPAL_SECRET`, `DKAIM_PAYPAL_ENV`).
3. The PayPal partner-referrals call itself is rejecting the request (partner application still pending / sandbox app not configured for Commerce Platform).
4. The `20260810_paypal_connect.sql` migration was never run, so the function can't write the seller config row.

## What gets changed in the app

- `src/lib/paypalConnectStatus.ts` — in `createPayPalOnboardingLink` and `disconnectPayPal`, read the error response body (`error.context.clone().json()`) the same way `src/lib/paypalCheckout.ts` already does, and surface `error` / `paypal_error` / `detail` in the thrown message. Same treatment for `fetchPayPalConnectStatus`.
- `src/components/seller/PayPalConnectCard.tsx` — show that detailed message in the toast, and keep a copyable detail line in the card when onboarding fails, so a PayPal API rejection is readable without opening the console.

No backend behaviour changes from the app side; Stripe is untouched.

## What you need to check on your side

1. In Supabase, confirm the function list contains exactly `paypal-connect-onboarding`, `paypal-connect-status`, `paypal-connect-disconnect`.
2. Confirm secrets exist: `DKAIM_PAYPAL_CLIENT_ID`, `DKAIM_PAYPAL_SECRET`, `DKAIM_PAYPAL_ENV` (`sandbox`). `DKAIM_PAYPAL_BN_CODE` stays optional.
3. Confirm `db/migrations/20260810_paypal_connect.sql` and `20260811_paypal_checkout.sql` have been run.
4. Open the Edge Function logs for `paypal-connect-onboarding` and send me the last error line.

## Then

Once the real message is visible, I fix the actual cause: either a corrected Supabase AI prompt for the function (given here in chat, as always), the missing SQL, or the PayPal app configuration step.
