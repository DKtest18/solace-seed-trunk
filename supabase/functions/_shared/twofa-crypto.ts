// AES-GCM encryption for 2FA TOTP secrets and peppered hashing for backup
// codes. Key material is taken from the TWO_FA_ENC_KEY environment secret;
// it is hashed to a 32-byte AES-256 key so any sufficiently random string
// works as the configured value.

const ENC_PREFIX = 'v1:';

function getKeyMaterial(): string {
  const key = Deno.env.get('TWO_FA_ENC_KEY');
  if (!key) throw new Error('TWO_FA_ENC_KEY is not configured');
  return key;
}

async function deriveAesKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(getKeyMaterial());
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await deriveAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return ENC_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decryptSecret(stored: string): Promise<string> {
  // Values written before encryption was introduced have no prefix and
  // cannot be recovered — signal the caller to force a re-enrollment.
  if (!stored || !stored.startsWith(ENC_PREFIX)) {
    throw new Error('LEGACY_PLAINTEXT_SECRET');
  }
  const key = await deriveAesKey();
  const combined = Uint8Array.from(
    atob(stored.slice(ENC_PREFIX.length)),
    (c) => c.charCodeAt(0),
  );
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// Peppered SHA-256 hash for backup codes. The pepper is the server-side
// TWO_FA_ENC_KEY and is never stored in the database.
export async function hashBackupCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}:${getKeyMaterial()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
