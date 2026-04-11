import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import CryptoNative from 'crypto-native';
import { deriveMasterKey, encryptString, decryptString, SecureKey } from '@/core/crypto';
import type { Identity } from '@/types/identity';

const IDENTITY_KEY = 'identity';
const MAX_UNLOCK_ATTEMPTS = 10;
const ATTEMPT_COUNT_KEY = 'unlock_attempts';
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Keys used by vault service — must be wiped on reset
const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

/**
 * Create a new identity with keypair
 */
export async function createIdentity(password: string): Promise<{ identity: Identity; masterKey: SecureKey }> {
  const id = Crypto.randomUUID();

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
  await SecureStore.deleteItemAsync(ATTEMPT_COUNT_KEY); // Reset attempts

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
 * Returns null if password is wrong or account is locked out
 */
export async function unlockIdentity(password: string): Promise<SecureKey | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  // Check lockout
  const isLockedOut = await checkLockout();
  if (isLockedOut) return null;

  try {
    // Derive key with stored salt
    const { key } = await deriveMasterKey(password, identity.salt);

    // Try to decrypt private key to verify password
    const decrypted = await decryptString(identity.encryptedPrivateKey, key);

    if (decrypted) {
      // Success — reset attempt count
      await SecureStore.deleteItemAsync(ATTEMPT_COUNT_KEY);
      return key;
    }
  } catch {
    // Wrong password — increment attempts
    await incrementUnlockAttempts();
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
    key.destroy(); // Clean up key after use
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
 * Clear identity AND all vault data (full reset)
 */
export async function clearIdentity(): Promise<void> {
  // Clear SecureStore
  await SecureStore.deleteItemAsync(IDENTITY_KEY);
  await SecureStore.deleteItemAsync(ATTEMPT_COUNT_KEY);
  // Clear AsyncStorage (vaults & entries)
  await AsyncStorage.multiRemove([VAULTS_KEY, ENTRIES_KEY]);
}

/**
 * Change password — re-encrypt all data with new password
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  masterKey: SecureKey
): Promise<SecureKey | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  // Verify old password
  const oldKey = await unlockIdentity(oldPassword);
  if (!oldKey) return null;

  // Derive new key
  const { key: newKey, salt: newSalt } = await deriveMasterKey(newPassword);

  // Re-encrypt the private key with the new password
  const privateKey = await decryptString(identity.encryptedPrivateKey, oldKey);
  const encryptedPrivateKey = await encryptString(privateKey, newKey);

  // Update identity
  const updatedIdentity: Identity = {
    ...identity,
    salt: newSalt,
    encryptedPrivateKey,
  };

  await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(updatedIdentity));
  oldKey.destroy();

  return newKey;
}

// --- Rate limiting helpers ---

async function checkLockout(): Promise<boolean> {
  const attemptData = await SecureStore.getItemAsync(ATTEMPT_COUNT_KEY);
  if (!attemptData) return false;

  const { count, timestamp } = JSON.parse(attemptData);

  if (count >= MAX_UNLOCK_ATTEMPTS) {
    const elapsed = Date.now() - timestamp;
    if (elapsed < LOCKOUT_DURATION_MS) {
      return true; // Still locked
    }
    // Lockout expired — reset
    await SecureStore.deleteItemAsync(ATTEMPT_COUNT_KEY);
  }

  return false;
}

async function incrementUnlockAttempts(): Promise<void> {
  const attemptData = await SecureStore.getItemAsync(ATTEMPT_COUNT_KEY);
  const now = Date.now();

  if (attemptData) {
    const { count, timestamp } = JSON.parse(attemptData);
    await SecureStore.setItemAsync(
      ATTEMPT_COUNT_KEY,
      JSON.stringify({ count: count + 1, timestamp })
    );
  } else {
    await SecureStore.setItemAsync(
      ATTEMPT_COUNT_KEY,
      JSON.stringify({ count: 1, timestamp: now })
    );
  }
}
