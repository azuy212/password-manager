import * as Crypto from 'expo-crypto';
import type { UuidProvider } from './interfaces';

export const uuidProvider: UuidProvider = {
  v4(): string {
    return Crypto.randomUUID();
  },
};
