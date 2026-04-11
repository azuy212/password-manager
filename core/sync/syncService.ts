import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { Vault, VaultEntry } from '../../types/vault';
import { getVaults, getEntriesForVault } from '../vault/vaultService';
import type { SecureKey } from '../crypto';

const DEVICE_ID_KEY = 'device_id';
const LAST_SYNC_KEY = 'last_sync';

/**
 * Get or generate unique device ID
 */
export async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Upload local vaults to cloud
 */
export async function syncVaultsToCloud(vaults: Vault[], userId: string): Promise<void> {
  for (const vault of vaults) {
    const { data, error } = await supabase
      .from('vaults')
      .upsert({
        id: vault.id,
        user_id: userId,
        name: vault.name,
        encrypted_encryption_key: vault.encryptedEncryptionKey,
        updated_at: new Date(vault.updatedAt).toISOString(),
      })
      .select();

    if (error) {
      console.error('Failed to sync vault:', error.message);
      throw error;
    }
  }
}

/**
 * Download vaults from cloud
 */
export async function syncVaultsFromCloud(userId: string): Promise<Vault[]> {
  const { data, error } = await supabase
    .from('vaults')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to sync vaults from cloud:', error.message);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    encryptedEncryptionKey: row.encrypted_encryption_key,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));
}

/**
 * Upload vault entries to cloud
 */
export async function syncEntriesToCloud(entries: VaultEntry[], userId: string): Promise<void> {
  for (const entry of entries) {
    const { error } = await supabase
      .from('vault_entries')
      .upsert({
        id: entry.id,
        vault_id: entry.vaultId,
        user_id: userId,
        title: entry.title,
        username: entry.username,
        encrypted_password: entry.password,
        encrypted_notes: entry.notes || null,
        url: entry.url || null,
        updated_at: new Date(entry.updatedAt).toISOString(),
      });

    if (error) {
      console.error('Failed to sync entry:', error.message);
      throw error;
    }
  }
}

/**
 * Download vault entries from cloud
 */
export async function syncEntriesFromCloud(vaultId: string, userId: string): Promise<VaultEntry[]> {
  const { data, error } = await supabase
    .from('vault_entries')
    .select('*')
    .eq('vault_id', vaultId)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to sync entries from cloud:', error.message);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    vaultId: row.vault_id,
    title: row.title,
    username: row.username,
    password: row.encrypted_password,
    notes: row.encrypted_notes || undefined,
    url: row.url || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    lastAccessed: row.last_accessed ? new Date(row.last_accessed).getTime() : undefined,
  }));
}

/**
 * Get last sync timestamp
 */
export async function getLastSync(): Promise<number> {
  const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
}

/**
 * Full sync: upload local changes and download remote changes
 */
export async function fullSync(userId: string, masterKey: SecureKey): Promise<void> {
  // Get local data
  const localVaults = await getVaults();

  // Upload to cloud
  await syncVaultsToCloud(localVaults, userId);

  // Download from cloud
  const cloudVaults = await syncVaultsFromCloud(userId);

  // Sync entries for each vault
  for (const vault of cloudVaults) {
    // FIX: Actually get entries for this vault instead of returning []
    const localEntries = await getEntriesForVault(vault.id, masterKey);
    await syncEntriesToCloud(localEntries, userId);
    await syncEntriesFromCloud(vault.id, userId);
  }

  await updateLastSync();
}
