import { ed25519, x25519 } from '@noble/curves/ed25519.js';

export type Salt = number[];
export type KeyBytes = number[];
export type DataBytes = number[];
export type EncryptionResult = { ciphertext: number[]; nonce: number[]; tag: number[] };
export type KeyPair = { privateKey: number[]; publicKey: number[] };
export type X25519KeyPair = { privateKey: number[]; publicKey: number[] };

export function generateSalt(length: number): Salt {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)));
}

export async function deriveKey(
  password: string,
  salt: Salt,
  iterations: number,
  keyLength: number,
): Promise<KeyBytes> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    keyLength * 8,
  );
  return Array.from(new Uint8Array(derivedBits));
}

export async function encrypt(data: DataBytes, keyBytes: KeyBytes): Promise<EncryptionResult> {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBytes), { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(data));
  const encryptedBytes = new Uint8Array(encrypted);
  return { ciphertext: Array.from(encryptedBytes.slice(0, -16)), nonce: Array.from(iv), tag: Array.from(encryptedBytes.slice(-16)) };
}

export async function decrypt(ciphertext: DataBytes, keyBytes: KeyBytes, nonce: DataBytes, tag: DataBytes): Promise<DataBytes> {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBytes), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const fullCiphertext = new Uint8Array([...ciphertext, ...tag]);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(nonce) }, key, fullCiphertext);
  return Array.from(new Uint8Array(decrypted));
}

export function generateKeyPair(): KeyPair {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey: Array.from(privateKey), publicKey: Array.from(publicKey) };
}

export function sign(data: DataBytes, privateKeyBytes: KeyBytes): DataBytes {
  return Array.from(ed25519.sign(new Uint8Array(data), new Uint8Array(privateKeyBytes)));
}

export function verify(data: DataBytes, signatureBytes: DataBytes, publicKeyBytes: KeyBytes): boolean {
  try {
    return ed25519.verify(new Uint8Array(signatureBytes), new Uint8Array(data), new Uint8Array(publicKeyBytes));
  } catch {
    return false;
  }
}

export function generateX25519KeyPair(): X25519KeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey: Array.from(privateKey), publicKey: Array.from(publicKey) };
}

export function ecdh(privateKey: DataBytes, publicKey: DataBytes): DataBytes {
  return Array.from(x25519.getSharedSecret(new Uint8Array(privateKey), new Uint8Array(publicKey)));
}

export async function hmacSha256(data: DataBytes, keyBytes: KeyBytes): Promise<DataBytes> {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new Uint8Array(data));
  return Array.from(new Uint8Array(mac));
}

export function generateRandomBytes(length: number): DataBytes {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)));
}
