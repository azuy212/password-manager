import { secureStorage } from '@/utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '@/utils/uuid';

import CryptoNative from 'crypto-native';
import { deriveMasterKey, encryptString, decryptString, SecureKey } from '@/core/crypto';
import type { Identity } from '@/types/identity';
import { supabaseSignUp, supabaseSignIn, supabaseSignOut } from './supabaseAuthService';
import { supabase } from '../../services/supabaseClient';

const IDENTITY_KEY = 'identity';
const MAX_UNLOCK_ATTEMPTS = 10;
const ATTEMPT_COUNT_KEY = 'unlock_attempts';
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Keys used by vault service — must be wiped on reset
const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

/**
 * Create a new identity with keypair and register with Supabase Auth.
 * Returns the identity, masterKey, and the Supabase userId.
 */
export async function createIdentity(
  email: string,
  password: string
): Promise<{ identity: Identity; masterKey: SecureKey; supabaseUserId: string } | { error: string }> {
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

  // Store identity locally
  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  await secureStorage.deleteItem(ATTEMPT_COUNT_KEY); // Reset attempts

  // Sign up with Supabase Auth and create the users row
  const authResult = await supabaseSignUp(email, password, publicKey, salt);
  if (!authResult.success) {
    // Rollback: clear local identity since Supabase signup failed
    await secureStorage.deleteItem(IDENTITY_KEY);
    return { error: authResult.error || 'Failed to create Supabase account' };
  }

  return { identity, masterKey: encryptionKey, supabaseUserId: authResult.userId! };
}

/**
 * Bootstrap a second device: derive master key from cloud-fetched salt,
 * then create a local identity so future unlocks work offline.
 */
export async function bootstrapIdentityFromCloud(
  password: string,
  salt: number[],
  publicKey: number[],
  supabaseUserId: string
): Promise<{ identity: Identity; masterKey: SecureKey } | { error: string }> {
  // Generate a NEW Ed25519 keypair for this device
  const { privateKey } = await CryptoNative.generateKeyPair();

  // Derive master key from cloud salt
  const { key: encryptionKey } = await deriveMasterKey(password, salt);

  // Encrypt this device's private key
  const encryptedPrivateKey = await encryptString(
    String.fromCharCode(...privateKey),
    encryptionKey
  );

  const identity: Identity = {
    id: supabaseUserId,
    publicKey,
    encryptedPrivateKey,
    salt,
  };

  // Store locally so future unlocks work
  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);

  return { identity, masterKey: encryptionKey };
}

/**
 * Get stored identity
 */
export async function getIdentity(): Promise<Identity | null> {
  const stored = await secureStorage.getItem(IDENTITY_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
}

/**
 * Unlock identity by deriving master key.
 * Does NOT handle Supabase session — that must be established by the caller first.
 * Returns null if password is wrong or account is locked out.
 * Returns { error: string } if data is corrupted or tampered.
 */
export async function unlockIdentity(password: string): Promise<SecureKey | null | { error: string }> {
  console.log('[identityService] unlockIdentity called');
  const identity = await getIdentity();
  if (!identity) {
    console.log('[identityService] No identity found');
    return null;
  }

  // Check lockout
  const isLockedOut = await checkLockout();
  if (isLockedOut) {
    console.log('[identityService] Account is locked out');
    return { error: 'Account is temporarily locked. Please try again later.' };
  }

  try {
    console.log('[identityService] Deriving master key from password + stored salt...');
    // Derive key with stored salt
    const { key } = await deriveMasterKey(password, identity.salt);
    console.log('[identityService] Master key derived, attempting to decrypt private key...');

    // Try to decrypt private key to verify password
    const decrypted = await decryptString(identity.encryptedPrivateKey, key);
    console.log('[identityService] Decryption result valid:', !!decrypted);

    if (decrypted) {
      // Success — reset attempt count
      console.log('[identityService] Password verified, resetting attempts');
      await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);
      return key;
    }

    // Decryption produced something but it wasn't valid — wrong password
    console.log('[identityService] Decryption invalid — wrong password, destroying key');
    key.destroy();
    return null;
  } catch (err: any) {
    const message = err?.message || '';
    console.error('[identityService] Decryption error:', message);
    // Data corruption/tampering errors should be surfaced to the user
    if (message.includes('Missing HMAC') || message.includes('corrupted') || message.includes('tampered')) {
      return { error: 'Vault data is corrupted. This can happen after an app update or data migration. You may need to reset your vault.' };
    }
    // Unknown errors — surface to user
    if (message.includes('Missing') || message.includes('invalid') || message.includes('failed')) {
      return { error: `Unlock failed: ${message}` };
    }
    // For other errors, still increment attempts but don't expose internals
    await incrementUnlockAttempts();
    return null;
  }
}

