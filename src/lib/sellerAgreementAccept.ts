import { db } from '@/lib/dkaiDb';
import {
  SELLER_AGREEMENT_DB_VERSION,
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
 * Records the account-level seller agreement acceptance with ONE RPC call.
 * The RPC return value IS the confirmation — no follow-up SELECT.
 */
export async function acceptSellerAgreement(
  _userId?: string,
  _pdfVersion?: string | null,
): Promise<AcceptResult> {
  const call = async (version: string) =>
    db.rpc('dkai_accept_seller_agreement', { p_version: version });

  let { data, error } = await call(SELLER_AGREEMENT_VERSION);

  // The deployed trigger/RPC may still pin an older required version string.
  if (error && /version_mismatch/i.test(`${error.message} ${error.details ?? ''}`)) {
    ({ data, error } = await call(SELLER_AGREEMENT_DB_VERSION));
  }

  if (error) {
    console.error('[sellerAgreement] dkai_accept_seller_agreement failed', error);
    return { ok: false, error: describe(error) };
  }

  const saved = unwrapRow(data);
  if (saved?.seller_agreement_accepted === true) return { ok: true };

  console.error('[sellerAgreement] RPC returned unexpected payload', data);
  return { ok: false, error: `Unexpected response from dkai_accept_seller_agreement: ${JSON.stringify(data)}` };
}

