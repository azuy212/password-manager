import { SecureKey, decryptBytes } from './crypto';

let _passwordKey: SecureKey | null = null;
let _encryptedVEKPassword: string | null = null;
let _vek: SecureKey | null = null;

export function getPasswordKey(): SecureKey | null {
  return _passwordKey;
}

export function setPasswordKey(key: SecureKey | null): void {
  if (_passwordKey) _passwordKey.destroy();
  _passwordKey = key;
}

export function destroyPasswordKey(): void {
  if (_passwordKey) _passwordKey.destroy();
  _passwordKey = null;
}

export function getCachedEncryptedVEK(): string | null {
  return _encryptedVEKPassword;
}

export function setCachedEncryptedVEK(encrypted: string | null): void {
  _encryptedVEKPassword = encrypted;
}

/**
 * Cache the decrypted VEK directly (e.g. after biometric unlock).
 * Caller should NOT destroy the VEK after passing it here.
 */
export function setCachedVEK(vek: SecureKey | null): void {
  if (_vek) _vek.destroy();
  _vek = vek;
}

/** Returns cached VEK if available, or null. */
export function getCachedVEK(): SecureKey | null {
  return _vek ? new SecureKey(_vek.toArray()) : null;
}

/**
 * Decrypt VEK from cached encryptedVEKPassword using cached PasswordKey.
 * Falls back to cached VEK (from biometric unlock) if passwordKey is not available.
 * Caller MUST destroy the returned SecureKey after use.
 * Returns null if no key material is available.
 */
export async function decryptVEK(): Promise<SecureKey | null> {
  if (_passwordKey && _encryptedVEKPassword) {
    try {
      const vekBytes = await decryptBytes(_encryptedVEKPassword, _passwordKey);
      return new SecureKey(vekBytes);
    } catch {
      return null;
    }
  }
  if (_vek) {
    return new SecureKey(_vek.toArray());
  }
  return null;
}

export function destroyAll(): void {
  destroyPasswordKey();
  _encryptedVEKPassword = null;
  if (_vek) _vek.destroy();
  _vek = null;
}

// Backward-compat aliases for gradual migration
export const getMasterKey = getPasswordKey;
export const setMasterKey = setPasswordKey;
export const destroyMasterKey = destroyPasswordKey;
