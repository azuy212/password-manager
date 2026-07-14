import { secureStorage } from '@/utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '@/utils/uuid';

import CryptoNative from 'crypto-native';
import { deriveMasterKey, encryptBytes, decryptBytes, generateRandomBytes, SecureKey, generateRecoveryKey, encryptVEKWithRecoveryKey, decryptVEKWithRecoveryKey } from '@/core/crypto';
import { generateX25519KeyPair } from '@/core/crypto/x25519';
import type { Identity } from '@/types/identity';
import { supabaseSignUp, supabaseSignIn, supabaseSignOut } from './supabaseAuthService';
import { supabase } from '../../services/supabaseClient';

const IDENTITY_KEY = 'identity';
const MAX_UNLOCK_ATTEMPTS = 10;
const ATTEMPT_COUNT_KEY = 'unlock_attempts';
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface UnlockResult {
  passwordKey: SecureKey;
  encryptedVEKPassword: string;
}

export interface CreateIdentityResult {
  identity: Identity;
  passwordKey: SecureKey;
  supabaseUserId: string;
}

export interface MigrationResult {
  recoveryKey: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Create Identity (v2 — VEK-based)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a new identity with VEK + RecoveryKey.
 * Private keys are encrypted with VEK (not PasswordKey).
 * Returns { identity, passwordKey, supabaseUserId }.
 * Recovery key is handled via a short-lived local variable in the caller.
 */
export async function createIdentity(
  email: string,
  password: string
): Promise<CreateIdentityResult & { recoveryKey: string } | { error: string }> {
  const id = uuidv4();

  // Generate keypairs
  const { privateKey, publicKey } = await CryptoNative.generateKeyPair();
  const { privateKey: x25519PrivateKey, publicKey: x25519PublicKey } = generateX25519KeyPair();

  // Derive PasswordKey
  const { key: passwordKey, salt } = await deriveMasterKey(password);

  // Generate VEK (root secret)
  const vekBytes = await generateRandomBytes(32);
  const vek = new SecureKey(vekBytes);

  // Encrypt private keys with VEK
  const encryptedPrivateKey = await encryptBytes(privateKey, vek);
  const encryptedX25519PrivateKey = await encryptBytes(x25519PrivateKey, vek);

  // Encrypt VEK with PasswordKey
  const encryptedVEKPassword = await encryptBytes(vekBytes, passwordKey);

  // Generate RecoveryKey and encrypt VEK
  const { bytes: recoveryBytes, formatted: recoveryKeyFormatted } = await generateRecoveryKey();
  const encryptedVEKRecovery = await encryptVEKWithRecoveryKey(vekBytes, recoveryBytes);

  const identity: Identity = {
    id,
    publicKey,
    encryptedPrivateKey,
    salt,
    x25519PublicKey: Array.from(x25519PublicKey),
    encryptedX25519PrivateKey,
    cryptoVersion: 2,
  };

  // Store identity locally
  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);

  // Sign up with Supabase and create users row
  const authResult = await supabaseSignUp(
    email,
    password,
    publicKey,
    salt,
    Array.from(x25519PublicKey),
    encryptedVEKPassword,
    encryptedVEKRecovery,
  );
  if (!authResult.success) {
    await secureStorage.deleteItem(IDENTITY_KEY);
    vek.destroy();
    passwordKey.destroy();
    return { error: authResult.error || 'Failed to create Supabase account' };
  }

  vek.destroy();

