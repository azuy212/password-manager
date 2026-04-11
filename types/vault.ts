export interface VaultEntry {
  id: string;
  vaultId: string;
  title: string;
  username: string;
  encryptedPassword: string;
  encryptedNotes?: string;
  url?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessed?: number;
}

export interface Vault {
  id: string;
  name: string;
  encryptedEncryptionKey: string; // Vault-specific key encrypted with master key
  createdAt: number;
  updatedAt: number;
}

export type VaultEntryInput = Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed'>;
export type VaultInput = Omit<Vault, 'id' | 'createdAt' | 'updatedAt'>;
