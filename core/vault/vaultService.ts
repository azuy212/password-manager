import { uuidProvider } from '@/core/platform/uuid';
import { storeProvider } from '@/core/platform/store';
import type { StoreProvider } from '@/core/platform/interfaces';
import type { Vault, VaultEntry, VaultEntryInput, VaultInput, VaultEntryRaw } from '@/types/vault';
import { encryptString, decryptString, encryptBytes, decryptBytes, SecureKey, generateRandomBytes } from '../crypto';
import { decryptVEK, getCachedEncryptedVEK, getPasswordKey } from '../keyStore';

/**
 * Decrypt the vault's DEK using VEK.
 */
export async function decryptVaultKey(
  encryptedEncryptionKey: string,
  vek: SecureKey
): Promise<SecureKey> {
  const dekBytes = await decryptBytes(encryptedEncryptionKey, vek);
  return new SecureKey(dekBytes);
}

/**
 * Derive VEK from cached PasswordKey + encryptedVEKPassword.
 * Used internally by vault operations.
 * Caller MUST destroy the returned VEK after use.
 */
export async function decryptVEKForOperation(): Promise<SecureKey | null> {
  const passwordKey = getPasswordKey();
  const encryptedVEK = getCachedEncryptedVEK();
  if (!passwordKey || !encryptedVEK) return null;
  try {
    const vekBytes = await decryptBytes(encryptedVEK, passwordKey);
    return new SecureKey(vekBytes);
  } catch {
    return null;
  }
}

async function encryptEntryContent(
  input: VaultEntryInput,
  key: SecureKey
): Promise<string> {
  const content: Record<string, unknown> = {
    title: input.title,
    username: input.username,
    password: input.password,
    notes: input.notes || '',
    url: input.url || '',
  };
  if (input.extras && Object.keys(input.extras).length > 0) {
    content.extras = input.extras;
  }
  return encryptString(JSON.stringify(content), key);
}

async function decryptEntryContent(
  encryptedPayload: string,
  key: SecureKey
): Promise<VaultEntry> {
  const contentJson = await decryptString(encryptedPayload, key);
  const content = JSON.parse(contentJson);

  return {
    id: '',
    vaultId: '',
    title: content.title || '',
    username: content.username || '',
    password: content.password || '',
    notes: content.notes || undefined,
    url: content.url || undefined,
    extras: content.extras ?? undefined,
    createdAt: 0,
    updatedAt: 0,
  };
}

export interface VaultService {
  getVaults(): Promise<Vault[]>
  createVault(input: VaultInput, vek: SecureKey): Promise<Vault>
  deleteVault(vaultId: string): Promise<void>
  getEntriesForVault(vaultId: string, vaultKey: SecureKey): Promise<VaultEntry[]>
  getRawEntriesForVault(vaultId: string): Promise<VaultEntryRaw[]>
  createEntry(input: VaultEntryInput, vaultKey: SecureKey): Promise<VaultEntry>
  updateEntry(entryId: string, updates: Partial<VaultEntryInput>, vaultKey: SecureKey): Promise<VaultEntry | null>
  deleteEntry(entryId: string): Promise<void>
  updateVaultEncryptedKey(vaultId: string, newEncryptedKey: string): Promise<void>
  getEntry(entryId: string, vaultKey: SecureKey): Promise<VaultEntry | null>
}

