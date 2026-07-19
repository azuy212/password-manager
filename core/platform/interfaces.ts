import type { Vault, VaultEntryRaw } from '@/types/vault';

export interface CryptoProvider {
  deriveKey(password: string, salt: number[], iterations: number, keyLength: number): Promise<number[]>
  encrypt(data: number[], keyBytes: number[]): Promise<{ ciphertext: number[]; nonce: number[]; tag: number[] }>
  decrypt(ciphertext: number[], keyBytes: number[], nonce: number[], tag: number[]): Promise<number[]>
  generateSalt(length: number): Promise<number[]>
  generateRandomBytes(length: number): Promise<number[]>
  generateKeyPair(): Promise<{ privateKey: number[]; publicKey: number[] }>
  sign(data: number[], privateKeyBytes: number[]): Promise<number[]>
  verify(data: number[], signatureBytes: number[], publicKeyBytes: number[]): Promise<boolean>
  generateX25519KeyPair(): Promise<{ privateKey: number[]; publicKey: number[] }>
  ecdh(privateKey: number[], publicKey: number[]): Promise<number[]>
  hmacSha256(data: number[], keyBytes: number[]): Promise<number[]>
}

export interface StorageProvider {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  deleteItem(key: string): Promise<void>
}

export interface AsyncStorageProvider {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  multiRemove(keys: string[]): Promise<void>
}

export interface ClipboardProvider {
  setString(text: string): Promise<void>
}

export interface UuidProvider {
  v4(): string
}

export interface StoreProvider {
  getVault(id: string): Promise<Vault | null>
  getVaults(): Promise<Vault[]>
  getEntries(vaultId: string): Promise<VaultEntryRaw[]>
  saveVault(vault: Vault): Promise<void>
  saveEntry(entry: VaultEntryRaw): Promise<void>
  deleteEntry(id: string): Promise<void>
  getUserId(): string | null
}
