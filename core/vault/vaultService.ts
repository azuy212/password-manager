import { appStore$ } from '../../store/appStore';
import { uuidv4 } from '@/utils/uuid';
import type { Vault, VaultEntry, VaultEntryInput, VaultInput } from '../../types/vault';
import { encryptString, decryptString, encryptBytes, decryptBytes, SecureKey, generateRandomBytes } from '../crypto';

/** Raw encrypted entry as stored in store */
export interface VaultEntryRaw {
  id: string;
  vaultId: string;
  encryptedPayload: string;
  version?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Decrypt the vault's data encryption key (DEK) using the master key.
 */
export async function decryptVaultKey(
  encryptedEncryptionKey: string,
  masterKey: SecureKey
): Promise<SecureKey> {
  const dekBytes = await decryptBytes(encryptedEncryptionKey, masterKey);
  return new SecureKey(dekBytes);
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

/**
 * Decrypt the entire entry content from one JSON payload
 */
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

/**
 * Get all vaults (metadata only — not encrypted)
 */
export async function getVaults(): Promise<Vault[]> {
  return appStore$.vaults.get();
}

/**
 * Create a new vault.
 */
export async function createVault(input: VaultInput, masterKey: SecureKey): Promise<Vault> {
  // Generate a unique data encryption key for this vault, then encrypt it with the master key
  const vaultKeyBytes = await generateRandomBytes(32);
  const encryptedEncryptionKey = await encryptBytes(vaultKeyBytes, masterKey);

  const newVault: Vault = {
    id: uuidv4(),
    userId: appStore$.userId.peek() ?? '',
    name: input.name,
    encryptedEncryptionKey,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  appStore$.vaults.push(newVault);

  return newVault;
}

/**
 * Soft-delete a vault and all its entries.
 */
export async function deleteVault(vaultId: string): Promise<void> {
  const now = Date.now();

  // Soft-delete the vault
  const vault$ = appStore$.vaults.find(v => v.id.get() === vaultId);
  if (vault$) {
    vault$.deletedAt.set(now);
    vault$.updatedAt.set(now);
  }

  // Soft-delete all entries in the vault
  const entries = appStore$.entries.get();
  Object.keys(entries).forEach(id => {
    if (entries[id].vaultId === vaultId) {
      appStore$.entries[id].assign({
        deletedAt: now,
        updatedAt: now,
      });
    }
  });
}

/**
 * Get all entries for a vault (decrypted), excluding soft-deleted.
 */
export async function getEntriesForVault(vaultId: string, vaultKey: SecureKey): Promise<VaultEntry[]> {
  const entries = appStore$.entries.get();
  const vaultEntries = Object.values(entries).filter(e => e.vaultId === vaultId && !e.deletedAt);

  if (!vaultKey) return [];

  // Decrypt each entry
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
    } catch (e) {
      console.warn('Failed to decrypt entry', entry.id);
    }
  }

  return result;
}

/**
 * Get ALL raw entries for a vault including soft-deleted ones.
 */
export async function getAllRawEntriesForVault(vaultId: string): Promise<VaultEntryRaw[]> {
  const entries = appStore$.entries.get();
  return Object.values(entries).filter((e: any) => e.vaultId === vaultId) as VaultEntryRaw[];
}

/**
 * Create a new vault entry
 */
export async function createEntry(input: VaultEntryInput, vaultKey: SecureKey): Promise<VaultEntry> {
  const now = Date.now();
  const encryptedPayload = await encryptEntryContent(input, vaultKey);

  const id = uuidv4();
  const newEntry = {
    id,
    vaultId: input.vaultId,
    encryptedPayload,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  appStore$.entries[id].set(newEntry);

  // Return the decrypted entry
  const decrypted = await decryptEntryContent(encryptedPayload, vaultKey);
  decrypted.id = newEntry.id;
  decrypted.vaultId = newEntry.vaultId;
  decrypted.createdAt = newEntry.createdAt;
  decrypted.updatedAt = newEntry.updatedAt;
  decrypted.encryptedPayload = encryptedPayload;
  decrypted.version = 1;

  return decrypted;
}

/**
 * Update a vault entry
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<VaultEntryInput>,
  vaultKey: SecureKey
): Promise<VaultEntry | null> {
  const entry$ = appStore$.entries[entryId];
  const existing = entry$.get();
  if (!existing) return null;

  // First decrypt existing entry to get current values
  const current = await decryptEntryContent(existing.encryptedPayload, vaultKey);

  // Merge updates
  const updatedInput: VaultEntryInput = {
    vaultId: existing.vaultId,
    title: updates.title ?? current.title,
    username: updates.username ?? current.username,
    password: updates.password ?? current.password,
    url: updates.url ?? current.url,
    notes: updates.notes ?? current.notes,
  };

  // Re-encrypt everything as one payload
  const encryptedPayload = await encryptEntryContent(updatedInput, vaultKey);

  entry$.assign({
    encryptedPayload,
    updatedAt: Date.now(),
  });

  // Return the decrypted entry
  const decrypted = await decryptEntryContent(encryptedPayload, vaultKey);
  decrypted.id = entryId;
  decrypted.vaultId = existing.vaultId;
  decrypted.createdAt = existing.createdAt;
  decrypted.updatedAt = Date.now();
  decrypted.encryptedPayload = encryptedPayload;
  decrypted.version = existing.version;

  return decrypted;
}

/**
 * Soft-delete a vault entry
 */
export async function deleteEntry(entryId: string): Promise<void> {
  const entry$ = appStore$.entries[entryId];
  if (!entry$.get()) return;

  entry$.assign({
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Re-encrypt all vault DEKs with a new master key.
 * Used during password rotation.
 */
export async function reEncryptVaultKeys(
  oldMasterKey: SecureKey,
  newMasterKey: SecureKey,
): Promise<void> {
  const vaults = appStore$.vaults.get();
  for (const vault of vaults) {
    const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, oldMasterKey);
    const newEncryptedKey = await encryptBytes(vaultKey.toArray(), newMasterKey);
    vaultKey.destroy();
    const idx = appStore$.vaults.get().findIndex(v => v.id === vault.id);
    if (idx !== -1) {
      appStore$.vaults[idx].encryptedEncryptionKey.set(newEncryptedKey);
    }
  }
}

/**
 * Get a single entry by ID (decrypted)
 */
export async function getEntry(entryId: string, vaultKey: SecureKey): Promise<VaultEntry | null> {
  const entry = appStore$.entries[entryId].get();
  if (!entry || !vaultKey) return null;

  try {
    const decrypted = await decryptEntryContent(entry.encryptedPayload, vaultKey);
    decrypted.id = entry.id;
    decrypted.vaultId = entry.vaultId;
    decrypted.createdAt = entry.createdAt;
    decrypted.updatedAt = entry.updatedAt;
    decrypted.encryptedPayload = entry.encryptedPayload;
    return decrypted;
  } catch (e) {
    return null;
  }
}
