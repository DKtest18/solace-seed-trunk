const PRODUCTION_ORIGIN = 'https://dkaimarketplace.com';

/**
 * Stripe return URLs must use a stable, allowlisted origin. Preview hosts are
 * intentionally mapped to production; localhost stays local for development.
 */
export function getCheckoutOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;

  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return origin;
  if (hostname === 'dkaimarketplace.com' || hostname === 'www.dkaimarketplace.com') {
    return PRODUCTION_ORIGIN;
  }
  return PRODUCTION_ORIGIN;
}