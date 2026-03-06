// Browser-compatible TOTP implementation using Web Crypto API

/**
 * Generate a cryptographically secure Base32 secret
 * @param length - Length of the secret (default: 32 characters)
 * @returns Base32 encoded secret string
 */
export function generateTOTPSecret(length: number = 32): string {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += base32Chars[randomValues[i] % base32Chars.length];
  }
  return secret;
}

/**
 * Create otpauth URI for QR code generation
 * @param email - User's email address
 * @param secret - Base32 TOTP secret
 * @param issuer - Application name (default: 'DK AI Marketplace')
 * @returns otpauth URI string
 */
export function generateOTPAuthURI(
  email: string, 
  secret: string, 
  issuer: string = 'DK AI Marketplace'
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Decode Base32 string to Uint8Array
 */
function base32Decode(secret: string): Uint8Array {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  
  let bits = '';
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32Chars.indexOf(cleanSecret[i]);
    if (val === -1) throw new Error('Invalid Base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  
  return bytes;
}

/**
 * Generate TOTP code for a given time counter
 */
async function generateTOTPCode(secret: string, timeCounter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  
  // Convert time counter to 8-byte array (big-endian)
  const timeBytes = new Uint8Array(8);
  let counter = timeCounter;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  
  // Import secret key for HMAC-SHA1
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  // Generate HMAC-SHA1 hash
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBytes as unknown as BufferSource);
  const hash = new Uint8Array(signature);
  
  // Dynamic truncation (RFC 6238)
  const offset = hash[hash.length - 1] & 0xf;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

/**
 * Verify TOTP code with time window tolerance
 * @param secret - Base32 TOTP secret
 * @param token - 6-digit code to verify
 * @param window - Time window tolerance (default: 1 = ±30 seconds)
 * @returns true if code is valid, false otherwise
 */
export async function verifyTOTP(
  secret: string, 
  token: string, 
  window: number = 1
): Promise<boolean> {
  if (!secret || !token || token.length !== 6) {
    return false;
  }
  
  try {
    // Current time counter (30-second intervals)
    const currentTime = Math.floor(Date.now() / 1000 / 30);
    
    // Check current time and ±window intervals
    for (let i = -window; i <= window; i++) {
      const timeCounter = currentTime + i;
      const expectedCode = await generateTOTPCode(secret, timeCounter);
      
      if (expectedCode === token) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate current TOTP code (for testing)
 */
export async function getCurrentTOTPCode(secret: string): Promise<string> {
  const currentTime = Math.floor(Date.now() / 1000 / 30);
  return generateTOTPCode(secret, currentTime);
}
