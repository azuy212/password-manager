import * as Crypto from 'expo-crypto';

/**
 * Generate a UUID v4 using expo-crypto's native implementation
 */
export function uuidv4(): string {
  return Crypto.randomUUID();
}
