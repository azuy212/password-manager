/**
 * A decrypted vault entry returned by the vault service.
 * All fields are PLAINTEXT (already decrypted).
 */
export interface VaultEntry {
  id: string;
  vaultId: string;
  title: string;
  username: string;
  password: string;
  notes?: string;
  url?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessed?: number;
}

export interface Vault {
  id: string;
  name: string;
  encryptedEncryptionKey: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating or updating a vault entry.
 * All text fields are PLAINTEXT — the vault service encrypts them before storage.
 */
export type VaultEntryInput = {
  vaultId: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
};

export type VaultInput = Omit<Vault, 'id' | 'createdAt' | 'updatedAt'>;
