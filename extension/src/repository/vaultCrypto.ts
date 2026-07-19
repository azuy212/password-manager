import { SecureKey } from '@/core/crypto/SecureKey'
import { cryptoProvider } from '../platform/crypto'
import { getPasswordKey, decryptVEK } from '../platform/unlock'

import type { Vault as VaultDomain } from './vaultRepository'

export interface DecryptedEntry {
  id: string
  vaultId: string
  title: string
  username: string
  password: string
  notes: string
  url: string
  extras?: Record<string, string | number | boolean>
  createdAt: number
  updatedAt: number
}

export async function decryptVaultKey(vault: VaultDomain): Promise<SecureKey | null> {
  const vek = await decryptVEK()
  if (!vek) return null
  try {
    const parsed = JSON.parse(vault.encryptedEncryptionKey)
    const dekBytes = await cryptoProvider.decrypt(parsed.ciphertext, vek.toArray(), parsed.nonce, parsed.tag)
    vek.destroy()
    return new SecureKey(dekBytes)
  } catch {
    vek.destroy()
    return null
  }
}

export async function decryptEntryPayload(encryptedPayload: string, dek: SecureKey): Promise<DecryptedEntry | null> {
  try {
    const parsed = JSON.parse(encryptedPayload)
    const decryptedBytes = await cryptoProvider.decrypt(parsed.ciphertext, dek.toArray(), parsed.nonce, parsed.tag)
    const content = JSON.parse(new TextDecoder().decode(new Uint8Array(decryptedBytes)))
    return content as DecryptedEntry
  } catch {
    return null
  }
}

export async function encryptEntryPayload(
  data: Omit<DecryptedEntry, 'id' | 'vaultId' | 'createdAt' | 'updatedAt'>,
  dek: SecureKey,
): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const result = await cryptoProvider.encrypt(Array.from(encoded), dek.toArray())
  return JSON.stringify(result)
}
