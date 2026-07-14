import { SecureKey, decryptBytes } from './crypto';

let _passwordKey: SecureKey | null = null;
let _encryptedVEKPassword: string | null = null;

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
 * Decrypt VEK from cached encryptedVEKPassword using cached PasswordKey.
 * Caller MUST destroy the returned SecureKey after use.
 * Returns null if either cache is empty.
 */
export async function decryptVEK(): Promise<SecureKey | null> {
  if (!_passwordKey || !_encryptedVEKPassword) return null;
  try {
    const vekBytes = await decryptBytes(_encryptedVEKPassword, _passwordKey);
    return new SecureKey(vekBytes);
  } catch {
    return null;
  }
}

export function destroyAll(): void {
  destroyPasswordKey();
  _encryptedVEKPassword = null;
}

// Backward-compat aliases for gradual migration
export const getMasterKey = getPasswordKey;
export const setMasterKey = setPasswordKey;
export const destroyMasterKey = destroyPasswordKey;
