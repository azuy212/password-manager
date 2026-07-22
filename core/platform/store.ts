import { appStore$ } from '@/store/appStore';
import type { VaultEntryRaw } from '@/types/vault';
import type { Vault } from '@/store/appStore';
import type { StoreProvider } from './interfaces';

export const storeProvider: StoreProvider = {
  async getVault(id) {
    return appStore$.vaults.get().find(v => v.id === id) ?? null;
  },

  async getVaults() {
    return appStore$.vaults.get();
  },

  async getEntries(vaultId) {
    const entries = appStore$.entries.get();
    return Object.values(entries).filter(
      e => e.vaultId === vaultId && !e.deletedAt,
    ) as VaultEntryRaw[];
  },

  async getEntryById(id) {
    const entries = appStore$.entries.get();
    const entry = entries[id];
    if (entry && !entry.deletedAt) {
      return entry;
    }
    return null;
  },

  async saveVault(vault) {
    const idx = appStore$.vaults.get().findIndex(v => v.id === vault.id);
    if (idx !== -1) {
      appStore$.vaults[idx].assign({ ...vault, updatedAt: Date.now() });
    } else {
      appStore$.vaults.push({ ...vault, createdAt: vault.createdAt ?? Date.now(), updatedAt: Date.now() });
    }
  },

  async saveEntry(entry) {
    appStore$.entries[entry.id].set({
      ...entry,
      version: entry.version ?? 1,
      updatedAt: Date.now(),
    });
  },

  async deleteEntry(id) {
    appStore$.entries[id].deletedAt.set(Date.now());
  },

  getUserId() {
    return appStore$.userId.peek();
  },
};
