import CryptoNative from 'crypto-native';
import type { CryptoProvider } from './interfaces';

export const cryptoProvider: CryptoProvider = {
  async deriveKey(password, salt, iterations, keyLength) {
    return CryptoNative.deriveKey(password, salt, iterations, keyLength);
  },

  async encrypt(data, keyBytes) {
    return CryptoNative.encrypt(data, keyBytes);
  },

  async decrypt(ciphertext, keyBytes, nonce, tag) {
    return CryptoNative.decrypt(ciphertext, keyBytes, nonce, tag);
  },

  async generateSalt(length) {
    return CryptoNative.generateSalt(length);
  },

  async generateRandomBytes(length) {
    return CryptoNative.generateRandomBytes(length);
  },

  async generateKeyPair() {
    return CryptoNative.generateKeyPair();
  },

  async sign(data, privateKeyBytes) {
    return CryptoNative.sign(data, privateKeyBytes);
  },

  async verify(data, signatureBytes, publicKeyBytes) {
    return CryptoNative.verify(data, signatureBytes, publicKeyBytes);
  },

  async generateX25519KeyPair() {
    return CryptoNative.generateX25519KeyPair();
  },

  async ecdh(privateKey, publicKey) {
    return CryptoNative.ecdh(privateKey, publicKey);
  },

  async hmacSha256(data, keyBytes) {
    return CryptoNative.hmacSha256(data, keyBytes);
  },
};
