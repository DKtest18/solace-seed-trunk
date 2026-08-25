export const SELLER_AGREEMENT_VERSION = '2026-08-15' as const;

/** Version the database trigger/RPC currently requires (fallback only). */
export const SELLER_AGREEMENT_DB_VERSION = '2026-08-17-v4' as const;

export interface SellerAgreementState {
  seller_agreement_accepted?: boolean | null;
  seller_agreement_version?: string | null;
}

/**
 * Acceptance is a single boolean. We intentionally do NOT compare version
 * strings anywhere — version mismatches caused an endless consent loop.
 */
export function hasCurrentSellerAgreement(state?: SellerAgreementState | null): boolean {
  return state?.seller_agreement_accepted === true;
}
