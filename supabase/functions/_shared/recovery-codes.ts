/** Shared helpers for one-time MFA recovery codes. Hashes only — never plaintext. */

function pepper(): string {
  return (
    Deno.env.get('DKAIM_RECOVERY_CODE_PEPPER') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    'dkai-recovery-fallback-pepper'
  );
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`${pepper()}:${normalizeRecoveryCode(code)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}`;
}
