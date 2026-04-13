import { create } from 'zustand';
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

  // Actions
  setAuthenticated: (auth: boolean) => void;
  setIdentity: (identity: Identity | null) => void;
  setMasterKey: (key: SecureKey | null) => void;
  setUserId: (id: string | null) => void;

  setVaults: (vaults: Vault[]) => void;
  setActiveVault: (vault: Vault | null) => void;
  setEntries: (entries: VaultEntry[]) => void;
  setActiveEntry: (entry: VaultEntry | null) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setSyncError: (error: string | null) => void;

  // Lock — destroys master key, resets to pre-auth state
  lock: () => void;

  // Reset state — destroys master key, full wipe
  reset: () => void;
}

const initialState = {
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

function destroyMasterKey(state: AppState) {
  if (state.masterKey) {
    state.masterKey.destroy();
  }
}

export const useAppStore = create<AppState>()(
  // Wrap with devtools-excluded middleware for sensitive fields
  // Zustand v5: use the built-in devtools middleware with state serialization excluded
  (set, get) => ({
    ...initialState,

    setAuthenticated: (auth) => set({ isAuthenticated: auth }),
    setIdentity: (identity) => set({ identity }),
    setMasterKey: (key) => {
      set((state) => {
        destroyMasterKey(state);
        return { masterKey: key };
      });
    },
    setUserId: (id) => set({ userId: id }),

    setVaults: (vaults) => set({ vaults }),
    setActiveVault: (vault) => set({ activeVault: vault }),
    setEntries: (entries) => set({ entries }),
    setActiveEntry: (entry) => set({ activeEntry: entry }),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    setSyncing: (syncing) => set({ isSyncing: syncing, syncError: syncing ? null : null }),
    setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),
    setSyncError: (error) => set({ syncError: error }),

    lock: () =>
      set((state) => {
        destroyMasterKey(state);
        return {
          ...initialState,
          identity: state.identity, // Preserve identity so user can re-auth
        };
      }),

    reset: () =>
      set((state) => {
        destroyMasterKey(state);
        return initialState;
      }),
  })
);
