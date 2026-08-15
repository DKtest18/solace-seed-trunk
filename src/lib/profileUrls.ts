export function normalizeLinkedInUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'linkedin.com' && !hostname.endsWith('.linkedin.com')) return null;

    url.protocol = 'https:';
    url.hostname = 'www.linkedin.com';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
/**
 * Normalizes a free-text website entry into an https/http absolute URL.
 * Returns `null` for empty input and `false` when the value cannot be made valid.
 * Prevents the `dkai_profiles_website_url_scheme` DB constraint from ever firing.
 */
export function normalizeWebsiteUrl(value: string | null | undefined): string | null | false {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Reject anything that looks like a non-web scheme (javascript:, data:, mailto: ...)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) return false;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (!url.hostname.includes('.') || url.hostname.startsWith('.') || url.hostname.endsWith('.')) return false;
    return url.toString().replace(/\/$/, '');
  } catch {
    return false;
  }
}
