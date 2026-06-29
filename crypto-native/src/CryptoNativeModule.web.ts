/**
 * Web Crypto API fallback for the crypto-native module.
 * Uses @noble/curves for Ed25519 and X25519 (not natively supported by Web Crypto),
 * and the Web Crypto API for PBKDF2, AES-GCM, and HMAC.
 */

import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import type { X25519KeyPair } from './CryptoNative.types';

/**
 * PBKDF2-SHA256 key derivation
 */
async function deriveKey(
  password: string,
  salt: number[],
  iterations: number,
  keyLength: number,
): Promise<number[]> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    keyLength * 8,
  );

  return Array.from(new Uint8Array(derivedBits));
}

/**
 * AES-GCM encrypt
 */
async function encrypt(
  data: number[],
  keyBytes: number[],
): Promise<{ ciphertext: number[]; nonce: number[]; tag: number[] }> {
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new Uint8Array(data),
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
async function decrypt(
  ciphertext: number[],
  keyBytes: number[],
  nonce: number[],
  tag: number[],
): Promise<number[]> {
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const fullCiphertext = new Uint8Array([...ciphertext, ...tag]);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    fullCiphertext,
  );

  return Array.from(new Uint8Array(decrypted));
}

/**
 * Generate Ed25519 keypair (raw 32-byte public key, 64-byte secret key).
 * Uses @noble/curves — matches native module output format exactly.
 */
async function generateKeyPair(): Promise<{ privateKey: number[]; publicKey: number[] }> {
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
async function sign(data: number[], privateKeyBytes: number[]): Promise<number[]> {
  const signature = ed25519.sign(new Uint8Array(data), new Uint8Array(privateKeyBytes));
  return Array.from(signature);
}

/**
 * Verify Ed25519 signature.
 */
async function verify(
  data: number[],
  signatureBytes: number[],
  publicKeyBytes: number[],
): Promise<boolean> {
  try {
    return ed25519.verify(
      new Uint8Array(signatureBytes),
      new Uint8Array(data),
      new Uint8Array(publicKeyBytes),
    );
  } catch {
    return false;
  }
}

/**
 * Generate X25519 keypair for ECDH key exchange.
 * Used for password sharing: encrypting vault DEKs for recipient's public key.
 */
async function generateX25519KeyPair(): Promise<X25519KeyPair> {
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
async function ecdh(privateKey: number[], publicKey: number[]): Promise<number[]> {
  const sharedSecret = x25519.getSharedSecret(
    new Uint8Array(privateKey),
    new Uint8Array(publicKey),
  );
  return Array.from(sharedSecret);
}

/**
 * HMAC-SHA256
 */
async function hmacSha256(data: number[], keyBytes: number[]): Promise<number[]> {
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign('HMAC', key, new Uint8Array(data));
  return Array.from(new Uint8Array(mac));
}

export default {
  generateSalt: async (length: number): Promise<number[]> => {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes);
  },

  deriveKey,
  encrypt,
  decrypt,
  generateKeyPair,
  sign,
  verify,
  generateX25519KeyPair,
  ecdh,
  hmacSha256,

  generateRandomBytes: async (length: number): Promise<number[]> => {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes);
  },
};