  return {
    identity,
    passwordKey,
    supabaseUserId: authResult.userId!,
    recoveryKey: recoveryKeyFormatted,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bootstrap second device
// ────────────────────────────────────────────────────────────────────────────

export async function bootstrapIdentityFromCloud(
  password: string,
  salt: number[],
  publicKey: number[],
  supabaseUserId: string,
  encryptedVEKPassword: string,
): Promise<{ identity: Identity; passwordKey: SecureKey } | { error: string }> {
  const { privateKey } = await CryptoNative.generateKeyPair();
  const { privateKey: x25519PrivateKey, publicKey: x25519PublicKey } = generateX25519KeyPair();

  const { key: passwordKey } = await deriveMasterKey(password, salt);

  // Decrypt VEK from cloud
  let vek: SecureKey;
  try {
    const vekBytes = await decryptBytes(encryptedVEKPassword, passwordKey);
    vek = new SecureKey(vekBytes);
  } catch {
    passwordKey.destroy();
    return { error: 'Failed to decrypt vault. Invalid password or corrupted data.' };
  }

  // Encrypt device-specific private keys with VEK
  const encryptedPrivateKey = await encryptBytes(privateKey, vek);
  const encryptedX25519PrivateKey = await encryptBytes(x25519PrivateKey, vek);

  const identity: Identity = {
    id: supabaseUserId,
    publicKey,
    encryptedPrivateKey,
    salt,
    x25519PublicKey: Array.from(x25519PublicKey),
    encryptedX25519PrivateKey,
    cryptoVersion: 2,
  };

  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);

  vek.destroy();

  return { identity, passwordKey };
}

// ────────────────────────────────────────────────────────────────────────────
// Lock / Unlock
// ────────────────────────────────────────────────────────────────────────────

export async function getIdentity(): Promise<Identity | null> {
  const stored = await secureStorage.getItem(IDENTITY_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
}

export async function hasIdentity(): Promise<boolean> {
  const stored = await secureStorage.getItem(IDENTITY_KEY);
  return stored !== null;
}

/**
 * Unlock identity: derive PasswordKey, decrypt VEK, verify by decrypting private key.
 * Returns PasswordKey and encryptedVEKPassword for caching.
 */
export async function unlockIdentity(
  password: string,
  encryptedVEKPasswordFromCloud: string,
): Promise<UnlockResult | null | { error: string }> {
  const identity = await getIdentity();
  if (!identity) return null;

  const isLockedOut = await checkLockout();
  if (isLockedOut) {
    return { error: 'Account is temporarily locked. Please try again later.' };
  }

  try {
    const { key: passwordKey } = await deriveMasterKey(password, identity.salt);

    // Decrypt VEK from cloud
    let vekBytes: number[];
    try {
      vekBytes = await decryptBytes(encryptedVEKPasswordFromCloud, passwordKey);
    } catch {
      passwordKey.destroy();
      await incrementUnlockAttempts();
      return null; // wrong password
    }

    const vek = new SecureKey(vekBytes);

    // Verify by decrypting Ed25519 private key
    const decrypted = await decryptBytes(identity.encryptedPrivateKey, vek);
    if (decrypted) {
      await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);
      vek.destroy();
      return { passwordKey, encryptedVEKPassword: encryptedVEKPasswordFromCloud };
    }

    vek.destroy();
    passwordKey.destroy();
    return null;
  } catch {
    await incrementUnlockAttempts();
    return null;
  }
}

export async function getDecryptedPrivateKey(
  password: string,
  encryptedVEKPasswordFromCloud: string,
): Promise<number[] | null> {
  const result = await unlockIdentity(password, encryptedVEKPasswordFromCloud);
  if (!result || 'error' in result) return null;

  try {
    const vek = await decryptBytes(result.encryptedVEKPassword, result.passwordKey);
    const identity = await getIdentity();
    if (!identity) return null;
    return await decryptBytes(identity.encryptedPrivateKey, new SecureKey(vek));
  } catch {
    return null;
  } finally {
    result.passwordKey.destroy();
  }
}

export async function getDecryptedX25519PrivateKey(
  passwordKey: SecureKey,
  encryptedVEKPassword: string,
): Promise<number[] | null> {
  const identity = await getIdentity();
  if (!identity?.encryptedX25519PrivateKey) return null;

  try {
    const vekBytes = await decryptBytes(encryptedVEKPassword, passwordKey);
    const vek = new SecureKey(vekBytes);
    const result = await decryptBytes(identity.encryptedX25519PrivateKey, vek);
    vek.destroy();
    return result;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Password Change (VEK re-wrap only — no vault DEK changes)
// ────────────────────────────────────────────────────────────────────────────

export async function changePassword(
  oldPassword: string,
  newPassword: string,
  encryptedVEKPassword: string,
): Promise<SecureKey | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  // Verify old password and decrypt VEK
  const { key: oldKey } = await deriveMasterKey(oldPassword, identity.salt);
  let vekBytes: number[];
  try {
    vekBytes = await decryptBytes(encryptedVEKPassword, oldKey);
  } catch {
    oldKey.destroy();
    return null;
  }
  oldKey.destroy();

  const vek = new SecureKey(vekBytes);

  // Update Supabase Auth password
  const { error: supabaseError } = await (await import('../../services/supabaseClient')).supabase.auth.updateUser({ password: newPassword });
  if (supabaseError) {
    vek.destroy();
    return null;
  }

  // Derive new PasswordKey + new salt
  const { key: newKey, salt: newSalt } = await deriveMasterKey(newPassword);

  // Re-wrap VEK with new PasswordKey
  const newEncryptedVEKPassword = await encryptBytes(vekBytes, newKey);

  // Update identity (new salt, private keys unchanged — still VEK-wrapped)
  const updatedIdentity: Identity = {
    ...identity,
    salt: newSalt,
  };
  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));

