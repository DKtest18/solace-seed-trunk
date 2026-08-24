import { db } from '@/lib/dkaiDb';
import { SELLER_AGREEMENT_VERSION } from '@/lib/sellerAgreement';

export interface AcceptResult {
  ok: boolean;
  error?: string;
}

const describe = (error: any) =>
  `${error?.message ?? 'Unknown error'}${error?.details ? ` — ${error.details}` : ''}${error?.hint ? ` (hint: ${error.hint})` : ''}${error?.code ? ` [${error.code}]` : ''}`;

/**
 * Records the account-level seller agreement acceptance.
 *
 * Primary path is the SECURITY DEFINER RPC `dkai_accept_seller_agreement`
 * (needed because dkai_profiles uses column-level UPDATE grants).
 * Falls back to a direct update/upsert if the RPC is not deployed yet.
 */
export async function acceptSellerAgreement(
  userId: string,
  pdfVersion?: string | null,
): Promise<AcceptResult> {
  const rpc = await db.rpc('dkai_accept_seller_agreement', {
    p_version: SELLER_AGREEMENT_VERSION,
    p_pdf_version: pdfVersion ?? null,
  });

  if (!rpc.error) {
    const row: any = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    // The RPC returns jsonb now; older deployments returned a row set.
    if (row?.seller_agreement_accepted === true) return { ok: true };
  }


  const nowIso = new Date().toISOString();
  const payload = {
    seller_agreement_accepted: true,
    seller_agreement_version: SELLER_AGREEMENT_VERSION,
    seller_agreement_accepted_at: nowIso,
    seller_obligations_pdf_acknowledged: true,
    seller_obligations_pdf_version: pdfVersion ?? null,
    terms_accepted: true,
    terms_accepted_at: nowIso,
    updated_at: nowIso,
  };

  const { data: updated, error } = await db
    .from('dkai_profiles')
    .update(payload)
    .eq('id', userId)
    .select('id, seller_agreement_accepted, seller_agreement_version')
    .maybeSingle();

  if (
    !error
    && updated?.seller_agreement_accepted
    && updated?.seller_agreement_version === SELLER_AGREEMENT_VERSION
  ) return { ok: true };

  const { error: upsertError } = await db
    .from('dkai_profiles')
    .upsert({ id: userId, ...payload }, { onConflict: 'id' });

  if (upsertError) {
    return { ok: false, error: describe(rpc.error ?? error ?? upsertError) };
  }

  const { data: verify } = await db
    .from('dkai_profiles')
    .select('seller_agreement_accepted, seller_agreement_version')
    .eq('id', userId)
    .maybeSingle();

  if (verify?.seller_agreement_accepted && verify?.seller_agreement_version === SELLER_AGREEMENT_VERSION) {
    return { ok: true };
  }

  return {
    ok: false,
    error: rpc.error
      ? `Acceptance could not be saved: ${describe(rpc.error)}`
      : 'Acceptance could not be saved to your profile. Please contact support.',
  };
}
