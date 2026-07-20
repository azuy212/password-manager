import { secureStorage } from '@/utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageProvider, AsyncStorageProvider } from './interfaces';

export const storageProvider: StorageProvider = {
  async getItem(key) {
    return secureStorage.getItem(key);
  },

  async setItem(key, value) {
    return secureStorage.setItem(key, value);
  },

  async deleteItem(key) {
    return secureStorage.deleteItem(key);
  },
};

export const asyncStorageProvider: AsyncStorageProvider = {
  async getItem(key) {
    return AsyncStorage.getItem(key);
  },

  async setItem(key, value) {
    return AsyncStorage.setItem(key, value);
  },

  async removeItem(key) {
    return AsyncStorage.removeItem(key);
  },

  async multiRemove(keys) {
    return AsyncStorage.multiRemove(keys);
  },
};
