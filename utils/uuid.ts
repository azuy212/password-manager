import { uuidProvider } from '@/core/platform/uuid';

/**
 * Generate a UUID v4.
 * Delegates to platform provider (expo-crypto on mobile, Web Crypto on extension).
 */
export function uuidv4(): string {
  return uuidProvider.v4();
}