  // Update users row in cloud
  const userId = (await (await import('../../services/supabaseClient')).supabase.auth.getSession()).data.session?.user?.id;
  if (userId) {
    await supabase.from('users').update({
      salt: JSON.stringify(newSalt),
      encrypted_vek_password: newEncryptedVEKPassword,
    }).eq('id', userId);
  }

  vek.destroy();

  return newKey;
}

// ────────────────────────────────────────────────────────────────────────────
// Forgot Password — Recovery Key flow
// ────────────────────────────────────────────────────────────────────────────

interface RecoveryChangeResult {
  passwordKey: SecureKey;
  newEncryptedVEKPassword: string;
}

/**
 * Reset password using recovery key.
 * Decrypts VEK from encryptedVEKRecovery, derives new PasswordKey, re-wraps VEK.
 */
export async function changePasswordWithRecoveryKey(
  recoveryKeyInput: string,
  newPassword: string,
): Promise<RecoveryChangeResult | { error: string }> {
  // Fetch user's profile from cloud
  const { data: { session } } = await (await import('../../services/supabaseClient')).supabase.auth.getSession();
  if (!session?.user?.id) {
    return { error: 'Not authenticated. Please sign in first.' };
  }

  const { data: userData, error: fetchError } = await supabase
    .from('users')
    .select('encrypted_vek_recovery, salt')
    .eq('id', session.user.id)
    .single();

  if (fetchError || !userData?.encrypted_vek_recovery) {
    return { error: 'Recovery key not set up for this account.' };
  }

  // Parse recovery key
  const recoveryBytes = (await import('@/core/crypto')).parseRecoveryKey(recoveryKeyInput);
  if (!recoveryBytes) {
    return { error: 'Invalid recovery key format.' };
  }

  // Decrypt VEK
  let vekBytes: number[] | null = null;
  try {
    vekBytes = await decryptVEKWithRecoveryKey(userData.encrypted_vek_recovery, recoveryBytes);
  } catch {
    // Fall through to generic error
  }
  if (!vekBytes) {
    return { error: 'Invalid recovery key.' };
  }

  const vek = new SecureKey(vekBytes);

  // Verify VEK works by decrypting identity private key
  const identity = await getIdentity();
  if (identity?.encryptedPrivateKey) {
    try {
      await decryptBytes(identity.encryptedPrivateKey, vek);
    } catch {
      vek.destroy();
      return { error: 'Invalid recovery key.' };
    }
  }

  // Derive new PasswordKey + salt
  const { key: newKey, salt: newSalt } = await deriveMasterKey(newPassword);

  // Re-wrap VEK
  const newEncryptedVEKPassword = await encryptBytes(vekBytes, newKey);

  // Update identity (new salt, same encrypted keys)
  if (identity) {
    const updatedIdentity: Identity = { ...identity, salt: newSalt };
    await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));
  }

  // Update users row
  await supabase.from('users').update({
    salt: JSON.stringify(newSalt),
    encrypted_vek_password: newEncryptedVEKPassword,
  } as any).eq('id', session.user.id);

  // Also update Supabase Auth password
  await (await import('../../services/supabaseClient')).supabase.auth.updateUser({ password: newPassword }).catch(() => {});

  vek.destroy();

  return { passwordKey: newKey, newEncryptedVEKPassword };
}

