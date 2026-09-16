// Minimal Stripe REST helper shared by all payment functions.
// Uses the PLATFORM key only. A connected-account context must be passed
// EXPLICITLY (legacy direct-charge servicing only) — new separate charges and
// transfers are always created on the platform account with no Stripe-Account
// header.

const STRIPE_API_VERSION = '2024-06-20';

export function stripeKey(): string {
  const key = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing');
  return key;
}

export interface StripeCallOptions {
  /** Only for legacy direct-charge objects that live on a connected account. */
  stripeAccount?: string;
  idempotencyKey?: string;
  method?: 'GET' | 'POST';
}

export async function stripeCall<T = any>(
  path: string,
  params?: Record<string, string>,
  opts: StripeCallOptions = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const method = opts.method ?? (params ? 'POST' : 'GET');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeKey()}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  if (opts.stripeAccount) headers['Stripe-Account'] = opts.stripeAccount;

  let url = `https://api.stripe.com/v1/${path}`;
  if (method === 'GET' && params) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? new URLSearchParams(params ?? {}) : undefined,
  });
  const data = await res.json();
  return { ok: res.ok && !data?.error, status: res.status, data };
}

export function stripeErrorMessage(data: any): string {
  return data?.error?.message ?? 'Stripe request failed';
}

/** Zero-decimal currencies never get *100. */
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

export function toMinorUnits(amount: number, currency: string): number {
  const cur = currency.toLowerCase();
  if (ZERO_DECIMAL.has(cur)) return Math.round(amount);
  return Math.round(amount * 100);
}

export function fromMinorUnits(minor: number, currency: string): number {
  const cur = currency.toLowerCase();
  if (ZERO_DECIMAL.has(cur)) return minor;
  return Math.round(minor) / 100;
}

export const PLATFORM_CURRENCY = 'chf';
