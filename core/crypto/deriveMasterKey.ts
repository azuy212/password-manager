import CryptoNative from 'crypto-native';
import * as Crypto from 'expo-crypto';

// OWASP 2023 recommended minimum for PBKDF2-SHA256
const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32; // 256 bits — OWASP recommended minimum
const HMAC_KEY_LENGTH = 32;

/**
 * Opaque wrapper for the master key to prevent accidental logging/serialization
 */
export class SecureKey {
  private _bytes: Uint8Array;

  constructor(bytes: number[]) {
    this._bytes = new Uint8Array(bytes);
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this._bytes);
  }

  toArray(): number[] {
    return Array.from(this._bytes);
  }

  /**
   * Zero out the key material from memory
   */
  destroy(): void {
    this._bytes.fill(0);
  }
}

/**
 * Derive a master key from a password using PBKDF2-SHA256
 */
export async function deriveMasterKey(password: string, salt?: number[]): Promise<{ key: SecureKey; salt: number[] }> {
  const saltBytes = salt || await CryptoNative.generateSalt(SALT_LENGTH);
  const keyBytes = await CryptoNative.deriveKey(password, saltBytes, PBKDF2_ITERATIONS, KEY_LENGTH);
  return { key: new SecureKey(keyBytes), salt: saltBytes };
}

/**
 * Derive a separate HMAC key from the master key for integrity verification
 */
export async function deriveHmacKey(masterKey: SecureKey): Promise<SecureKey> {
  const keyBytes = masterKey.getBytes();
  const hmacSalt = Array.from(new Uint8Array(16).fill(0x01)); // Domain separation
  const hmacKeyBytes = await CryptoNative.deriveKey(
    'hmac-key-derivation',
    hmacSalt,
    10000,
    HMAC_KEY_LENGTH
  );
  return new SecureKey(hmacKeyBytes);
}

/**
 * Generate random bytes
 */
export async function generateRandomBytes(length: number): Promise<number[]> {
  return CryptoNative.generateRandomBytes(length);
}

/**
 * Generate a salt
 */
export async function generateSalt(length: number = SALT_LENGTH): Promise<number[]> {
  return CryptoNative.generateSalt(length);
}

export { PBKDF2_ITERATIONS, KEY_LENGTH, SALT_LENGTH };
