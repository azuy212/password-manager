import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '@/utils/uuid';
import { supabaseWithRetry } from '@/utils/supabaseRetry';

import type { Vault, VaultEntry } from '../../types/vault';
import { getVaults, getEntriesForVault, getAllRawEntriesForVault, decryptVaultKey } from '../vault/vaultService';
import type { VaultEntryRaw as VaultEntryRawType } from '../vault/vaultService';
import type { SecureKey } from '../crypto';

const DEVICE_ID_KEY = 'device_id';
const LAST_SYNC_KEY = 'last_sync';
const ENTRIES_KEY = 'vault_entries';
const VAULTS_KEY = 'vaults';

// Mutex to prevent concurrent syncs
let syncMutex = Promise.resolve();

function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const promise = syncMutex.then(fn, fn);
  syncMutex = promise.then(() => {}, () => {});
  return promise;
}

/**
 * Raw encrypted entry as stored in AsyncStorage (local copy for sync)
 */
interface VaultEntryRawLocal {
  id: string;
  vaultId: string;
  encryptedPayload: string;
  version?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

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
    await supabaseWithRetry(
      async () => {
        const { data, error } = await supabase
          .from('vaults')
          .upsert({
            id: vault.id,
            user_id: userId,
            name: vault.name,
            encrypted_encryption_key: vault.encryptedEncryptionKey,
            version: vault.version || 1,
            deleted_at: vault.deletedAt ? new Date(vault.deletedAt).toISOString() : null,
            updated_at: new Date(vault.updatedAt).toISOString(),
          })
          .select();

        if (error) throw error;
        return data;
      },
      'sync vault to cloud'
    );
  }
}

/**
 * Download vaults from cloud (excluding soft-deleted)
 */
export async function syncVaultsFromCloud(userId: string): Promise<Vault[]> {
  const data = await supabaseWithRetry(
    async () => {
      const { data, error } = await supabase
        .from('vaults')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (error) throw error;
      return data;
    },
    'sync vaults from cloud'
  );

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    encryptedEncryptionKey: row.encrypted_encryption_key,
    version: row.version,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));
}

/**
 * Upload vault entries to cloud
 * Only uploads the encryptedPayload — never plaintext
 * Version is auto-incremented by DB trigger on UPDATE.
 * Soft-deleted entries are marked with deleted_at in cloud.
 */
export async function syncEntriesToCloud(entries: VaultEntry[], vaultId: string, userId: string): Promise<void> {
  for (const entry of entries) {
    await supabaseWithRetry(
      async () => {
        const { error } = await supabase
          .from('vault_entries')
          .upsert({
            id: entry.id,
            vault_id: vaultId,
            encrypted_payload: entry.encryptedPayload || '',
            deleted_at: entry.deletedAt ? new Date(entry.deletedAt).toISOString() : null,
            updated_at: new Date(entry.updatedAt).toISOString(),
          }, {
            onConflict: 'id',
          });

        if (error) throw error;
      },
      'sync entry to cloud'
    );
  }
}

/**
 * Download vault entries from cloud (excluding soft-deleted)
 */
