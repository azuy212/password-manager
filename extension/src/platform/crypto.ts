import { ed25519, x25519 } from '@noble/curves/ed25519'
import type { CryptoProvider } from '../../../core/platform/interfaces'

export const cryptoProvider: CryptoProvider = {
  async deriveKey(password, salt, iterations, keyLength) {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
      keyMaterial,
      keyLength * 8,
    )
    return Array.from(new Uint8Array(derivedBits))
  },

  async encrypt(data, keyBytes) {
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyBytes),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    )
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(data))
    const encryptedBytes = new Uint8Array(encrypted)
    return {
      ciphertext: Array.from(encryptedBytes.slice(0, -16)),
      nonce: Array.from(iv),
      tag: Array.from(encryptedBytes.slice(-16)),
    }
  },

  async decrypt(ciphertext, keyBytes, nonce, tag) {
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyBytes),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )
    const fullCiphertext = new Uint8Array([...ciphertext, ...tag])
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonce) },
      key,
      fullCiphertext,
    )
    return Array.from(new Uint8Array(decrypted))
  },

  async generateSalt(length) {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
  },

  async generateRandomBytes(length) {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
  },

  async generateKeyPair() {
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)
    return {
      privateKey: Array.from(privateKey),
      publicKey: Array.from(publicKey),
    }
  },

  async sign(data, privateKeyBytes) {
    const signature = ed25519.sign(new Uint8Array(data), new Uint8Array(privateKeyBytes))
    return Array.from(signature)
  },

  async verify(data, signatureBytes, publicKeyBytes) {
    try {
      return ed25519.verify(
        new Uint8Array(signatureBytes),
        new Uint8Array(data),
        new Uint8Array(publicKeyBytes),
      )
    } catch {
      return false
    }
  },

  async generateX25519KeyPair() {
    const privateKey = x25519.utils.randomSecretKey()
    const publicKey = x25519.getPublicKey(privateKey)
    return {
      privateKey: Array.from(privateKey),
      publicKey: Array.from(publicKey),
    }
  },

  async ecdh(privateKey, publicKey) {
    const sharedSecret = x25519.getSharedSecret(
      new Uint8Array(privateKey),
      new Uint8Array(publicKey),
    )
    return Array.from(sharedSecret)
  },

  async hmacSha256(data, keyBytes) {
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyBytes),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const mac = await crypto.subtle.sign('HMAC', key, new Uint8Array(data))
    return Array.from(new Uint8Array(mac))
  },
}
