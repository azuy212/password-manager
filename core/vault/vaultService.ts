import AsyncStorage from '@react-native-async-storage/async-storage';

import { uuidv4 } from '@/utils/uuid';
import type { Vault, VaultEntry, VaultEntryInput, VaultInput } from '../../types/vault';
import { encryptString, decryptString, SecureKey, generateRandomBytes } from '../crypto';

const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

/** Raw encrypted entry as stored in AsyncStorage */
export interface VaultEntryRaw {
  id: string;
  vaultId: string;
  encryptedPayload: string;
  version?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Mutex for thread-safe AsyncStorage operations
let asyncLock = Promise.resolve();

/**
 * Execute a function with exclusive access to AsyncStorage
 */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const promise = asyncLock.then(fn, fn);
  asyncLock = promise.then(() => {}, () => {});
  return promise;
}

/**
 * Decrypt the vault's data encryption key (DEK) using the master key.
 */
export async function decryptVaultKey(
  encryptedEncryptionKey: string,
  masterKey: SecureKey
): Promise<SecureKey> {
  const dekString = await decryptString(encryptedEncryptionKey, masterKey);
  // Convert decrypted string back to number[] for SecureKey
  const dekBytes = Array.from(dekString).map(c => c.charCodeAt(0));
  return new SecureKey(dekBytes);
}
async function encryptEntryContent(
  input: VaultEntryInput,
  key: SecureKey
): Promise<string> {
  const content = JSON.stringify({
    title: input.title,
    username: input.username,
    password: input.password,
    notes: input.notes || '',
    url: input.url || '',
  });
  return encryptString(content, key);
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
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Get all vaults (metadata only — not encrypted)
 */
export async function getVaults(): Promise<Vault[]> {
  const stored = await AsyncStorage.getItem(VAULTS_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

/**
 * Create a new vault.
 * The vault's encryption key is derived from the masterKey and stored encrypted.
 */
export async function createVault(input: VaultInput, masterKey: SecureKey): Promise<Vault> {
  return withLock(async () => {
    const vaults = await getVaults();

    // Generate a unique data encryption key for this vault, then encrypt it with the master key
    const vaultKeyBytes = await generateRandomBytes(32);
    const encryptedEncryptionKey = await encryptString(
      String.fromCharCode(...vaultKeyBytes),
      masterKey
    );

    const newVault: Vault = {
      id: uuidv4(),
      name: input.name,
      encryptedEncryptionKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vaults.push(newVault);
    await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));

    return newVault;
  });
}

/**
 * Soft-delete a vault and all its entries (pending cloud sync).
 * Sets deletedAt on the vault and all its entries.
 */
export async function deleteVault(vaultId: string): Promise<void> {
  return withLock(async () => {
    const now = Date.now();

    // Soft-delete the vault
    const vaults = await getVaults();
    const vaultIndex = vaults.findIndex(v => v.id === vaultId);
    if (vaultIndex === -1) return;

    vaults[vaultIndex].deletedAt = now;
    vaults[vaultIndex].updatedAt = now;
    await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));

    // Soft-delete all entries in the vault
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (stored) {
      const entries: VaultEntryRaw[] = JSON.parse(stored);
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].vaultId === vaultId) {
          entries[i].deletedAt = now;
          entries[i].updatedAt = now;
        }
      }
      await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    }
  });
}

/**
 * Get all entries for a vault (decrypted), excluding soft-deleted.
 * Uses the vault's data encryption key (DEK), not the master key.
 */
export async function getEntriesForVault(vaultId: string, vaultKey: SecureKey): Promise<VaultEntry[]> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return [];

  const entries: VaultEntryRaw[] = JSON.parse(stored);
  const vaultEntries = entries.filter(e => e.vaultId === vaultId && !e.deletedAt);

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
 * Used by the sync layer to propagate deletions to the cloud.
 * Returns raw (encrypted) entries — caller handles decryption.
 */
export async function getAllRawEntriesForVault(vaultId: string): Promise<VaultEntryRaw[]> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return [];

  const entries: VaultEntryRaw[] = JSON.parse(stored);
  return entries.filter(e => e.vaultId === vaultId);
}

/**
 * Create a new vault entry (entire content encrypted as one payload)
 * Uses the vault's data encryption key (DEK), not the master key.
 */
export async function createEntry(input: VaultEntryInput, vaultKey: SecureKey): Promise<VaultEntry> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    const entries: VaultEntryRaw[] = stored ? JSON.parse(stored) : [];

    const now = Date.now();
    const encryptedPayload = await encryptEntryContent(input, vaultKey);

    const newEntry = {
      id: uuidv4(),
      vaultId: input.vaultId,
      encryptedPayload,
      createdAt: now,
      updatedAt: now,
    };

    entries.push(newEntry);
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));

    // Return the decrypted entry for immediate display, including the encryptedPayload for sync
    const decrypted = await decryptEntryContent(encryptedPayload, vaultKey);
    decrypted.id = newEntry.id;
    decrypted.vaultId = newEntry.vaultId;
    decrypted.createdAt = newEntry.createdAt;
    decrypted.updatedAt = newEntry.updatedAt;
    decrypted.encryptedPayload = encryptedPayload;
    decrypted.version = 1;

    return decrypted;
  });
}

/**
 * Update a vault entry (re-encrypt entire content)
 * Uses the vault's data encryption key (DEK), not the master key.
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<VaultEntryInput>,
  vaultKey: SecureKey
): Promise<VaultEntry | null> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!stored) return null;

    const entries: VaultEntryRaw[] = JSON.parse(stored);
    const index = entries.findIndex(e => e.id === entryId);
    if (index === -1) return null;

    const existing = entries[index];

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

    entries[index] = {
      ...existing,
      encryptedPayload,
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));

    // Return the decrypted entry
    const decrypted = await decryptEntryContent(encryptedPayload, vaultKey);
    decrypted.id = entries[index].id;
    decrypted.vaultId = entries[index].vaultId;
    decrypted.createdAt = entries[index].createdAt;
    decrypted.updatedAt = entries[index].updatedAt;
    decrypted.encryptedPayload = encryptedPayload;
    decrypted.version = entries[index].version;

    return decrypted;
  });
}

/**
 * Soft-delete a vault entry (marks with deletedAt — synced to cloud on next sync)
 */
export async function deleteEntry(entryId: string): Promise<void> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!stored) return;

    const entries: VaultEntryRaw[] = JSON.parse(stored);
    const index = entries.findIndex(e => e.id === entryId);
    if (index === -1) return;

    // Mark as soft-deleted instead of hard-removing
    entries[index] = {
      ...entries[index],
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  });
}

/**
 * Get a single entry by ID (decrypted)
 * Uses the vault's data encryption key (DEK), not the master key.
 */
export async function getEntry(entryId: string, vaultKey: SecureKey): Promise<VaultEntry | null> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored || !vaultKey) return null;

  const entries: VaultEntryRaw[] = JSON.parse(stored);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return null;

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
