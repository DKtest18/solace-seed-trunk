import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

export const SELLER_AGREEMENT_VERSION = '2026-08-15-v3-en-pdf';

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
      const { data } = await db
        .from('dkai_profiles')
        .select('seller_agreement_accepted, seller_agreement_version, payment_settings_restricted')
        .eq('id', user.id)
        .maybeSingle();

      return {
        paymentSettingsRestricted: !!(data as any)?.payment_settings_restricted,
        agreementAccepted: !!(data as any)?.seller_agreement_accepted,
        agreementVersion: (data as any)?.seller_agreement_version ?? null,
      };
    },
  });
}

export function isSellerAgreementCurrent(r?: SellerRestrictions | null) {
  return !!r && r.agreementAccepted && r.agreementVersion === SELLER_AGREEMENT_VERSION;
}
