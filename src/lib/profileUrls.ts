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