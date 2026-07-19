import { cryptoProvider } from './crypto'
import { sendMessage } from '../../popup/messaging'

const PBKDF2_ITERATIONS = 600000
const KEY_LENGTH = 32
const SALT_LENGTH = 32

export class SecureKey {
  private bytes: Uint8Array

  constructor(bytes: number[]) {
    this.bytes = new Uint8Array(bytes)
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }

  toArray(): number[] {
    return Array.from(this.bytes)
  }

  destroy(): void {
    this.bytes.fill(0)
  }
}

let _passwordKey: SecureKey | null = null
let _encryptedVEK: string | null = null

export function getPasswordKey(): SecureKey | null {
  return _passwordKey
}

export function destroyAll(): void {
  _passwordKey?.destroy()
  _passwordKey = null
  _encryptedVEK = null
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
  const res = await sendMessage<{ data?: UserRow; error?: string }>({
    type: 'SUPABASE_QUERY',
    table: 'users',
    filters: { id: userId },
    single: true,
  })
  if (res.error || !res.data) {
    return { error: res.error ?? 'Failed to fetch user profile' }
  }
  if (!res.data.encrypted_vek_password) {
    return { error: 'Vault not initialized with VEK. Please use your primary device first.' }
  }
  return {
    salt: JSON.parse(res.data.salt),
    publicKey: JSON.parse(res.data.public_key),
    encryptedVEKPassword: res.data.encrypted_vek_password,
    cryptoVersion: res.data.crypto_version,
  }
}

export async function unlockVault(
  userId: string,
  password: string,
): Promise<{ success: true } | { error: string }> {
  destroyAll()

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
    vek.destroy()
    return { success: true }
  } catch {
    passwordKey.destroy()
    return { error: 'Invalid master password.' }
  }
}
