/**
 * A decrypted vault entry returned by the vault service.
 * All fields are PLAINTEXT (already decrypted).
 * `encryptedPayload` is the raw encrypted blob for cloud sync.
 * `version` tracks server-side revision for optimistic locking.
 * `deletedAt` is set when the entry is soft-deleted locally (pending cloud sync).
 */
export interface VaultEntry {
  id: string;
  vaultId: string;
  title: string;
  username: string;
  password: string;
  notes?: string;
  url?: string;
  extras?: Record<string, string | number | boolean>;
  encryptedPayload?: string; // Raw encrypted blob for sync
  version?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Vault {
  id: string;
  userId: string;
  name: string;
  encryptedEncryptionKey: string;
  version: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating a vault — only name is user-provided.
 * `encryptedEncryptionKey`, `version`, `deletedAt` are set internally.
 */
export type VaultInput = {
  name: string;
};

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
  extras?: Record<string, string | number | boolean>;
};
