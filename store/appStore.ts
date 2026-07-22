import { observable, syncState } from '@legendapp/state';
import { observablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import { configureObservableSync, syncObservable } from '@legendapp/state/sync';
import { configureSyncedSupabase, syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { destroyAll as destroyAllKeys, setPasswordKey as setPwKey, getPasswordKey } from '../core/keyStore';
import { supabase } from '../services/supabaseClient';
import type { Database } from '../types/database.types';
import type { Identity } from '../types/identity';

type VaultRow          = Database['public']['Tables']['vaults']['Row'];
type VaultEntryRow     = Database['public']['Tables']['vault_entries']['Row'];
type SharedEntryRow    = Database['public']['Tables']['shared_entries']['Row'];

export interface Vault {
  id: string;
  userId: string;
  name: string;
  encryptedEncryptionKey: string;
  version: number;
  createdAt: number;
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

const ms  = (iso: string | null | undefined): number =>
  iso ? new Date(iso).getTime() : 0;
const msOpt = (iso: string | null | undefined): number | undefined =>
  iso ? new Date(iso).getTime() : undefined;
const iso = (epoch: number | undefined): string | null =>
  epoch ? new Date(epoch).toISOString() : null;

configureObservableSync({
  persist: {
    plugin: observablePersistAsyncStorage({ AsyncStorage }),
  },
});

configureSyncedSupabase({
  fieldId: 'id',
  fieldCreatedAt: 'created_at',
  fieldUpdatedAt: 'updated_at',
});

interface AppState {
  isAuthenticated: boolean;
  identity: Identity | null;
  userId: string | null;

  vaults: Vault[];
  entries: Record<string, VaultEntry>;
  sharedEntries: SharedEntry[];

  activeVaultId: string | null;
  activeEntryId: string | null;

  isLoading: boolean;
  error: string | null;
}

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
      return userId ? (query as any).eq('user_id', userId) : query;
    },
    waitFor: appStore$.userId,
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
      save: (vault: Vault | Vault[]): any => {
        const userId = appStore$.userId.peek();
        if (!userId) throw new Error('Cannot sync vault: user not authenticated');
        if (Array.isArray(vault)) {
          return vault.map(v => ({
            id:                       v.id,
            user_id:                  userId,
            name:                     v.name,
            encrypted_encryption_key: v.encryptedEncryptionKey,
            created_at:               v.createdAt ? new Date(v.createdAt).toISOString() : new Date(0).toISOString(),
            updated_at:               new Date().toISOString(),
            deleted_at:               iso(v.deletedAt),
          }));
        }
        const v = vault as Vault;
        return {
          id:                       v.id,
          user_id:                  userId,
          name:                     v.name,
          encrypted_encryption_key: v.encryptedEncryptionKey,
          created_at:               v.createdAt ? new Date(v.createdAt).toISOString() : new Date(0).toISOString(),
          updated_at:               new Date().toISOString(),
          deleted_at:               iso(v.deletedAt),
        };
      },
    },
  }),
);

syncObservable(
  appStore$.entries,
  syncedSupabase({
    supabase,
    collection: 'vault_entries',
    as: 'object',
    persist: { name: 'entries', retrySync: true },
    initial: {},
    filter: (query) => {
      const userId = appStore$.userId.peek();
      // No vault_id filter needed — RLS restricts entries to user's vaults via vaults join
      return userId ? query : (query as any).eq('vault_id', 'none');
    },
    waitFor: appStore$.userId,
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
      save: (entry: VaultEntry | Record<string, VaultEntry>): any => {
        const toRow = (e: any) => ({
          id:                e.id,
          vault_id:          e.vault_id ?? e.vaultId,
          encrypted_payload: e.encrypted_payload ?? e.encryptedPayload,
          version:           e.version ?? 1,
          created_at:        e.created_at ?? (e.createdAt ? new Date(e.createdAt).toISOString() : undefined),
          updated_at:        e.updated_at ?? new Date().toISOString(),
          deleted_at:        e.deleted_at ?? iso(e.deletedAt),
        });
        if (entry && typeof entry === 'object' && !('id' in entry)) {
          const result: Record<string, any> = {};
          for (const key of Object.keys(entry)) {
            result[key] = toRow((entry as Record<string, VaultEntry>)[key]);
          }
          return result;
        }
        return toRow(entry);
      },
    },
    create: (async (input: any, { onError, retry }: any) => {
      const res = await supabase.from('vault_entries').upsert(input).select();
      if (res.error) { onError(new Error(res.error.message), { source: 'create', type: 'create', retry }); }
      return res as any;
    }) as any,
    update: (async (input: any, { onError, retry }: any) => {
      const res = await supabase.from('vault_entries').upsert(input).select();
      if (res.error) { onError(new Error(res.error.message), { source: 'update', type: 'update', retry }); }
      return res as any;
    }) as any,
  }),
);

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
      save: (entry: SharedEntry | SharedEntry[]): any => {
        if (Array.isArray(entry)) {
          return entry.map(e => ({
            id:             e.id,
            entry_id:       e.entryId,
            owner_id:       e.ownerId,
            shared_with_id: e.sharedWithId,
            encrypted_key:  e.encryptedKey,
            created_at:     e.createdAt ? new Date(e.createdAt).toISOString() : new Date(0).toISOString(),
            updated_at:     new Date().toISOString(),
            deleted_at:     iso(e.deletedAt),
          }));
        }
        const e = entry as SharedEntry;
        return {
          id:             e.id,
          entry_id:       e.entryId,
          owner_id:       e.ownerId,
          shared_with_id: e.sharedWithId,
          encrypted_key:  e.encryptedKey,
          created_at:     e.createdAt ? new Date(e.createdAt).toISOString() : new Date(0).toISOString(),
          updated_at:     new Date().toISOString(),
          deleted_at:     iso(e.deletedAt),
        };
      },
    },
  }),
);

export const getSyncState = () => ({
  vaults:        syncState(appStore$.vaults),
  entries:       syncState(appStore$.entries),
  sharedEntries: syncState(appStore$.sharedEntries),
});

export const appActions = {
  setAuthenticated: (auth: boolean) => appStore$.isAuthenticated.set(auth),
  setIdentity:      (identity: Identity | null) => appStore$.identity.set(identity),
  setUserId:        (id: string | null) => appStore$.userId.set(id),
  setPasswordKey:   setPwKey,
  getPasswordKey:   getPasswordKey,
  setMasterKey:     setPwKey,

  setActiveVault: (vaultId: string | null) => {
    appStore$.activeVaultId.set(vaultId);
    appStore$.activeEntryId.set(null);
  },
  setActiveEntry: (entryId: string | null) => appStore$.activeEntryId.set(entryId),

  setLoading: (loading: boolean) => appStore$.isLoading.set(loading),
  setError:   (error: string | null) => appStore$.error.set(error),

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

  lock: () => {
    destroyAllKeys();
    const identity = appStore$.identity.get();

    syncState(appStore$.vaults).clearPersist();
    syncState(appStore$.entries).clearPersist();
    syncState(appStore$.sharedEntries).clearPersist();

    appStore$.assign({
      isAuthenticated: false,
      activeVaultId:   null,
      activeEntryId:   null,
      isLoading:       false,
      error:           null,
      identity,
    });

    appStore$.userId.set(null);
  },

  reset: () => {
    destroyAllKeys();

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
