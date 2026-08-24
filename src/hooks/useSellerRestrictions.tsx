import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { hasCurrentSellerAgreement } from '@/lib/sellerAgreement';
import { getSellerAgreementState } from '@/lib/sellerAgreementAccept';

export interface SellerRestrictions {
  paymentSettingsRestricted: boolean;
  agreementAccepted: boolean;
  agreementVersion: string | null;
}

/**
 * Reads the seller consent + payout restriction flags straight from dkai_profiles.
 * These mirror DB-side triggers — the UI must never invite an action the DB rejects.
 */
export function useSellerRestrictions() {
  const { user } = useAuth();

  return useQuery<SellerRestrictions | null>({
    queryKey: ['seller-restrictions', user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!user) return null;
      const [agreement, profileResult] = await Promise.all([
        getSellerAgreementState(),
        db
        .from('dkai_profiles')
        .select('payment_settings_restricted')
        .eq('id', user.id)
        .maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;

      return {
        paymentSettingsRestricted: !!(profileResult.data as any)?.payment_settings_restricted,
        agreementAccepted: agreement.seller_agreement_accepted === true,
        agreementVersion: agreement.seller_agreement_version ?? null,
      };
    },
  });
}

export function isSellerAgreementCurrent(r?: SellerRestrictions | null) {
  return hasCurrentSellerAgreement(r ? {
    seller_agreement_accepted: r.agreementAccepted,
    seller_agreement_version: r.agreementVersion,
  } : null);
}
