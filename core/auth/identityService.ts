import * as SecureStore from 'expo-secure-store';
import { uuidv4 } from '../../utils/uuid';
import CryptoNative from 'crypto-native';

import { deriveMasterKey, encryptString, decryptString } from '@/core/crypto';
import type { Identity } from '@/types/identity';

const IDENTITY_KEY = 'identity';
const UNLOCKED_KEY = 'unlocked_master_key';

/**
 * Create a new identity with keypair
 */
export async function createIdentity(password: string): Promise<{ identity: Identity; masterKey: number[] }> {
  const id = uuidv4();

  // Generate keypair
  const { privateKey, publicKey } = await CryptoNative.generateKeyPair();

  // Derive a key from password to encrypt the private key
  const { key: encryptionKey, salt } = await deriveMasterKey(password);

  // Encrypt the private key
  const encryptedPrivateKey = await encryptString(
    String.fromCharCode(...privateKey),
    encryptionKey
  );

  const identity: Identity = {
    id,
    publicKey,
    encryptedPrivateKey,
    salt,
  };

  // Store identity securely
  await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(identity));

  return { identity, masterKey: encryptionKey };
}

/**
 * Get stored identity
 */
export async function getIdentity(): Promise<Identity | null> {
  const stored = await SecureStore.getItemAsync(IDENTITY_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
}

/**
 * Unlock identity by deriving master key
 */
export async function unlockIdentity(password: string): Promise<number[] | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  try {
    // Derive key with stored salt
    const { key } = await deriveMasterKey(password, identity.salt);

    // Try to decrypt private key to verify password
    const decrypted = await decryptString(identity.encryptedPrivateKey, key);

    if (decrypted) {
      return key;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Get decrypted private key
 */
export async function getDecryptedPrivateKey(password: string): Promise<number[] | null> {
  const identity = await getIdentity();
  if (!identity) return null;
  
  try {
    const { key } = await deriveMasterKey(password, identity.salt);
    const decrypted = await decryptString(identity.encryptedPrivateKey, key);
    return Array.from(decrypted).map(c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Check if identity exists
 */
export async function hasIdentity(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(IDENTITY_KEY);
  return stored !== null;
}

/**
 * Clear identity (for logout/reset)
 */
export async function clearIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(IDENTITY_KEY);
}
