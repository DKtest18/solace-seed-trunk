import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
    queryFn: async () => {
      if (!user) return null;

      const { data: profile } = await db.from('dkai_profiles').select('*').eq('id', user.id).single();
      const { data: roles } = await db.from('dkai_user_roles').select('role').eq('user_id', user.id);
      const { data: sellerApp } = await db.from('dkai_seller_applications').select('*').eq('user_id', user.id).maybeSingle();
      const { data: payoutMethods } = await db.from('dkai_payout_methods').select('*').eq('seller_id', user.id);

      // Check Stripe connection status
      let stripeConnected = false;
      try {
        const { data: stripeData } = await supabase.functions.invoke("stripe-connect-status");
        stripeConnected = stripeData?.connected && (stripeData?.chargesEnabled || stripeData?.charges_enabled);
      } catch {
        // Stripe status check failed, keep false
      }

      const isSeller = roles?.some((r: any) => r.role === 'seller');
      const hasSellerApp = !!sellerApp;
      const identityComplete = hasSellerApp && sellerApp?.status === 'approved';

      const steps: OnboardingStep[] = [
        { id: 'profile', title: 'Profile Information', description: 'Set your Display Name and Username', required: true, completed: !!(profile?.full_name && profile?.username), route: '/profile?from=checklist' },
        { id: 'email', title: 'Email Verification', description: 'Verify your email address', required: true, completed: !!user.email_confirmed_at, route: '/settings' },
        { id: '2fa', title: '2FA Setup', description: 'Optional: Add two-factor authentication for extra security', required: false, completed: !!profile?.is_2fa_enabled, route: '/settings' },
        { id: 'seller-identity', title: 'Seller Identity & Basic Info', description: 'Provide your seller details and accept terms', required: true, completed: identityComplete, route: '/seller-onboarding/identity' },
        { id: 'age-verification', title: 'Age Verification (18+)', description: 'Confirm you are 18 years or older', required: true, completed: identityComplete || !!profile?.is_age_verified, route: '/seller-onboarding/identity' },
        { id: 'payment', title: 'Payment Preferences (Stripe)', description: 'Connect Stripe to receive card payments', required: true, completed: stripeConnected || !!(payoutMethods && payoutMethods.length > 0), route: '/seller-onboarding/payment' },
      ];

      const requiredSteps = steps.filter(s => s.required);
      const completedRequired = requiredSteps.filter(s => s.completed).length;
      const allRequiredComplete = requiredSteps.every(s => s.completed);

      return {
        steps, requiredSteps, completedRequired,
        totalRequired: requiredSteps.length,
        allRequiredComplete, isSeller,
        progress: Math.round((completedRequired / requiredSteps.length) * 100),
      };
    },
    enabled: !!user,
  });
}
