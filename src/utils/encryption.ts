/**
 * AES-256-GCM Encryption/Decryption Utilities
 * Uses PLATFORM_ENCRYPTION_KEY for encrypting sensitive data
 * 
 * SECURITY: This module handles encryption of:
 * - IBAN numbers
 * - Bank account details
 * - Payment settings
 * - TOTP/2FA secrets
 * - Any other sensitive user data
 */

export interface EncryptedData {
  iv: string;        // Base64 encoded initialization vector (12 bytes)
  ciphertext: string; // Base64 encoded encrypted data
  tag: string;       // Base64 encoded authentication tag (16 bytes)
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @param key - Base64 encoded encryption key (32 bytes)
 * @returns Encrypted data with IV and auth tag
 */
export async function encryptSensitiveData(
  plaintext: string,
  key: string
): Promise<EncryptedData> {
  if (!plaintext || !key) {
    throw new Error('Plaintext and key are required for encryption');
  }

  // Decode the Base64 key
  const keyData = Uint8Array.from(atob(key), c => c.charCodeAt(0));
  
  // Generate a random 12-byte IV (recommended for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Convert plaintext to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128 // 16 bytes
    },
    cryptoKey,
    data
  );
  
  // Split encrypted data and auth tag
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16);
  const tag = encryptedArray.slice(-16);
  
  // Return Base64 encoded values
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    tag: btoa(String.fromCharCode(...tag))
  };
}

/**
 * Decrypts sensitive data using AES-256-GCM
 * @param encrypted - The encrypted data object
 * @param key - Base64 encoded encryption key (32 bytes)
 * @returns Decrypted plaintext
 */
export async function decryptSensitiveData(
  encrypted: EncryptedData,
  key: string
): Promise<string> {
  if (!encrypted?.iv || !encrypted?.ciphertext || !encrypted?.tag || !key) {
    throw new Error('Invalid encrypted data or key');
  }

  try {
    // Decode Base64 values
    const keyData = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));
    const tag = Uint8Array.from(atob(encrypted.tag), c => c.charCodeAt(0));
    
    // Combine ciphertext and tag
    const encryptedData = new Uint8Array(ciphertext.length + tag.length);
    encryptedData.set(ciphertext, 0);
    encryptedData.set(tag, ciphertext.length);
    
    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      encryptedData
    );
    
    // Convert bytes back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed - data may be corrupted or key incorrect');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Validates that the encryption key is properly formatted
 * @param key - Base64 encoded key to validate
 * @returns true if valid, throws error otherwise
 */
export function validateEncryptionKey(key: string): boolean {
  if (!key) {
    throw new Error('Encryption key is missing');
  }
  
  try {
    const decoded = atob(key);
    if (decoded.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes');
    }
    return true;
  } catch (error) {
    throw new Error('Invalid encryption key format - must be Base64 encoded 32 bytes');
  }
}