// ────────────────────────────────────────────────────────────────────────────
// v1 → v2 Migration
// ────────────────────────────────────────────────────────────────────────────

/**
 * Migrate a v1 user to v2 (VEK-based) architecture.
 * - Decrypts vault DEKs with old PasswordKey
 * - Generates VEK, re-encrypts DEKs with VEK
 * - Re-encrypts private keys with VEK
 * - Creates RecoveryKey
 * - Uploads new metadata to cloud
 *
 * Entry ciphertext is NEVER touched.
 */
export async function migrateV1ToV2(
  password: string,
): Promise<{ recoveryKey: string } | { error: string }> {
  const vaultService = await import('@/core/vault/vaultService');
  const identity = await getIdentity();
  if (!identity) return { error: 'No identity found.' };

  // Derive old PasswordKey
  const { key: oldKey } = await deriveMasterKey(password, identity.salt);

  // Verify password by decrypting Ed25519 private key
  let oldPrivateKey: number[];
  try {
    oldPrivateKey = await decryptBytes(identity.encryptedPrivateKey, oldKey);
  } catch {
    oldKey.destroy();
    return { error: 'Wrong password.' };
  }

  // Generate VEK
  const vekBytes = await generateRandomBytes(32);
  const vek = new SecureKey(vekBytes);

  // Generate RecoveryKey
  const { bytes: recoveryBytes, formatted: recoveryFormatted } = await generateRecoveryKey();

  // Re-encrypt private keys with VEK
  let oldX25519PrivateKey: number[] | undefined;
  if (identity.encryptedX25519PrivateKey) {
    try {
      oldX25519PrivateKey = await decryptBytes(identity.encryptedX25519PrivateKey, oldKey);
    } catch {}
  }

  const newEncryptedPrivateKey = await encryptBytes(oldPrivateKey, vek);
  let newEncryptedX25519PrivateKey = identity.encryptedX25519PrivateKey;
  if (oldX25519PrivateKey) {
    newEncryptedX25519PrivateKey = await encryptBytes(oldX25519PrivateKey, vek);
  }

  // Re-encrypt each vault DEK with VEK
  const vaults = await vaultService.getVaults();
  for (const vault of vaults) {
    try {
      const dekBytes = await decryptBytes(vault.encryptedEncryptionKey, oldKey);
      const newEncryptedDEK = await encryptBytes(dekBytes, vek);
      await vaultService.updateVaultEncryptedKey(vault.id, newEncryptedDEK);
    } catch {
      // Skip failed vaults
    }
  }

  // Encrypt VEK with PasswordKey
  const encryptedVEKPassword = await encryptBytes(vekBytes, oldKey);

  // Encrypt VEK with RecoveryKey
  const encryptedVEKRecovery = await encryptVEKWithRecoveryKey(vekBytes, recoveryBytes);

  // Update local identity
  const updatedIdentity: Identity = {
    ...identity,
    encryptedPrivateKey: newEncryptedPrivateKey,
    encryptedX25519PrivateKey: newEncryptedX25519PrivateKey,
    cryptoVersion: 2,
  };
  await secureStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));

  // Upload to cloud
  const { data: { session } } = await (await import('../../services/supabaseClient')).supabase.auth.getSession();
  if (session?.user?.id) {
    await supabase.from('users').update({
      encrypted_vek_password: encryptedVEKPassword,
      encrypted_vek_recovery: encryptedVEKRecovery,
      crypto_version: 2,
    }).eq('id', session.user.id);
  }

  oldKey.destroy();
  vek.destroy();

  return { recoveryKey: recoveryFormatted };
}

