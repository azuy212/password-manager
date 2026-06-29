/**
 * Web-compatible AsyncStorage shim with AES-GCM encryption.
 * Values are encrypted before writing to localStorage and decrypted on read.
 * The encryption key is derived from a session-scoped seed in sessionStorage
 * (cleared on tab close), providing protection for data at rest.
 *
 * Matches the @react-native-async-storage/async-storage API.
 */

const PREFIX = 'RNAsyncStorage_';

let _encryptionKey: CryptoKey | null = null;

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
    ['deriveKey'],
  );

  _encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('pm-web-async-storage'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return _encryptionKey;
}

async function encryptValue(value: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value),
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(encryptedValue: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedValue), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

function prefixedKey(k: string): string {
  return PREFIX + k;
}

const SecureAsyncStorage = {
  async getItem(k: string): Promise<string | null> {
    try {
      const encrypted = localStorage.getItem(prefixedKey(k));
      if (!encrypted) return null;
      return await decryptValue(encrypted);
    } catch {
      return null;
    }
  },

  async setItem(k: string, v: string): Promise<void> {
    try {
      const encrypted = await encryptValue(v);
      localStorage.setItem(prefixedKey(k), encrypted);
    } catch {
      // silently fail (quota exceeded, etc.)
    }
  },

  async removeItem(k: string): Promise<void> {
    try {
      localStorage.removeItem(prefixedKey(k));
    } catch {
      // silently fail
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX)) {
          keys.push(k.slice(PREFIX.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return Promise.all(keys.map(async (k) => [k, await this.getItem(k)]));
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    await Promise.all(keyValuePairs.map(([k, v]) => this.setItem(k, v)));
  },

  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.removeItem(k)));
  },

  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      await this.multiRemove(keys);
    } catch {
      // silently fail
    }
  },
};

export default SecureAsyncStorage;
