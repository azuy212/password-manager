import { cryptoProvider } from './crypto'
import { supabaseQuery } from '../../popup/messaging'
import { SecureKey } from '@/core/crypto/SecureKey'
import { PBKDF2_ITERATIONS, KEY_LENGTH, SALT_LENGTH } from '@/core/crypto'

let _passwordKey: SecureKey | null = null
let _encryptedVEK: string | null = null

const SESSION_PW_KEY = 'pm_password_key'
const SESSION_EVEK = 'pm_encrypted_vek'

export function getPasswordKey(): SecureKey | null {
  return _passwordKey
}

export function getEncryptedVEK(): string | null {
  return _encryptedVEK
}

export async function destroyAll(): Promise<void> {
  _passwordKey?.destroy()
  _passwordKey = null
  _encryptedVEK = null
  await chrome.storage.session.remove([SESSION_PW_KEY, SESSION_EVEK])
}

export async function persistUnlock(): Promise<void> {
  if (!_passwordKey || !_encryptedVEK) return
  await chrome.storage.session.set({
    [SESSION_PW_KEY]: _passwordKey.toArray(),
    [SESSION_EVEK]: _encryptedVEK,
  })
}

export async function hasCachedUnlock(): Promise<boolean> {
  const data = await chrome.storage.session.get(SESSION_PW_KEY)
  return !!data[SESSION_PW_KEY]
}

export async function restoreCachedUnlock(): Promise<boolean> {
  const data = await chrome.storage.session.get([SESSION_PW_KEY, SESSION_EVEK])
  const pwBytes: number[] | undefined = data[SESSION_PW_KEY]
  const encryptedVEK: string | undefined = data[SESSION_EVEK]
  if (!pwBytes || !encryptedVEK) return false
  _passwordKey = new SecureKey(pwBytes)
  _encryptedVEK = encryptedVEK
  return true
}

export async function decryptVEK(): Promise<SecureKey | null> {
  if (!_passwordKey || !_encryptedVEK) return null
  try {
    const { ciphertext, nonce, tag } = parseEncryptedJson(_encryptedVEK)
    const vekBytes = await cryptoProvider.decrypt(ciphertext, _passwordKey.toArray(), nonce, tag)
    return new SecureKey(vekBytes)
  } catch {
    return null
  }
}

interface UserRow {
  public_key: string
  salt: string
  encrypted_vek_password: string | null
  crypto_version: number
}

function parseEncryptedJson(json: string): { ciphertext: number[]; nonce: number[]; tag: number[] } {
  const parsed = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid encrypted data')
  }
  const { ciphertext, nonce, tag } = parsed as Record<string, unknown>
  if (!Array.isArray(ciphertext) || !Array.isArray(nonce) || !Array.isArray(tag)) {
    throw new Error('Invalid encrypted data')
  }
  return { ciphertext, nonce, tag }
}

async function decryptBytesExt(encryptedJson: string, key: SecureKey): Promise<number[]> {
  const { ciphertext, nonce, tag } = parseEncryptedJson(encryptedJson)
  return cryptoProvider.decrypt(ciphertext, key.toArray(), nonce, tag)
}

async function deriveMasterKeyExt(password: string, salt?: number[]): Promise<{ key: SecureKey; salt: number[] }> {
  const saltBytes = salt ?? (await cryptoProvider.generateSalt(SALT_LENGTH))
  const keyBytes = await cryptoProvider.deriveKey(password, saltBytes, PBKDF2_ITERATIONS, KEY_LENGTH)
  return { key: new SecureKey(keyBytes), salt: saltBytes }
}

export async function fetchUserProfile(userId: string): Promise<
  | { salt: number[]; publicKey: number[]; encryptedVEKPassword: string; cryptoVersion: number }
  | { error: string }
> {
  const data = await supabaseQuery<UserRow>('users', { filters: { id: userId }, single: true })
  if (!data) {
    return { error: 'Failed to fetch user profile' }
  }
  if (!data.encrypted_vek_password) {
    return { error: 'Vault not initialized with VEK. Please use your primary device first.' }
  }
  return {
    salt: JSON.parse(data.salt),
    publicKey: JSON.parse(data.public_key),
    encryptedVEKPassword: data.encrypted_vek_password,
    cryptoVersion: data.crypto_version,
  }
}

export async function unlockVault(
  userId: string,
  password: string,
): Promise<{ success: true } | { error: string }> {
  await destroyAll()

  const profile = await fetchUserProfile(userId)
  if ('error' in profile) {
    return profile as { error: string }
  }

  if (profile.cryptoVersion < 2) {
    return { error: 'Legacy vault format. Please open on your mobile device first to upgrade.' }
  }

  const { key: passwordKey } = await deriveMasterKeyExt(password, profile.salt)

  try {
    const vekBytes = await decryptBytesExt(profile.encryptedVEKPassword, passwordKey)
    const vek = new SecureKey(vekBytes)
    _passwordKey = passwordKey
    _encryptedVEK = profile.encryptedVEKPassword
    await persistUnlock()
    vek.destroy()
    return { success: true }
  } catch {
    passwordKey.destroy()
    return { error: 'Invalid master password.' }
  }
}
