import type { StorageProvider, AsyncStorageProvider } from '../../../core/platform/interfaces'

export const storageProvider: StorageProvider = {
  async getItem(key) {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  },

  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },

  async deleteItem(key) {
    await chrome.storage.local.remove(key)
  },
}

export const asyncStorageProvider: AsyncStorageProvider = {
  async getItem(key) {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  },

  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },

  async removeItem(key) {
    await chrome.storage.local.remove(key)
  },

  async multiRemove(keys) {
    await chrome.storage.local.remove(keys)
  },
}
