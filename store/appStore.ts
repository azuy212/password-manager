import { observable } from '@legendapp/state';
import type { SecureKey } from '../core/crypto';
import type { Vault, VaultEntry } from '../types/vault';
import type { Identity } from '../types/identity';

interface AppState {
  // Auth state
  isAuthenticated: boolean;
  identity: Identity | null;
  masterKey: SecureKey | null;
  userId: string | null;

  // Vault state
  vaults: Vault[];
  activeVault: Vault | null;
  entries: VaultEntry[];
  activeEntry: VaultEntry | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Sync state
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;
}

const initialState: AppState = {
  isAuthenticated: false,
  identity: null,
  masterKey: null,
  userId: null,
  vaults: [],
  activeVault: null,
  entries: [],
  activeEntry: null,
  isLoading: false,
  error: null,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,
};

function destroyMasterKey(masterKey: SecureKey | null) {
  if (masterKey) {
    masterKey.destroy();
  }
}

export const appStore$ = observable<AppState>(initialState);

// Actions/Helpers
export const appActions = {
  setAuthenticated: (auth: boolean) => appStore$.isAuthenticated.set(auth),
  setIdentity: (identity: Identity | null) => appStore$.identity.set(identity),
  setMasterKey: (key: SecureKey | null) => {
    destroyMasterKey(appStore$.masterKey.get());
    appStore$.masterKey.set(key);
  },
  setUserId: (id: string | null) => appStore$.userId.set(id),

  setVaults: (vaults: Vault[]) => appStore$.vaults.set(vaults),
  setActiveVault: (vault: Vault | null) => appStore$.activeVault.set(vault),
  setEntries: (entries: VaultEntry[]) => appStore$.entries.set(entries),
  setActiveEntry: (entry: VaultEntry | null) => appStore$.activeEntry.set(entry),

  setLoading: (loading: boolean) => appStore$.isLoading.set(loading),
  setError: (error: string | null) => appStore$.error.set(error),

  setSyncing: (syncing: boolean) => {
    appStore$.isSyncing.set(syncing);
    if (syncing) appStore$.syncError.set(null);
  },
  setLastSyncedAt: (timestamp: number | null) => appStore$.lastSyncedAt.set(timestamp),
  setSyncError: (error: string | null) => appStore$.syncError.set(error),

  lock: () => {
    destroyMasterKey(appStore$.masterKey.get());
    const identity = appStore$.identity.get();
    appStore$.set({
      ...initialState,
      identity, // Preserve identity
    });
  },

  reset: () => {
    destroyMasterKey(appStore$.masterKey.get());
    appStore$.set(initialState);
  },
};
