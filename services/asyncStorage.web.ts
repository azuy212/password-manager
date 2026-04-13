/**
 * Web-compatible AsyncStorage shim using localStorage.
 * Matches the @react-native-async-storage/async-storage API.
 */

const PREFIX = 'RNAsyncStorage_';

function key(k: string): string {
  return PREFIX + k;
}

const AsyncStorage = {
  async getItem(k: string): Promise<string | null> {
    try {
      return localStorage.getItem(key(k));
    } catch {
      return null;
    }
  },

  async setItem(k: string, v: string): Promise<void> {
    try {
      localStorage.setItem(key(k), v);
    } catch {
      // silently fail (quota exceeded, etc.)
    }
  },

  async removeItem(k: string): Promise<void> {
    try {
      localStorage.removeItem(key(k));
    } catch {
      // silently fail
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX)) {
          keys.push(k.slice(PREFIX.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return Promise.all(
      keys.map(async (k) => [k, await this.getItem(k)])
    );
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    await Promise.all(
      keyValuePairs.map(([k, v]) => this.setItem(k, v))
    );
  },

  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((k) => this.removeItem(k))
    );
  },

  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      await this.multiRemove(keys);
    } catch {
      // silently fail
    }
  },
};

export default AsyncStorage;
