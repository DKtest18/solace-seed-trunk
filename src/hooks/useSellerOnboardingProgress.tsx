import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

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

      const isSeller = roles?.some((r: any) => r.role === 'seller');
      const hasSellerApp = !!sellerApp;

      const steps: OnboardingStep[] = [
        { id: 'profile', title: 'Profile Information', description: 'Complete your basic profile with name and avatar', required: true, completed: !!(profile?.full_name && profile?.avatar_url), route: '/profile' },
        { id: 'email', title: 'Email Verification', description: 'Verify your email address', required: true, completed: !!user.email_confirmed_at, route: '/settings' },
        { id: '2fa', title: '2FA Setup', description: 'Optional: Add two-factor authentication for extra security', required: false, completed: !!profile?.is_2fa_enabled, route: '/settings' },
        { id: 'seller-identity', title: 'Seller Identity & Basic Info', description: 'Provide your seller details and accept terms', required: true, completed: hasSellerApp && sellerApp?.status === 'approved', route: '/seller-onboarding/identity' },
        { id: 'age-verification', title: 'Age Verification (18+)', description: 'Confirm you are 18 years or older', required: true, completed: !!profile?.is_age_verified, route: '/seller-onboarding/identity' },
        { id: 'payment', title: 'Payment Preferences', description: 'Set up at least one payment method', required: true, completed: !!(payoutMethods && payoutMethods.length > 0), route: '/seller-onboarding/payment' },
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
