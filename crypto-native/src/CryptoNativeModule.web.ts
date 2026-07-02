import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { NativeModule, registerWebModule } from 'expo';

import type {
  CryptoNativeModuleEvents,
  DataBytes,
  EncryptionResult,
  KeyBytes,
  KeyPair,
  Salt,
  X25519KeyPair,
} from './CryptoNative.types';

class CryptoNativeModule extends NativeModule<CryptoNativeModuleEvents> {
  async generateSalt(length: number): Promise<Salt> {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes);
  }

  /**
   * PBKDF2-SHA256 key derivation
   */
  async deriveKey(
    password: string,
    salt: Salt,
    iterations: number,
    keyLength: number
  ): Promise<KeyBytes> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      keyLength * 8
    );

    return Array.from(new Uint8Array(derivedBits));
  }

  /**
   * AES-GCM encrypt
   */
  async encrypt(data: DataBytes, keyBytes: KeyBytes): Promise<EncryptionResult> {
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyBytes),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new Uint8Array(data)
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const ciphertext = Array.from(encryptedBytes.slice(0, -16));
    const tag = Array.from(encryptedBytes.slice(-16));

    return {
      ciphertext,
      nonce: Array.from(iv),
      tag,
    };
  }

  /**
   * AES-GCM decrypt
   */
  async decrypt(
    ciphertext: DataBytes,
    keyBytes: KeyBytes,
    nonce: DataBytes,
    tag: DataBytes
  ): Promise<DataBytes> {
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyBytes),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const fullCiphertext = new Uint8Array([...ciphertext, ...tag]);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonce) },
      key,
      fullCiphertext
    );

    return Array.from(new Uint8Array(decrypted));
  }

  /**
   * Generate Ed25519 keypair (raw 32-byte public key, 64-byte secret key).
   * Uses @noble/curves — matches native module output format exactly.
   */
  async generateKeyPair(): Promise<KeyPair> {
    const privateKey = ed25519.utils.randomSecretKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    return {
      privateKey: Array.from(privateKey),
      publicKey: Array.from(publicKey),
    };
  }

  /**
   * Sign data with Ed25519.
   */
  async sign(data: DataBytes, privateKeyBytes: KeyBytes): Promise<DataBytes> {
    const signature = ed25519.sign(new Uint8Array(data), new Uint8Array(privateKeyBytes));
    return Array.from(signature);
  }

  /**
   * Verify Ed25519 signature.
   */
  async verify(
    data: DataBytes,
    signatureBytes: DataBytes,
    publicKeyBytes: KeyBytes
  ): Promise<boolean> {
    try {
      return ed25519.verify(
        new Uint8Array(signatureBytes),
        new Uint8Array(data),
        new Uint8Array(publicKeyBytes)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate X25519 keypair for ECDH key exchange.
   * Used for password sharing: encrypting vault DEKs for recipient's public key.
   */
  async generateX25519KeyPair(): Promise<X25519KeyPair> {
    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return {
      privateKey: Array.from(privateKey),
      publicKey: Array.from(publicKey),
    };
  }

  /**
   * Perform X25519 ECDH key agreement.
   * Returns the shared secret (32 bytes) that both parties can derive.
   */
  async ecdh(privateKey: DataBytes, publicKey: DataBytes): Promise<DataBytes> {
    const sharedSecret = x25519.getSharedSecret(
      new Uint8Array(privateKey),
      new Uint8Array(publicKey)
    );
    return Array.from(sharedSecret);
  }

  /**
   * HMAC-SHA256
   */
  async hmacSha256(data: DataBytes, keyBytes: KeyBytes): Promise<DataBytes> {
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyBytes),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const mac = await crypto.subtle.sign('HMAC', key, new Uint8Array(data));
    return Array.from(new Uint8Array(mac));
  }
  async generateRandomBytes(length: number): Promise<DataBytes> {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes);
  }
}

export default registerWebModule(CryptoNativeModule, 'CryptoNativeModule');
