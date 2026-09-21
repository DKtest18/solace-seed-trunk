/**
 * Shared guard for private delivery-file objects.
 *
 * Every object in the private `product-deliveries` bucket MUST live at
 * `<seller_uuid>/<single-filename>`. Without this check a seller could insert a
 * dkai_product_files row whose storage_path points into ANOTHER seller's folder
 * and then have a service-role edge function sign that path for them.
 *
 * Call this before signing any URL or recording any path, using the seller_id
 * stored on the row (never a value taken from the request body).
 */
export function isOwnedDeliveryPath(path: string | null | undefined, sellerId: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) return false;
  const segments = path.split('/');
  if (segments.length !== 2) return false;
  const [folder, file] = segments;
  return folder === sellerId && file.length > 0;
}

/** Content types that browsers can execute; never serve them inline. */
const ACTIVE_CONTENT = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)$/i;
const ACTIVE_EXTENSION = /\.(html?|xhtml|svg|js|mjs|xml|htaccess)$/i;

/** Forces active content to download as an opaque binary instead of rendering. */
export function safeContentType(mime: string, fileName: string): string {
  if (ACTIVE_CONTENT.test(mime) || ACTIVE_EXTENSION.test(fileName)) return 'application/octet-stream';
  return mime || 'application/octet-stream';
}
