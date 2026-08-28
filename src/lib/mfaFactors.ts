/**
 * Shared helpers for Supabase Auth native MFA factors (TOTP + phone/SMS).
 *
 * SECURITY: nothing here is a source of truth. Factor ids, types and phone
 * numbers are only ever read back from `supabase.auth.mfa.listFactors()` /
 * `enroll()` responses, and the authoritative gate stays the session `aal`
 * claim (see `useMfaStatus` and `public.dkai_mfa_satisfied()`).
 */

export type MfaFactorType = 'totp' | 'phone';

export interface MfaFactor {
  id: string;
  factorType: MfaFactorType;
  friendlyName: string | null;
  /** Only present for phone factors, as returned by Supabase. */
  phone: string | null;
}

/** Normalises whatever Supabase returns into our narrow factor type. */
export function normalizeFactorType(raw: unknown): MfaFactorType {
  return String(raw ?? '').toLowerCase() === 'phone' ? 'phone' : 'totp';
}

/** Turns a raw listFactors() payload into a deduped list of verified factors. */
export function collectVerifiedFactors(payload: any): MfaFactor[] {
  const raw: any[] = [
    ...((payload?.totp as any[]) ?? []),
    ...((payload?.phone as any[]) ?? []),
    ...((payload?.all as any[]) ?? []),
  ];
  const seen = new Set<string>();
  const out: MfaFactor[] = [];
  for (const f of raw) {
    if (!f?.id || seen.has(f.id)) continue;
    if (f.status !== 'verified') continue;
    seen.add(f.id);
    out.push({
      id: f.id,
      factorType: normalizeFactorType(f.factor_type ?? f.factorType),
      friendlyName: f.friendly_name ?? f.friendlyName ?? null,
      phone: f.phone ?? null,
    });
  }
  return out;
}

// --- Phone number validation (E.164) ---------------------------------------

/** Strips spaces, dashes, dots and brackets but keeps a leading `+`. */
export function normalizePhoneInput(input: string): string {
  const trimmed = input.trim().replace(/[\s\-().]/g, '');
  return trimmed.startsWith('+') ? `+${trimmed.slice(1).replace(/\D/g, '')}` : trimmed.replace(/\D/g, '');
}

export type PhoneValidationError = 'missing_plus' | 'too_short' | 'too_long' | 'invalid_chars' | 'leading_zero';

export interface PhoneValidationResult {
  valid: boolean;
  /** E.164 value to hand to Supabase, only set when `valid` is true. */
  value: string;
  error?: PhoneValidationError;
}

/**
 * Validates a phone number against E.164: `+` then 8-15 digits, first digit
 * of the country code must not be 0.
 */
export function validateE164(input: string): PhoneValidationResult {
  const value = normalizePhoneInput(input);
  if (!value.startsWith('+')) return { valid: false, value: '', error: 'missing_plus' };
  const digits = value.slice(1);
  if (!/^\d+$/.test(digits)) return { valid: false, value: '', error: 'invalid_chars' };
  if (digits.startsWith('0')) return { valid: false, value: '', error: 'leading_zero' };
  if (digits.length < 8) return { valid: false, value: '', error: 'too_short' };
  if (digits.length > 15) return { valid: false, value: '', error: 'too_long' };
  return { valid: true, value };
}

/** Masks a phone number for display: +41 79 ••• •• 12 style. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return phone;
  return `+${digits.slice(0, 2)} ••• ••• ${digits.slice(-2)}`;
}

// --- SMS / provider error mapping ------------------------------------------

/**
 * Maps a Supabase / SMS-provider error to an i18n key under `mfa.smsErrors`.
 * Falls back to `provider` so the raw provider message is always shown next to
 * a human-readable hint instead of a generic toast.
 */
export function smsErrorKey(error: unknown): string {
  const raw = (error as any)?.message ?? String(error ?? '');
  const msg = raw.toLowerCase();
  const status = Number((error as any)?.status ?? 0);

  if (msg.includes('over_sms_send_rate_limit') || msg.includes('rate limit') || status === 429) {
    return 'rateLimit';
  }
  if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('credit')) {
    return 'balance';
  }
  if (
    msg.includes('unsupported') ||
    msg.includes('not supported') ||
    msg.includes('destination') ||
    msg.includes('whitelist') ||
    msg.includes('trial')
  ) {
    return 'unsupportedCountry';
  }
  if (msg.includes('invalid') && msg.includes('phone')) return 'invalidNumber';
  if (msg.includes('already') && (msg.includes('registered') || msg.includes('exists'))) {
    return 'alreadyEnrolled';
  }
  if (msg.includes('sms') || msg.includes('provider') || msg.includes('vonage')) return 'provider';
  return 'provider';
}

/** Raw provider text, surfaced verbatim under the translated hint. */
export function rawErrorMessage(error: unknown): string {
  const raw = (error as any)?.message ?? String(error ?? '');
  return raw.slice(0, 400);
}

// --- Client-side SMS cost guard -------------------------------------------

/** Minimum wait between two SMS sends, in seconds. */
export const SMS_RESEND_COOLDOWN_SECONDS = 60;
/** Hard cap on SMS sends per browser session (every SMS costs real money). */
export const SMS_MAX_SENDS_PER_SESSION = 5;
