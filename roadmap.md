# Roadmap

- [ ] Verify current code, schema/deployment access, and preserve completed Stripe migration work.
- [ ] Finish separate charges and transfers code for new Stripe checkouts without breaking legacy direct-charge servicing.
- [ ] Complete refund, reversal, dispute, worker retry and crash-recovery handling.
- [ ] Finish seller-country onboarding for CH, LI, DE, AT and US.
- [ ] Update seller payout display and public seller wording.
- [ ] Fix login and footer logo display using existing transparent logo assets only.
- [ ] Validate build and critical test-mode scenarios that can run without real payments.
- [ ] Deploy/apply only to the existing external Supabase project if authorized access is available; otherwise provide exact manual steps.
- [ ] Before deployment, verify legacy Stripe charge routing from original checkout context, Swiss-platform country support, external project `dwqpkdatzdqhplgyhigg`, and keep production payout scheduling disabled until explicit approval.
- [x] Add the approved homepage “Network & Tools” section for Nordpixel, Make, and ElevenLabs only; keep the full affiliate disclosure visible, add no tracking, and remove the old decorative icon strip.
