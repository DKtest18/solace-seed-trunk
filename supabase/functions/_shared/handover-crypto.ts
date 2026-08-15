// AES-256-GCM helpers for buyer-supplied setup credentials.
// The key lives ONLY in the DKAIM_HANDOVER_ENCRYPTION_KEY secret — never in the DB,
// never in the client, and it is never returned to admins.

const b64encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const b64decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('DKAIM_HANDOVER_ENCRYPTION_KEY');
  if (!raw) throw new Error('DKAIM_HANDOVER_ENCRYPTION_KEY is not configured');
  // Accept either a 32-byte base64 key or any passphrase (hashed to 32 bytes).
  let keyBytes: Uint8Array;
  try {
    const decoded = b64decode(raw);
    keyBytes = decoded.length === 32
      ? decoded
      : new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  } catch {
    keyBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

export async function encryptSecret(plaintext: string): Promise<EncryptedPayload> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  // WebCrypto appends the 16-byte tag; store it separately to match the schema.
  const tag = out.slice(out.length - 16);
  const body = out.slice(0, out.length - 16);
  return { ciphertext: b64encode(body), iv: b64encode(iv), auth_tag: b64encode(tag) };
}

export async function decryptSecret(payload: EncryptedPayload): Promise<string> {
  const key = await getKey();
  const body = b64decode(payload.ciphertext);
  const tag = b64decode(payload.auth_tag);
  const combined = new Uint8Array(body.length + tag.length);
  combined.set(body, 0);
  combined.set(tag, body.length);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(payload.iv), tagLength: 128 },
    key,
    combined,
  );
  return new TextDecoder().decode(plain);
}

export function clientMeta(req: Request) {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: req.headers.get('user-agent') ?? null,
  };
}
