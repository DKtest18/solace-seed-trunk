import { db } from '@/lib/dkaiDb';
import {
  hasCurrentSellerAgreement,
  SELLER_AGREEMENT_VERSION,
  type SellerAgreementState,
} from '@/lib/sellerAgreement';

export interface AcceptResult {
  ok: boolean;
  error?: string;
}

const describe = (error: any) =>
  `${error?.message ?? 'Unknown error'}${error?.details ? ` — ${error.details}` : ''}${error?.hint ? ` (hint: ${error.hint})` : ''}${error?.code ? ` [${error.code}]` : ''}`;

const unwrapRow = (data: unknown): any => Array.isArray(data) ? data[0] : data;

export async function getSellerAgreementState(userId?: string): Promise<SellerAgreementState> {
  const { data, error } = await db.rpc('dkai_get_my_seller_agreement');
  if (error) {
    const functionMissing = error.code === 'PGRST202'
      || error.code === '42883'
      || error.message?.includes('dkai_get_my_seller_agreement');
    if (!functionMissing || !userId) throw new Error(describe(error));

    const fallback = await db
      .from('dkai_profiles')
      .select('seller_agreement_accepted, seller_agreement_version')
      .eq('id', userId)
      .maybeSingle();
    if (fallback.error) throw new Error(describe(fallback.error));
    if (!fallback.data) throw new Error('Seller profile was not found for the signed-in account.');
    return fallback.data;
  }

  const row = unwrapRow(data);
  if (!row) throw new Error('Seller profile was not found for the signed-in account.');

  return {
    seller_agreement_accepted: row.seller_agreement_accepted === true,
    seller_agreement_version: row.seller_agreement_version ?? null,
  };
}

/**
 * Records the account-level seller agreement acceptance.
 *
 * Primary path is the SECURITY DEFINER RPC `dkai_accept_seller_agreement`
 * (needed because dkai_profiles uses column-level UPDATE grants).
 * The RPC is self-only and performs its own read-back before returning.
 */
export async function acceptSellerAgreement(
  _userId: string,
  pdfVersion?: string | null,
): Promise<AcceptResult> {
  const { data, error } = await db.rpc('dkai_accept_seller_agreement', {
    p_version: SELLER_AGREEMENT_VERSION,
    p_pdf_version: pdfVersion ?? null,
  });

  if (error) return { ok: false, error: `Acceptance could not be saved: ${describe(error)}` };

  const saved = unwrapRow(data);
  if (hasCurrentSellerAgreement(saved)) return { ok: true };

  return {
    ok: false,
    error: 'The database did not confirm the saved Seller Agreement. Run the provided SQL and try again.',
  };
}