// ────────────────────────────────────────────────────────────────────────────
// Regenerate Recovery Key
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate a new RecoveryKey, re-wrap VEK, update cloud.
 * Requires an unlocked session (cached PasswordKey must be available).
 */
export async function regenerateRecoveryKey(
  encryptedVEKPassword: string,
): Promise<string | null> {
  const { getPasswordKey } = await import('@/core/keyStore');
  const passwordKey = getPasswordKey();
  if (!passwordKey) return null;

  try {
    const vekBytes = await decryptBytes(encryptedVEKPassword, passwordKey);
    const { bytes: newRecoveryBytes, formatted: newFormatted } = await generateRecoveryKey();
    const newEncryptedVEKRecovery = await encryptVEKWithRecoveryKey(vekBytes, newRecoveryBytes);

    const { data: { session } } = await (await import('../../services/supabaseClient')).supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase.from('users').update({
        encrypted_vek_recovery: newEncryptedVEKRecovery,
      }).eq('id', session.user.id);
    }

    return newFormatted;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Fetch cloud crypto params (updated for v2)
// ────────────────────────────────────────────────────────────────────────────

export interface CloudCryptoParams {
  salt: number[];
  publicKey: number[];
  encryptedVEKPassword: string | null;
  encryptedVEKRecovery: string | null;
  cryptoVersion: number;
}

export async function fetchUserProfile(userId: string): Promise<CloudCryptoParams | { error: string }> {
  const { data, error } = await supabase
    .from('users')
    .select('public_key, salt, encrypted_vek_password, encrypted_vek_recovery, crypto_version')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { error: 'Failed to fetch user profile' };
  }

  return {
    salt: JSON.parse(data.salt),
    publicKey: JSON.parse(data.public_key),
    encryptedVEKPassword: data.encrypted_vek_password,
    encryptedVEKRecovery: data.encrypted_vek_recovery,
    cryptoVersion: data.crypto_version,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Clear identity (full reset)
// ────────────────────────────────────────────────────────────────────────────

export async function clearIdentity(): Promise<void> {
  const errors: Error[] = [];

  try { await supabaseSignOut(); } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to sign out'));
  }

  try { await secureStorage.deleteItem(IDENTITY_KEY); } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to clear identity'));
  }
  try { await secureStorage.deleteItem(ATTEMPT_COUNT_KEY); } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to clear attempts'));
  }

  try {
    await AsyncStorage.multiRemove([VAULTS_KEY, ENTRIES_KEY]);
  } catch (e) {
    errors.push(e instanceof Error ? e : new Error('Failed to clear vault data'));
  }

  if (errors.length > 0) {
    console.error('clearIdentity errors:', errors.map(e => e.message).join(', '));
  }
}

export async function getStoredSupabaseUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ────────────────────────────────────────────────────────────────────────────

async function checkLockout(): Promise<boolean> {
  const attemptData = await secureStorage.getItem(ATTEMPT_COUNT_KEY);
  if (!attemptData) return false;

  const { count, timestamp } = JSON.parse(attemptData);
  if (count >= MAX_UNLOCK_ATTEMPTS) {
    const elapsed = Date.now() - timestamp;
    if (elapsed < LOCKOUT_DURATION_MS) return true;
    await secureStorage.deleteItem(ATTEMPT_COUNT_KEY);
  }

  return false;
}

async function incrementUnlockAttempts(): Promise<void> {
  const attemptData = await secureStorage.getItem(ATTEMPT_COUNT_KEY);
  const now = Date.now();

  if (attemptData) {
    const { count, timestamp } = JSON.parse(attemptData);
    await secureStorage.setItem(ATTEMPT_COUNT_KEY, JSON.stringify({ count: count + 1, timestamp }));
  } else {
    await secureStorage.setItem(ATTEMPT_COUNT_KEY, JSON.stringify({ count: 1, timestamp: now }));
  }
}