export function createVaultService(store: StoreProvider): VaultService {
  return {
    async getVaults() {
      return store.getVaults();
    },

    async createVault(input, vek) {
      const userId = store.getUserId();
      if (!userId) {
        throw new Error('Cannot create vault: user not authenticated. Please unlock the app first.');
      }

      const vaultKeyBytes = await generateRandomBytes(32);
      const encryptedEncryptionKey = await encryptBytes(vaultKeyBytes, vek);

      const newVault: Vault = {
        id: uuidProvider.v4(),
        userId,
        name: input.name,
        encryptedEncryptionKey,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await store.saveVault(newVault);
      return newVault;
    },

    async deleteVault(vaultId) {
      const now = Date.now();
      const vault = await store.getVault(vaultId);
      if (vault) {
        await store.saveVault({ ...vault, deletedAt: now, updatedAt: now });
      }

      const entries = await store.getEntries(vaultId);
      for (const entry of entries) {
        await store.deleteEntry(entry.id);
      }
    },

    async getEntriesForVault(vaultId, vaultKey) {
      const vaultEntries = await store.getEntries(vaultId);
      if (!vaultKey) return [];

      const result: VaultEntry[] = [];
      for (const entry of vaultEntries) {
        try {
          const decrypted = await decryptEntryContent(entry.encryptedPayload, vaultKey);
          decrypted.id = entry.id;
          decrypted.vaultId = entry.vaultId;
          decrypted.version = entry.version;
          decrypted.createdAt = entry.createdAt;
          decrypted.updatedAt = entry.updatedAt;
          decrypted.encryptedPayload = entry.encryptedPayload;
          result.push(decrypted);
        } catch {
          console.warn('Failed to decrypt entry', entry.id);
        }
      }

      return result;
    },

    async getRawEntriesForVault(vaultId) {
      return store.getEntries(vaultId);
    },

    async createEntry(input, vaultKey) {
      const now = Date.now();
      const encryptedPayload = await encryptEntryContent(input, vaultKey);

      const id = uuidProvider.v4();
      const newEntry: VaultEntryRaw = {
        id,
        vaultId: input.vaultId,
        encryptedPayload,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      await store.saveEntry(newEntry);

      const decrypted = await decryptEntryContent(encryptedPayload, vaultKey);
      decrypted.id = newEntry.id;
      decrypted.vaultId = newEntry.vaultId;
      decrypted.createdAt = newEntry.createdAt;
      decrypted.updatedAt = newEntry.updatedAt;
      decrypted.encryptedPayload = encryptedPayload;
      decrypted.version = 1;

      return decrypted;
    },

    async updateEntry(entryId, updates, vaultKey) {
      const existing = await store.getEntryById(entryId);
      if (!existing) return null;

      const current = await decryptEntryContent(existing.encryptedPayload, vaultKey);

      const updatedInput: VaultEntryInput = {
        vaultId: existing.vaultId,
        title: updates.title ?? current.title,
        username: updates.username ?? current.username,
        password: updates.password ?? current.password,
        url: updates.url ?? current.url,
        notes: updates.notes ?? current.notes,
      };

      const encryptedPayload = await encryptEntryContent(updatedInput, vaultKey);

      await store.saveEntry({
        ...existing,
        encryptedPayload,
        updatedAt: Date.now(),
      });

      const decrypted = await decryptEntryContent(encryptedPayload, vaultKey);
      decrypted.id = entryId;
      decrypted.vaultId = existing.vaultId;
      decrypted.createdAt = existing.createdAt;
      decrypted.updatedAt = Date.now();
      decrypted.encryptedPayload = encryptedPayload;
      decrypted.version = existing.version;

      return decrypted;
    },

    async deleteEntry(entryId) {
      return store.deleteEntry(entryId);
    },

    async updateVaultEncryptedKey(vaultId, newEncryptedKey) {
      const vault = await store.getVault(vaultId);
      if (vault) {
        await store.saveVault({ ...vault, encryptedEncryptionKey: newEncryptedKey });
      }
    },

    async getEntry(entryId, vaultKey) {
      const entry = await store.getEntryById(entryId);
      if (!entry || !vaultKey) return null;

      try {
        const decrypted = await decryptEntryContent(entry.encryptedPayload, vaultKey);
        decrypted.id = entry.id;
        decrypted.vaultId = entry.vaultId;
        decrypted.createdAt = entry.createdAt;
        decrypted.updatedAt = entry.updatedAt;
        decrypted.encryptedPayload = entry.encryptedPayload;
        return decrypted;
      } catch {
        return null;
      }
    },
  };
}

export const vaultService = createVaultService(storeProvider);
