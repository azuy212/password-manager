/**
 * Secure storage for web platform.
 * Uses localStorage with AES-GCM encryption via Web Crypto API.
 * Session-based: encryption seed is stored in sessionStorage (cleared on tab close).
 */

// Web encryption key derived once per session
let _encryptionKey: CryptoKey | null = null;

/**
 * Get or create the AES-GCM encryption key from a session-scoped seed
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (_encryptionKey) return _encryptionKey;

  const STORAGE_SEED_KEY = '__pm_web_seed__';
  let seed = sessionStorage.getItem(STORAGE_SEED_KEY);

  if (!seed) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    seed = btoa(String.fromCharCode(...array));
    sessionStorage.setItem(STORAGE_SEED_KEY, seed);
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(seed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  _encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('pm-web-encryption'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return _encryptionKey;
}

/**
 * Encrypt a plaintext value using AES-GCM
 */
async function encrypt(value: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value)
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded ciphertext using AES-GCM
 */
async function decrypt(encryptedValue: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await decrypt(encrypted);
    } catch {
      // Corrupted or tampered data
      localStorage.removeItem(key);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(value);
    localStorage.setItem(key, encrypted);
  },

  async deleteItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  },
};
