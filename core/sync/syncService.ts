import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '@/utils/uuid';

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
    deviceId = uuidv4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Upload local vaults to cloud (encrypted)
 */
export async function syncVaultsToCloud(vaults: Vault[], userId: string): Promise<void> {
  for (const vault of vaults) {
    const { data, error } = await supabase
      .from('vaults')
      .upsert({
        id: vault.id,
        user_id: userId,
        name: vault.name, // Vault names are metadata only (not sensitive)
        encrypted_encryption_key: vault.encryptedEncryptionKey,
        updated_at: new Date(vault.updatedAt).toISOString(),
      })
      .select();

    if (error) {
      console.error('Failed to sync vault');
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
    console.error('Failed to sync vaults from cloud');
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
 * Only uploads the encryptedPayload — never plaintext
 */
export async function syncEntriesToCloud(entries: VaultEntry[], userId: string): Promise<void> {
  for (const entry of entries) {
    const { error } = await supabase
      .from('vault_entries')
      .upsert({
        id: entry.id,
        vault_id: entry.vaultId,
        user_id: userId,
        // Upload ONLY the encrypted payload blob — never plaintext
        encrypted_payload: entry.encryptedPayload || '',
        updated_at: new Date(entry.updatedAt).toISOString(),
      });

    if (error) {
      console.error('Failed to sync entry');
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
    console.error('Failed to sync entries from cloud');
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    vaultId: row.vault_id,
    title: '',
    username: '',
    password: '',
    notes: undefined,
    url: undefined,
    encryptedPayload: row.encrypted_payload,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
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
  const localVaults = await getVaults();
  await syncVaultsToCloud(localVaults, userId);

  const cloudVaults = await syncVaultsFromCloud(userId);

  for (const vault of cloudVaults) {
    const localEntries = await getEntriesForVault(vault.id, masterKey);
    await syncEntriesToCloud(localEntries, userId);
    await syncEntriesFromCloud(vault.id, userId);
  }

  await updateLastSync();
}
