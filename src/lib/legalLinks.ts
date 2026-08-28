/**
 * Single source of truth for the legal links shown in the footer.
 * Labels are resolved through i18n (`legalLinks.*`) so the footer follows the
 * active language. Every legal page must stay in this list.
 */
export const LEGAL_LINKS: { to: string; key: string }[] = [
  { to: '/impressum', key: 'legalLinks.impressum' },
  { to: '/privacy', key: 'legalLinks.privacy' },
  { to: '/terms', key: 'legalLinks.terms' },
  { to: '/refund-policy', key: 'legalLinks.refund' },
  { to: '/legal/licenses', key: 'legalLinks.licenses' },
  { to: '/cookies', key: 'legalLinks.cookies' },
  { to: '/cookie-settings', key: 'legalLinks.cookieSettings' },
  { to: '/seller-guidelines', key: 'legalLinks.sellerGuidelines' },
  { to: '/legal/content-policy', key: 'legalLinks.contentPolicy' },
];
