import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '../../utils/uuid';

import type { Vault, VaultEntry, VaultEntryInput, VaultInput } from '../../types/vault';

const VAULTS_KEY = 'vaults';
const ENTRIES_KEY = 'vault_entries';

/**
 * Get all vaults
 */
export async function getVaults(): Promise<Vault[]> {
  const stored = await AsyncStorage.getItem(VAULTS_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

/**
 * Create a new vault
 */
export async function createVault(input: VaultInput, masterKey: number[]): Promise<Vault> {
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
}

/**
 * Delete a vault and all its entries
 */
export async function deleteVault(vaultId: string): Promise<void> {
  const vaults = await getVaults();
  const filtered = vaults.filter(v => v.id !== vaultId);
  await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(filtered));
  
  // Delete all entries in the vault
  const entries = await getEntriesForVault(vaultId);
  for (const entry of entries) {
    await deleteEntry(entry.id);
  }
}

/**
 * Get all entries for a vault
 */
export async function getEntriesForVault(vaultId: string): Promise<VaultEntry[]> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return [];
  
  const entries: VaultEntry[] = JSON.parse(stored);
  return entries.filter(e => e.vaultId === vaultId);
}

/**
 * Create a new vault entry
 */
export async function createEntry(input: VaultEntryInput, masterKey: number[]): Promise<VaultEntry> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  const entries: VaultEntry[] = stored ? JSON.parse(stored) : [];
  
  const newEntry: VaultEntry = {
    ...input,
    id: uuidv4(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  entries.push(newEntry);
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  
  return newEntry;
}

/**
 * Update a vault entry
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<VaultEntryInput>,
  masterKey: number[]
): Promise<VaultEntry | null> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return null;
  
  const entries: VaultEntry[] = JSON.parse(stored);
  const index = entries.findIndex(e => e.id === entryId);
  if (index === -1) return null;
  
  entries[index] = {
    ...entries[index],
    ...updates,
    updatedAt: Date.now(),
  };
  
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  return entries[index];
}

/**
 * Delete a vault entry
 */
export async function deleteEntry(entryId: string): Promise<void> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return;
  
  const entries: VaultEntry[] = JSON.parse(stored);
  const filtered = entries.filter(e => e.id !== entryId);
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
}

/**
 * Get a single entry by ID
 */
export async function getEntry(entryId: string): Promise<VaultEntry | null> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!stored) return null;
  
  const entries: VaultEntry[] = JSON.parse(stored);
  return entries.find(e => e.id === entryId) || null;
}
