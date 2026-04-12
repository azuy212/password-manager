import AsyncStorage from '@react-native-async-storage/async-storage';

import { uuidv4 } from '@/utils/uuid';
import type { Vault, VaultEntry, VaultEntryInput, VaultInput } from '../../types/vault';
import { encryptString, decryptString, SecureKey } from '../crypto';

const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

/** Raw encrypted entry as stored in AsyncStorage */
interface VaultEntryRaw {
  id: string;
  vaultId: string;
  encryptedPayload: string;
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
 * Encrypt the entire entry content as one JSON payload
 */
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
 * Create a new vault
 */
export async function createVault(input: VaultInput, masterKey: SecureKey): Promise<Vault> {
  return withLock(async () => {
    const vaults = await getVaults();

    const newVault: Vault = {
      ...input,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vaults.push(newVault);
    await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));

    return newVault;
  });
}

/**
 * Delete a vault and all its entries
 */
export async function deleteVault(vaultId: string): Promise<void> {
  return withLock(async () => {
    const vaults = await getVaults();
    const filtered = vaults.filter(v => v.id !== vaultId);
    await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(filtered));

    // Delete all entries in the vault
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (stored) {
      const entries: VaultEntryRaw[] = JSON.parse(stored);
      const filtered = entries.filter(e => e.vaultId !== vaultId);
      await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
    }
  });
}

/**
 * Get all entries for a vault (decrypted)
 */
export async function getEntriesForVault(vaultId: string, masterKey: SecureKey): Promise<VaultEntry[]> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return [];

  const entries: VaultEntryRaw[] = JSON.parse(stored);
  const vaultEntries = entries.filter(e => e.vaultId === vaultId);

  if (!masterKey) return [];

  // Decrypt each entry
  const result: VaultEntry[] = [];
  for (const entry of vaultEntries) {
    try {
      const decrypted = await decryptEntryContent(entry.encryptedPayload, masterKey);
      decrypted.id = entry.id;
      decrypted.vaultId = entry.vaultId;
      decrypted.createdAt = entry.createdAt;
      decrypted.updatedAt = entry.updatedAt;
      result.push(decrypted);
    } catch (e) {
      console.warn('Failed to decrypt entry', entry.id);
    }
  }

  return result;
}

/**
 * Create a new vault entry (entire content encrypted as one payload)
 */
export async function createEntry(input: VaultEntryInput, masterKey: SecureKey): Promise<VaultEntry> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    const entries: VaultEntryRaw[] = stored ? JSON.parse(stored) : [];

    const now = Date.now();
    const encryptedPayload = await encryptEntryContent(input, masterKey);

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
    const decrypted = await decryptEntryContent(encryptedPayload, masterKey);
    decrypted.id = newEntry.id;
    decrypted.vaultId = newEntry.vaultId;
    decrypted.createdAt = newEntry.createdAt;
    decrypted.updatedAt = newEntry.updatedAt;
    decrypted.encryptedPayload = encryptedPayload;

    return decrypted;
  });
}

/**
 * Update a vault entry (re-encrypt entire content)
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<VaultEntryInput>,
  masterKey: SecureKey
): Promise<VaultEntry | null> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!stored) return null;

    const entries: VaultEntryRaw[] = JSON.parse(stored);
    const index = entries.findIndex(e => e.id === entryId);
    if (index === -1) return null;

    const existing = entries[index];

    // First decrypt existing entry to get current values
    const current = await decryptEntryContent(existing.encryptedPayload, masterKey);

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
    const encryptedPayload = await encryptEntryContent(updatedInput, masterKey);

    entries[index] = {
      ...existing,
      encryptedPayload,
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));

    // Return the decrypted entry
    const decrypted = await decryptEntryContent(encryptedPayload, masterKey);
    decrypted.id = entries[index].id;
    decrypted.vaultId = entries[index].vaultId;
    decrypted.createdAt = entries[index].createdAt;
    decrypted.updatedAt = entries[index].updatedAt;
    decrypted.encryptedPayload = encryptedPayload;

    return decrypted;
  });
}

/**
 * Delete a vault entry
 */
export async function deleteEntry(entryId: string): Promise<void> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!stored) return;

    const entries: VaultEntryRaw[] = JSON.parse(stored);
    const filtered = entries.filter(e => e.id !== entryId);
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
  });
}

/**
 * Get a single entry by ID (decrypted)
 */
export async function getEntry(entryId: string, masterKey: SecureKey): Promise<VaultEntry | null> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored || !masterKey) return null;

  const entries: VaultEntryRaw[] = JSON.parse(stored);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return null;

  try {
    const decrypted = await decryptEntryContent(entry.encryptedPayload, masterKey);
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
