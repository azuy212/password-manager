/**
 * Secure storage for native platforms.
 * Uses iOS Keychain / Android Keystore via expo-secure-store.
 */
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};
