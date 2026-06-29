import { observable, syncState } from '@legendapp/state';
import { observablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import { configureSynced, syncObservable } from '@legendapp/state/sync';
import { configureSyncedSupabase, syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import { destroyMasterKey as destroyKeySingleton, setMasterKey as setKeySingleton } from '../core/masterKeyStore';
import type { Database } from '../types/database.types';
import type { Identity } from '../types/identity';

// ---------------------------------------------------------------------------
// DB row types derived from generated Supabase types
// ---------------------------------------------------------------------------
type VaultRow          = Database['public']['Tables']['vaults']['Row'];
type VaultEntryRow     = Database['public']['Tables']['vault_entries']['Row'];
type SharedEntryRow    = Database['public']['Tables']['shared_entries']['Row'];

// ---------------------------------------------------------------------------
// App-level camelCase types (what the rest of the app works with)
// ---------------------------------------------------------------------------
export interface Vault {
  id: string;
  userId: string;
  name: string;
  encryptedEncryptionKey: string;
  version: number;
  createdAt: number;   // epoch ms
  updatedAt: number;
  deletedAt?: number;
}

export interface VaultEntry {
  id: string;
  vaultId: string;
  encryptedPayload: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface SharedEntry {
  id: string;
  entryId: string;
  ownerId: string;
  sharedWithId: string;
  encryptedKey: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------
const ms  = (iso: string | null | undefined): number =>
  iso ? new Date(iso).getTime() : 0;
const msOpt = (iso: string | null | undefined): number | undefined =>
  iso ? new Date(iso).getTime() : undefined;
const iso = (epoch: number | undefined): string | null =>
  epoch ? new Date(epoch).toISOString() : null;

// ---------------------------------------------------------------------------
// Global sync/persist configuration
// ---------------------------------------------------------------------------
configureSynced({
  persist: {
    plugin: observablePersistAsyncStorage({ AsyncStorage }),
  },
});

configureSyncedSupabase({
  fieldId: 'id',
  fieldCreatedAt: 'created_at',
  fieldUpdatedAt: 'updated_at',
  // fieldDeleted omitted — deleted_at is a timestamp, not a boolean,
  // so we handle it manually in each transform rather than letting the
  // plugin try to manage it.
});

// ---------------------------------------------------------------------------
// App state interface
// ---------------------------------------------------------------------------
interface AppState {
  // Auth
  isAuthenticated: boolean;
  identity: Identity | null;
  userId: string | null;

  // Data (populated by syncObservable below)
  vaults: Vault[];
  entries: Record<string, VaultEntry>;
  sharedEntries: SharedEntry[];

  // UI selection
  activeVaultId: string | null;
  activeEntryId: string | null;

  // UI status
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Store declaration — must come before syncObservable calls so that
// filter/waitFor callbacks can safely reference appStore$ without a
// "used before declaration" error.
// ---------------------------------------------------------------------------
export const appStore$ = observable<AppState>({
  isAuthenticated: false,
  identity: null,
  userId: null,

  vaults: [],
  entries: {},
  sharedEntries: [],

  activeVaultId: null,
  activeEntryId: null,

  isLoading: false,
  error: null,
});

// ---------------------------------------------------------------------------
// Derived / computed selectors
// ---------------------------------------------------------------------------
export const activeVault$ = observable<Vault | undefined>(
  () => appStore$.vaults.get().find(v => v.id === appStore$.activeVaultId.get()),
);

export const activeEntry$ = observable<VaultEntry | undefined>(
  () => {
    const id = appStore$.activeEntryId.get();
    return id ? appStore$.entries[id].get() : undefined;
  },
);

export const activeVaultEntries$ = observable<VaultEntry[]>(
  () => {
    const vaultId = appStore$.activeVaultId.get();
    if (!vaultId) return [];
    return Object.values(appStore$.entries.get()).filter(
      e => e.vaultId === vaultId && !e.deletedAt,
    );
  },
);

// ---------------------------------------------------------------------------
// Sync: vaults
// Columns: id, user_id, name, encrypted_encryption_key, version,
//          created_at, updated_at, deleted_at
// ---------------------------------------------------------------------------
syncObservable(
  appStore$.vaults,
  syncedSupabase({
    supabase,
    collection: 'vaults',
    as: 'array',
    persist: { name: 'vaults', retrySync: true },
    initial: [],
    filter: (query) => {
      const userId = appStore$.userId.peek();
      // cast: `as: 'array'` widens the builder type away from typed columns
      return userId ? (query as any).eq('user_id', userId) : query;
    },
    waitFor: appStore$.userId,
    realtime: { filter: () => `user_id=eq.${appStore$.userId.peek()}` },
    transform: {
      load: (row: VaultRow): Vault => ({
        id:                    row.id,
        userId:                row.user_id,
        name:                  row.name,
        encryptedEncryptionKey: row.encrypted_encryption_key,
        version:               row.version,
        createdAt:             ms(row.created_at),
        updatedAt:             ms(row.updated_at),
        deletedAt:             msOpt(row.deleted_at),
      }),
      save: (vault: Vault): Partial<VaultRow> => ({
        id:                       vault.id,
        user_id:                  appStore$.userId.peek() ?? '',
        name:                     vault.name,
        encrypted_encryption_key: vault.encryptedEncryptionKey,
        deleted_at:               iso(vault.deletedAt),
        updated_at:               new Date().toISOString(),
      }),
    },
  }),
);

// ---------------------------------------------------------------------------
// Sync: vault_entries
// Columns: id, vault_id, encrypted_payload, version,
//          created_at, updated_at, deleted_at
// Note: NO user_id column on this table — filter via vault_id instead.
// ---------------------------------------------------------------------------
syncObservable(
  appStore$.entries,
  syncedSupabase({
    supabase,
    collection: 'vault_entries',
    as: 'object',
    persist: { name: 'entries', retrySync: true },
    initial: {},
    filter: (query) => {
      const activeVaultId = appStore$.activeVaultId.peek();
      // Only fetch entries for the active vault. When no vault is selected
      // the query returns nothing, keeping the local store clean.
      return activeVaultId
        ? (query as any).eq('vault_id', activeVaultId)
        : (query as any).eq('vault_id', 'none'); // return empty set safely
    },
    waitFor: appStore$.activeVaultId,
    realtime: {
      filter: () => {
        const vaultId = appStore$.activeVaultId.peek();
        return vaultId ? `vault_id=eq.${vaultId}` : undefined;
      },
    },
    transform: {
      load: (row: VaultEntryRow): VaultEntry => ({
        id:               row.id,
        vaultId:          row.vault_id,
        encryptedPayload: row.encrypted_payload,
        version:          row.version,
        createdAt:        ms(row.created_at),
        updatedAt:        ms(row.updated_at),
        deletedAt:        msOpt(row.deleted_at),
      }),
      save: (entry: VaultEntry): Partial<VaultEntryRow> => ({
        id:               entry.id,
        vault_id:         entry.vaultId,
        encrypted_payload: entry.encryptedPayload,
        deleted_at:       iso(entry.deletedAt),
        updated_at:       new Date().toISOString(),
      }),
    },
  }),
);

// ---------------------------------------------------------------------------
// Sync: shared_entries
// Columns: id, entry_id, owner_id, shared_with_id, encrypted_key,
//          created_at, updated_at, deleted_at
// Note: column is `entry_id` (not `vault_entry_id`) per the DB schema.
// ---------------------------------------------------------------------------
syncObservable(
  appStore$.sharedEntries,
  syncedSupabase({
    supabase,
    collection: 'shared_entries',
    as: 'array',
    persist: { name: 'sharedEntries', retrySync: true },
    initial: [],
    filter: (query) => {
      const userId = appStore$.userId.peek();
      return userId ? (query as any).eq('shared_with_id', userId) : query;
    },
    waitFor: appStore$.userId,
    realtime: {
      filter: () => `shared_with_id=eq.${appStore$.userId.peek()}`,
    },
    transform: {
      load: (row: SharedEntryRow): SharedEntry => ({
        id:           row.id,
        entryId:      row.entry_id,
        ownerId:      row.owner_id,
        sharedWithId: row.shared_with_id,
        encryptedKey: row.encrypted_key,
        createdAt:    ms(row.created_at),
        updatedAt:    ms(row.updated_at),
        deletedAt:    msOpt(row.deleted_at),
      }),
      save: (entry: SharedEntry): Partial<SharedEntryRow> => ({
        id:             entry.id,
        entry_id:       entry.entryId,
        owner_id:       entry.ownerId,
        shared_with_id: entry.sharedWithId,
        encrypted_key:  entry.encryptedKey,
        deleted_at:     iso(entry.deletedAt),
        updated_at:     new Date().toISOString(),
      }),
    },
  }),
);

// ---------------------------------------------------------------------------
// Sync state helpers
// ---------------------------------------------------------------------------
export const getSyncState = () => ({
  vaults:        syncState(appStore$.vaults),
  entries:       syncState(appStore$.entries),
  sharedEntries: syncState(appStore$.sharedEntries),
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export const appActions = {
  // Auth
  setAuthenticated: (auth: boolean) => appStore$.isAuthenticated.set(auth),
  setIdentity:      (identity: Identity | null) => appStore$.identity.set(identity),
  setUserId:        (id: string | null) => appStore$.userId.set(id),
  setMasterKey:     setKeySingleton,

  // UI selection
  setActiveVault: (vaultId: string | null) => {
    appStore$.activeVaultId.set(vaultId);
    appStore$.activeEntryId.set(null); // clear entry selection on vault change
  },
  setActiveEntry: (entryId: string | null) => appStore$.activeEntryId.set(entryId),

  // Status
  setLoading: (loading: boolean) => appStore$.isLoading.set(loading),
  setError:   (error: string | null) => appStore$.error.set(error),

  // Vault CRUD helpers
  addVault: (vault: Omit<Vault, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    appStore$.vaults.push({ ...vault, createdAt: now, updatedAt: now });
  },
  updateVault: (id: string, patch: Partial<Vault>) => {
    const idx = appStore$.vaults.get().findIndex(v => v.id === id);
    if (idx !== -1) appStore$.vaults[idx].assign({ ...patch, updatedAt: Date.now() });
  },
  deleteVault: (id: string) => {
    const idx = appStore$.vaults.get().findIndex(v => v.id === id);
    if (idx !== -1) appStore$.vaults[idx].deletedAt.set(Date.now());
  },

  // Entry CRUD helpers
  addEntry: (entry: Omit<VaultEntry, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    appStore$.entries[entry.id].set({ ...entry, createdAt: now, updatedAt: now });
  },
  updateEntry: (id: string, patch: Partial<VaultEntry>) => {
    appStore$.entries[id].assign({ ...patch, updatedAt: Date.now() });
  },
  deleteEntry: (id: string) => {
    appStore$.entries[id].deletedAt.set(Date.now());
  },

  // Session teardown — lock keeps identity, reset wipes everything
  lock: () => {
    destroyKeySingleton();
    const identity = appStore$.identity.get();

    // Clear persisted data — do NOT set([]) / set({}) on synced observables,
    // that queues deletions and would wipe Supabase on next sync.
    syncState(appStore$.vaults).clearPersist();
    syncState(appStore$.entries).clearPersist();
    syncState(appStore$.sharedEntries).clearPersist();

    appStore$.assign({
      isAuthenticated: false,
      activeVaultId:   null,
      activeEntryId:   null,
      isLoading:       false,
      error:           null,
      identity,        // preserve identity so login screen can pre-fill email
    });

    // userId last — waitFor gates syncing on this, so nulling it suspends all sync cleanly
    appStore$.userId.set(null);
  },

  reset: () => {
    destroyKeySingleton();

    syncState(appStore$.vaults).clearPersist();
    syncState(appStore$.entries).clearPersist();
    syncState(appStore$.sharedEntries).clearPersist();

    appStore$.assign({
      isAuthenticated: false,
      identity:        null,
      activeVaultId:   null,
      activeEntryId:   null,
      isLoading:       false,
      error:           null,
    });

    appStore$.userId.set(null);
  },
};