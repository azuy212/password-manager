import { create } from 'zustand';
import type { Vault, VaultEntry } from '../types/vault';
import type { Identity } from '../types/identity';

interface AppState {
  // Auth state
  isAuthenticated: boolean;
  identity: Identity | null;
  masterKey: number[] | null;
  userId: string | null;
  
  // Vault state
  vaults: Vault[];
  activeVault: Vault | null;
  entries: VaultEntry[];
  activeEntry: VaultEntry | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setAuthenticated: (auth: boolean) => void;
  setIdentity: (identity: Identity | null) => void;
  setMasterKey: (key: number[] | null) => void;
  setUserId: (id: string | null) => void;
  
  setVaults: (vaults: Vault[]) => void;
  setActiveVault: (vault: Vault | null) => void;
  setEntries: (entries: VaultEntry[]) => void;
  setActiveEntry: (entry: VaultEntry | null) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Reset state
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
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setIdentity: (identity) => set({ identity }),
  setMasterKey: (key) => set({ masterKey: key }),
  setUserId: (id) => set({ userId: id }),
  
  setVaults: (vaults) => set({ vaults }),
  setActiveVault: (vault) => set({ activeVault: vault }),
  setEntries: (entries) => set({ entries }),
  setActiveEntry: (entry) => set({ activeEntry: entry }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  reset: () => set(initialState),
}));
