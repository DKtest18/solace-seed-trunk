export const SELLER_AGREEMENT_VERSION = '2026-08-17-v4' as const;

export interface SellerAgreementState {
  seller_agreement_accepted?: boolean | null;
  seller_agreement_version?: string | null;
}

export function hasCurrentSellerAgreement(state?: SellerAgreementState | null): boolean {
  return state?.seller_agreement_accepted === true
    && state.seller_agreement_version === SELLER_AGREEMENT_VERSION;
}