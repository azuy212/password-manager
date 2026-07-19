import { cryptoProvider } from '../platform/crypto';
import { SecureKey } from './SecureKey';

const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

/**
 * Derive a master key from a password using PBKDF2-SHA256
 */
export async function deriveMasterKey(password: string, salt?: number[]): Promise<{ key: SecureKey; salt: number[] }> {
  const saltBytes = salt || await cryptoProvider.generateSalt(SALT_LENGTH);
  const keyBytes = await cryptoProvider.deriveKey(password, saltBytes, PBKDF2_ITERATIONS, KEY_LENGTH);
  return { key: new SecureKey(keyBytes), salt: saltBytes };
}

/**
 * Generate random bytes
 */
export async function generateRandomBytes(length: number): Promise<number[]> {
  return cryptoProvider.generateRandomBytes(length);
}

/**
 * Generate a salt
 */
export async function generateSalt(length: number = SALT_LENGTH): Promise<number[]> {
  return cryptoProvider.generateSalt(length);
}

export { PBKDF2_ITERATIONS, KEY_LENGTH, SALT_LENGTH };
