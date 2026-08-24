import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchStripeConnectStatus, isStripeConnectedForOnboarding } from '@/lib/stripeConnectStatus';
import { fetchPayPalConnectStatus, isPayPalConnectedForOnboarding } from '@/lib/paypalConnectStatus';
import { hasCurrentSellerAgreement } from '@/lib/sellerAgreement';
import { getSellerAgreementState } from '@/lib/sellerAgreementAccept';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  route: string;
}

export function useSellerOnboardingProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['seller-onboarding-progress', user?.id],
    // Always re-derive from saved DB state on mount — no in-memory drift.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!user) return null;

      const { data: profile } = await db
        .from('dkai_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      const { data: roles } = await db
        .from('dkai_user_roles')
        .select('role')
        .eq('user_id', user.id);
      const { data: sellerApp } = await db
        .from('dkai_seller_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      const paymentRestricted = !!(profile as any)?.payment_settings_restricted;

      // Payment step is complete when EITHER provider is fully connected.
      let stripeConnected = false;
      try {
        if (paymentRestricted) throw new Error('payment settings restricted');
        const stripeData = await fetchStripeConnectStatus();
        stripeConnected = isStripeConnectedForOnboarding(stripeData);
      } catch {
        // ignore
      }
      let paypalConnected = false;
      if (!stripeConnected && !paymentRestricted) {
        try {
          paypalConnected = isPayPalConnectedForOnboarding(await fetchPayPalConnectStatus());
        } catch {
          // ignore
        }
      }
      const paymentConnected = stripeConnected || paypalConnected;

      const isSeller = roles?.some((r: any) => r.role === 'seller');

      // ───── Per-step completion rules (decoupled, all from saved DB state) ─────
      const profileComplete = !!(profile?.full_name && profile?.username);

      const identityFieldsFilled = !!(
        sellerApp?.first_name &&
        sellerApp?.last_name &&
        sellerApp?.creator_name &&
        sellerApp?.country
      );
      const ageComplete = !!profile?.is_age_verified;
      const agreement = await getSellerAgreementState();
      const termsAccepted = hasCurrentSellerAgreement(agreement);

      // Step 1 (identity + age) is complete only when both are persisted.
      const identityAndAgeComplete = identityFieldsFilled && ageComplete;

      // 2FA: authoritative native-MFA status (server RPC first, client factors as fallback).
      let hasVerifiedMfa = false;
      try {
        const { data: mfaRow } = await (supabase as any).rpc('dkai_my_mfa_state');
        const row = Array.isArray(mfaRow) ? mfaRow[0] : mfaRow;
        if (row) hasVerifiedMfa = !!row.has_verified_factor;
      } catch {
        // ignore
      }
      if (!hasVerifiedMfa) {
        try {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const all: any[] = [...((factors as any)?.totp ?? []), ...((factors as any)?.all ?? [])];
          hasVerifiedMfa = all.some((f) => f?.status === 'verified');
        } catch {
          // ignore
        }
      }

      const steps: OnboardingStep[] = [
        { id: 'profile', title: 'Profile Information', description: 'Set your Display Name and Username', required: true, completed: profileComplete, route: '/profile?from=checklist' },
        { id: 'email', title: 'Email Verification', description: 'Verify your email address', required: true, completed: !!user.email_confirmed_at, route: '/settings' },
        { id: '2fa', title: '2FA Setup', description: 'Add two-factor authentication — required for selling', required: true, completed: hasVerifiedMfa, route: '/settings' },
        { id: 'seller-identity-age', title: 'Seller Identity & Age Verification', description: 'Provide your seller details and confirm you are 18+', required: true, completed: identityAndAgeComplete, route: '/seller-onboarding/identity' },
        { id: 'seller-terms', title: 'Seller Terms & Conditions', description: 'Review and accept the seller agreement', required: true, completed: termsAccepted, route: '/seller-onboarding/terms' },
      ];

      // Connecting a payout provider is OPTIONAL: sellers can create their profile and
      // submit products without any dkai_seller_payment_configs row. Restricted accounts
      // never see the step at all.
      if (!paymentRestricted) {
        steps.push({
          id: 'payment',
          title: 'Payment Preferences (optional)',
          description: 'Optional: connect Stripe or PayPal to receive payouts. You can skip this for now.',
          required: false,
          completed: paymentConnected,
          route: '/seller-onboarding/payment',
        });
      }

      const requiredSteps = steps.filter((s) => s.required);
      const completedRequired = requiredSteps.filter((s) => s.completed).length;
      const allRequiredComplete = requiredSteps.every((s) => s.completed);

      return {
        steps,
        requiredSteps,
        completedRequired,
        totalRequired: requiredSteps.length,
        allRequiredComplete,
        isSeller,
        progress: Math.round((completedRequired / requiredSteps.length) * 100),
      };
    },
    enabled: !!user,
  });
}
