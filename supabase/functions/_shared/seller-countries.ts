// Server-side allowlist of seller (connected account) countries.
// The DB table public.dkai_seller_country_allowlist is the source of truth;
// this constant is the fail-closed fallback when the table cannot be read.
export const FALLBACK_SELLER_COUNTRIES = ['CH', 'LI', 'DE', 'AT', 'US'] as const;

export async function allowedSellerCountries(admin: any): Promise<string[]> {
  const { data, error } = await admin
    .from('dkai_seller_country_allowlist')
    .select('country_code')
    .eq('enabled', true);
  if (error || !data?.length) return [...FALLBACK_SELLER_COUNTRIES];
  return data.map((r: any) => String(r.country_code).toUpperCase());
}

export function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}
