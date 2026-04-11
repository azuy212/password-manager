import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { Vault, VaultEntry, VaultEntryInput, VaultInput } from '../../types/vault';
import { encryptString, decryptString, SecureKey } from '../crypto';

const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

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
 * Encrypt all fields of a vault entry before storage
 */
async function encryptEntry(input: VaultEntryInput, key: SecureKey): Promise<VaultEntry> {
  const encryptedTitle = await encryptString(input.title, key);
  const encryptedUsername = await encryptString(input.username, key);
  const encryptedUrl = input.url ? await encryptString(input.url, key) : undefined;

  return {
    id: Crypto.randomUUID(),
    vaultId: input.vaultId,
    title: encryptedTitle,
    username: encryptedUsername,
    encryptedPassword: input.encryptedPassword,
    encryptedNotes: input.encryptedNotes,
    url: encryptedUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Decrypt all fields of a vault entry after retrieval
 */
async function decryptEntry(entry: VaultEntry, key: SecureKey): Promise<VaultEntry> {
  try {
    const title = await decryptString(entry.title, key);
    const username = await decryptString(entry.username, key);
    const url = entry.url ? await decryptString(entry.url, key) : undefined;
    const encryptedNotes = entry.encryptedNotes ? await decryptString(entry.encryptedNotes, key) : undefined;

    return { ...entry, title, username, url, encryptedNotes };
  } catch (e) {
    // If decryption fails, return the entry as-is (may be corrupted)
    console.warn('Failed to decrypt entry', entry.id);
    return entry;
  }
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
      id: Crypto.randomUUID(),
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
    const entries = await getEntriesForVault(vaultId);
    for (const entry of entries) {
      await deleteEntry(entry.id);
    }
  });
}

/**
 * Get all entries for a vault (decrypted)
 */
export async function getEntriesForVault(vaultId: string, masterKey?: SecureKey): Promise<VaultEntry[]> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return [];

  const entries: VaultEntry[] = JSON.parse(stored);
  const vaultEntries = entries.filter(e => e.vaultId === vaultId);

  if (masterKey) {
    return Promise.all(vaultEntries.map(e => decryptEntry(e, masterKey)));
  }

  return vaultEntries;
}

/**
 * Create a new vault entry (all fields encrypted)
 */
export async function createEntry(input: VaultEntryInput, masterKey: SecureKey): Promise<VaultEntry> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    const entries: VaultEntry[] = stored ? JSON.parse(stored) : [];

    // Encrypt all fields before storing
    const encryptedInput: VaultEntryInput = {
      ...input,
      title: input.title,
      username: input.username,
      encryptedPassword: input.encryptedPassword,
      url: input.url,
      encryptedNotes: input.encryptedNotes,
    };

    const newEntry = await encryptEntry(encryptedInput, masterKey);
    entries.push(newEntry);
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));

    return newEntry;
  });
}

/**
 * Update a vault entry (re-encrypt all fields)
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<VaultEntryInput>,
  masterKey: SecureKey
): Promise<VaultEntry | null> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!stored) return null;

    const entries: VaultEntry[] = JSON.parse(stored);
    const index = entries.findIndex(e => e.id === entryId);
    if (index === -1) return null;

    // Re-encrypt updated fields
    const updatedInput: VaultEntryInput = {
      vaultId: entries[index].vaultId,
      title: updates.title ?? entries[index].title,
      username: updates.username ?? entries[index].username,
      encryptedPassword: updates.encryptedPassword ?? entries[index].encryptedPassword,
      url: updates.url ?? entries[index].url,
      encryptedNotes: updates.encryptedNotes ?? entries[index].encryptedNotes,
    };

    const reEncrypted = await encryptEntry(updatedInput, masterKey);
    reEncrypted.id = entryId;
    reEncrypted.createdAt = entries[index].createdAt;
    reEncrypted.updatedAt = Date.now();

    entries[index] = reEncrypted;
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    return entries[index];
  });
}

/**
 * Delete a vault entry
 */
export async function deleteEntry(entryId: string): Promise<void> {
  return withLock(async () => {
    const stored = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!stored) return;

    const entries: VaultEntry[] = JSON.parse(stored);
    const filtered = entries.filter(e => e.id !== entryId);
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
  });
}

/**
 * Get a single entry by ID (decrypted)
 */
export async function getEntry(entryId: string, masterKey?: SecureKey): Promise<VaultEntry | null> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return null;

  const entries: VaultEntry[] = JSON.parse(stored);
  const entry = entries.find(e => e.id === entryId) || null;

  if (entry && masterKey) {
    return decryptEntry(entry, masterKey);
  }

  return entry;
}
