/**
 * Seller type (private vs. company) helpers for the first onboarding step.
 * Collection only — nothing here is verified against a public registry.
 */

export type SellerTypeValue = 'private' | 'company';

export const LEGAL_FORMS = [
  'einzelunternehmen',
  'gmbh',
  'ag',
  'ug',
  'gbr',
  'ltd',
  'sole_trader',
  'llc',
  'other',
] as const;

export type LegalForm = (typeof LEGAL_FORMS)[number];

const CH_NAMES = ['ch', 'switzerland', 'schweiz', 'suisse', 'svizzera'];
const DE_NAMES = ['de', 'germany', 'deutschland', 'allemagne'];
const AT_NAMES = ['at', 'austria', 'österreich', 'autriche'];

function normalize(country: string | null | undefined) {
  return String(country ?? '').trim().toLowerCase();
}

export function isSwitzerland(country: string | null | undefined) {
  return CH_NAMES.includes(normalize(country));
}

/** i18n key for the registration-number label, localised per country where feasible. */
export function registrationNumberLabelKey(country: string | null | undefined): string {
  const c = normalize(country);
  if (CH_NAMES.includes(c)) return 'sellerType.fields.registrationNumberCh';
  if (DE_NAMES.includes(c)) return 'sellerType.fields.registrationNumberDe';
  if (AT_NAMES.includes(c)) return 'sellerType.fields.registrationNumberAt';
  return 'sellerType.fields.registrationNumber';
}

/** CHE-123.456.789 */
export const CH_UID_REGEX = /^CHE-\d{3}\.\d{3}\.\d{3}$/;

/**
 * Switzerland: strict UID format. Every other country: free text, never blocked
 * on format (only emptiness is checked by the form itself).
 */
export function validateRegistrationNumber(
  country: string | null | undefined,
  value: string,
): { valid: boolean } {
  const trimmed = value.trim();
  if (!isSwitzerland(country)) return { valid: true };
  return { valid: CH_UID_REGEX.test(trimmed.toUpperCase()) };
}
