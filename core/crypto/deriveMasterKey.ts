import CryptoNative from 'crypto-native';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16;

/**
 * Derive a master key from a password using PBKDF2-SHA256
 */
export async function deriveMasterKey(password: string, salt?: number[]): Promise<{ key: number[]; salt: number[] }> {
  const saltBytes = salt || await CryptoNative.generateSalt(SALT_LENGTH);
  const key = await CryptoNative.deriveKey(password, saltBytes, PBKDF2_ITERATIONS, KEY_LENGTH);
  return { key, salt: saltBytes };
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
