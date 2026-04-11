// Web fallback - not available on web, use Web Crypto API instead
const CryptoNativeModuleWeb = {
  generateSalt: async () => [],
  deriveKey: async () => [],
  encrypt: async () => ({ ciphertext: [], nonce: [], tag: [] }),
  decrypt: async () => [],
  generateKeyPair: async () => ({ privateKey: [], publicKey: [] }),
  sign: async () => [],
  verify: async () => false,
  generateRandomBytes: async () => [],
};

export default CryptoNativeModuleWeb;