export async function syncEntriesFromCloud(vaultId: string): Promise<VaultEntry[]> {
  const data = await supabaseWithRetry(
    async () => {
      const { data, error } = await supabase
        .from('vault_entries')
        .select('*')
        .eq('vault_id', vaultId)
        .is('deleted_at', null);

      if (error) throw error;
      return data;
    },
    'sync entries from cloud'
  );

  return (data || []).map(row => ({
    id: row.id,
    vaultId: row.vault_id,
    title: '',
    username: '',
    password: '',
    notes: undefined,
    url: undefined,
    encryptedPayload: row.encrypted_payload,
    version: row.version,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
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
 * Full sync: upload local changes and download remote changes, merging them into local storage.
 *
 * Strategy:
 * 1. Upload local vaults to cloud
 * 2. Download cloud vaults and merge into local vaults
 * 3. For each vault:
 *    a. Upload local entries
 *    b. Download cloud entries
 *    c. Merge cloud entries into local storage (last-write-wins by updatedAt)
 * 4. Update sync timestamp
 *
 * Uses a mutex to prevent concurrent syncs from corrupting data.
 * Returns the merged vaults and entries count so the caller can update the Zustand store.
 */
export async function fullSync(
  userId: string,
  masterKey: SecureKey
): Promise<{ syncedVaults: number; syncedEntries: number; mergedVaults: Vault[] }> {
  return withSyncLock(async () => {
    console.log('[SyncService] fullSync started, userId:', userId);
    let syncedEntries = 0;

    // Step 1: Upload local vaults
    console.log('[SyncService] Step 1: Getting local vaults...');
    const localVaults = await getVaults();
    console.log('[SyncService] Local vaults count:', localVaults.length);
    console.log('[SyncService] Step 1: Uploading local vaults to cloud...');
    await syncVaultsToCloud(localVaults, userId);
    console.log('[SyncService] Step 1 completed: vaults uploaded');

    // Step 2: Download cloud vaults
    console.log('[SyncService] Step 2: Downloading cloud vaults...');
    const cloudVaults = await syncVaultsFromCloud(userId);
    console.log('[SyncService] Step 2 completed: cloud vaults count:', cloudVaults.length);

    // Step 3: Merge cloud vaults into local storage
    console.log('[SyncService] Step 3: Merging cloud vaults locally...');
    await mergeVaultsLocally(cloudVaults, localVaults);
    console.log('[SyncService] Step 3 completed: merged vaults count:', localVaults.length);

    // Step 4: For each vault, sync entries
    console.log('[SyncService] Step 4: Syncing entries for each vault...');
    for (const vault of cloudVaults) {
      console.log('[SyncService] Syncing entries for vault:', vault.id);
      // Decrypt the vault's DEK to read local entries
      const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, masterKey);

      // Upload ALL entries including soft-deleted (so deletions propagate to cloud)
      console.log('[SyncService] Getting all raw entries for vault:', vault.id);
      const rawLocalEntries = await getAllRawEntriesForVault(vault.id);
      console.log('[SyncService] Raw local entries count:', rawLocalEntries.length);
      // Convert raw entries to VaultEntry format for syncEntriesToCloud
      const entriesForCloud: VaultEntry[] = rawLocalEntries.map(raw => ({
        id: raw.id,
        vaultId: raw.vaultId,
        title: '',
        username: '',
        password: '',
        notes: undefined,
        url: undefined,
        encryptedPayload: raw.encryptedPayload,
        version: raw.version,
        deletedAt: raw.deletedAt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      }));
      console.log('[SyncService] Uploading entries to cloud for vault:', vault.id);
      await syncEntriesToCloud(entriesForCloud, vault.id, userId);
      console.log('[SyncService] Entries uploaded, downloading cloud entries...');

      const cloudEntries = await syncEntriesFromCloud(vault.id);
      console.log('[SyncService] Cloud entries count:', cloudEntries.length, 'merging locally...');
      syncedEntries += await mergeEntriesLocally(vault.id, cloudEntries);
      console.log('[SyncService] Vault', vault.id, 'sync completed, syncedEntries so far:', syncedEntries);

      // Destroy the vault key when done with this vault
      vaultKey.destroy();
    }

    console.log('[SyncService] Updating last sync timestamp...');
    await updateLastSync();

    console.log('[SyncService] fullSync completed: syncedVaults:', cloudVaults.length, 'syncedEntries:', syncedEntries);
    return { syncedVaults: cloudVaults.length, syncedEntries, mergedVaults: localVaults };
  });
}

/**
 * Merge cloud vaults into local storage.
 * - Adds vaults that exist in cloud but not locally
 * - Updates local vaults if cloud version is newer
 * - Removes local vaults that were soft-deleted in cloud
 */
async function mergeVaultsLocally(cloudVaults: Vault[], localVaults: Vault[]): Promise<void> {
  const localMap = new Map(localVaults.map(v => [v.id, v]));
  let changed = false;

  // Build set of cloud vault IDs that are NOT deleted
  const activeCloudIds = new Set(cloudVaults.map(v => v.id));

  for (const cloudVault of cloudVaults) {
    const localVault = localMap.get(cloudVault.id);
    if (!localVault) {
      // New vault from cloud — add locally
      localVaults.push(cloudVault);
      changed = true;
    } else if (cloudVault.updatedAt > localVault.updatedAt) {
      // Cloud version is newer — update locally
      localVault.encryptedEncryptionKey = cloudVault.encryptedEncryptionKey;
      localVault.name = cloudVault.name;
      localVault.updatedAt = cloudVault.updatedAt;
      localVault.deletedAt = cloudVault.deletedAt;
      changed = true;
    }
  }

  // Remove local vaults that were deleted in cloud
  // (vaults that exist locally but not in the active cloud set)
  const localIds = new Set(localVaults.map(v => v.id));
  for (const localVault of localVaults) {
    if (!activeCloudIds.has(localVault.id)) {
      // This vault was deleted in cloud — remove locally
      localVault.deletedAt = localVault.deletedAt || Date.now();
    }
  }

  // Filter out deleted vaults from local list
  const beforeLength = localVaults.length;
  const filteredVaults = localVaults.filter(v => !v.deletedAt);
  if (filteredVaults.length !== beforeLength) {
    changed = true;
    // Replace array contents
    localVaults.length = 0;
    localVaults.push(...filteredVaults);
  }

  if (changed) {
    await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(localVaults));
  }
}

/**
 * Merge cloud entries into local storage.
 * - Adds entries that exist in cloud but not locally
 * - Updates local entries if cloud version is newer (version-based optimistic lock)
 * - Skips if local version is equal or greater
 * - Soft-deletes local entries that were deleted in cloud
 */
async function mergeEntriesLocally(vaultId: string, cloudEntries: VaultEntry[]): Promise<number> {
  const stored = await AsyncStorage.getItem(ENTRIES_KEY);
  const localRawEntries: VaultEntryRawLocal[] = stored ? JSON.parse(stored) : [];
  const localMap = new Map(localRawEntries.map(e => [e.id, e]));
  let changed = false;
  let syncedCount = 0;

  for (const cloudEntry of cloudEntries) {
    const localRaw = localMap.get(cloudEntry.id);
    if (!localRaw) {
      // New entry from cloud — add locally
      localRawEntries.push({
        id: cloudEntry.id,
        vaultId: cloudEntry.vaultId,
        encryptedPayload: cloudEntry.encryptedPayload || '',
        version: cloudEntry.version,
        deletedAt: cloudEntry.deletedAt,
        createdAt: cloudEntry.createdAt,
        updatedAt: cloudEntry.updatedAt,
      });
      changed = true;
      syncedCount++;
    } else if (cloudEntry.deletedAt) {
      // Entry was deleted in cloud — soft-delete locally
      localRaw.deletedAt = cloudEntry.deletedAt;
      changed = true;
      syncedCount++;
    } else if (cloudEntry.updatedAt > localRaw.updatedAt && cloudEntry.encryptedPayload) {
      // Cloud version is strictly newer — update locally (optimistic lock via timestamp)
      localRaw.encryptedPayload = cloudEntry.encryptedPayload;
      localRaw.updatedAt = cloudEntry.updatedAt;
      localRaw.version = cloudEntry.version;
      changed = true;
      syncedCount++;
    }
    // If local version is equal or newer → skip (no overwrite)
  }

  // Filter out soft-deleted entries from active local list
  const beforeLength = localRawEntries.length;
  const activeEntries = localRawEntries.filter(e => !e.deletedAt);
  if (activeEntries.length !== beforeLength) {
    changed = true;
    localRawEntries.length = 0;
    localRawEntries.push(...activeEntries);
  }

  if (changed) {
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(localRawEntries));
  }

  return syncedCount;
}