/**
 * Get the Supabase user ID from the current session.
 * Returns null if not authenticated.
 */
export async function getStoredSupabaseUserId(): Promise<string | null> {
  console.log('[identityService] getStoredSupabaseUserId called');
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  console.log('[identityService] getStoredSupabaseUserId result:', userId);
  return userId;
}

/**
 * Get decrypted private key
 */
export async function getDecryptedPrivateKey(password: string): Promise<number[] | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  const result = await unlockIdentity(password);
  if (!result || 'error' in result) return null;
  const masterKey = result;

  // Decrypt the private key
  try {
    const decrypted = await decryptString(identity.encryptedPrivateKey, masterKey);
    masterKey.destroy(); // Clean up key after use
    return Array.from(decrypted).map(c => c.charCodeAt(0));
  } catch {
    masterKey.destroy();
    return null;
  }
}

/**
 * Check if identity exists
 */
export async function hasIdentity(): Promise<boolean> {
  const stored = await secureStorage.getItem(IDENTITY_KEY);
  return stored !== null;
}

/**
 * Clear identity AND all vault data (full reset)
 * Also signs out from Supabase and deletes cloud data.
 */
export async function clearIdentity(): Promise<void> {
  const errors: Error[] = [];

  // Sign out from Supabase
  try {
    await supabaseSignOut();
  } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to sign out from Supabase'));
  }

  // Clear SecureStore
  try {
    await secureStorage.deleteItem(IDENTITY_KEY);
  } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to clear identity'));
  }
  try {
    await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);
  } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to clear attempts'));
  }

  // Clear AsyncStorage (vaults & entries)
  try {
    await AsyncStorage.multiRemove([VAULTS_KEY, ENTRIES_KEY]);
  } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to clear vault data'));
  }

  if (errors.length > 0) {
    console.error('clearIdentity encountered errors:', errors.map(e => e.message).join(', '));
  }
}

/**
 * Change password — re-encrypt all data with new password
 * Also updates the Supabase Auth password.
 * Tries Supabase update FIRST so we can rollback if it fails.
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
  if (!oldKey || 'error' in oldKey) return null;

  // Try Supabase password update FIRST (can be retried, no local state changed yet)
  const { error: supabaseError } = await supabase.auth.updateUser({ password: newPassword });
  if (supabaseError) {
    oldKey.destroy();
    console.error('Failed to update Supabase password:', supabaseError);
    return null;
  }

  // Now derive new key and re-encrypt locally
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

  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));
  oldKey.destroy();

  return newKey;
}

// --- Rate limiting helpers ---

async function checkLockout(): Promise<boolean> {
  const attemptData = await secureStorage.getItem(ATTEMPT_COUNT_KEY);
  if (!attemptData) return false;

  const { count, timestamp } = JSON.parse(attemptData);

  if (count >= MAX_UNLOCK_ATTEMPTS) {
    const elapsed = Date.now() - timestamp;
    if (elapsed < LOCKOUT_DURATION_MS) {
      return true; // Still locked
    }
    // Lockout expired — reset
    await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);
  }

  return false;
}

async function incrementUnlockAttempts(): Promise<void> {
  const attemptData = await secureStorage.getItem(ATTEMPT_COUNT_KEY);
  const now = Date.now();

  if (attemptData) {
    const { count, timestamp } = JSON.parse(attemptData);
    await secureStorage.setItem(
      ATTEMPT_COUNT_KEY,
      JSON.stringify({ count: count + 1, timestamp })
    );
  } else {
    await secureStorage.setItem(
      ATTEMPT_COUNT_KEY,
      JSON.stringify({ count: 1, timestamp: now })
    );
  }
}
