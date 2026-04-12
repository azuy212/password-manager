import CryptoNative from 'crypto-native';
import { SecureKey } from './deriveMasterKey';
import { stringToBytes, bytesToString } from '@/utils/encoding';

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(data: number[], key: SecureKey): Promise<{
  ciphertext: number[];
  nonce: number[];
  tag: number[];
}> {
  return CryptoNative.encrypt(data, key.toArray());
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(
  ciphertext: number[],
  key: SecureKey,
  nonce: number[],
  tag: number[]
): Promise<number[]> {
  return CryptoNative.decrypt(ciphertext, key.toArray(), nonce, tag);
}

/**
 * Constant-time byte comparison to prevent timing attacks
 */
function constantTimeEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Derive an HMAC key from the master key using PBKDF2
 * Uses the actual master key bytes (not a constant string)
 */
async function deriveHmacKeyFromMasterKey(masterKey: SecureKey): Promise<number[]> {
  // Domain-separated salt for HMAC key derivation
  const hmacSalt = [0x48, 0x4d, 0x41, 0x43, 0x2d, 0x4b, 0x65, 0x79]; // "HMAC-Key"
  const keyBytes = masterKey.toArray();
  return CryptoNative.deriveKey(
    String.fromCharCode(...keyBytes),
    hmacSalt,
    100000,
    32
  );
}

/**
 * Compute HMAC-SHA256 for integrity verification using native module
 */
async function computeHmac(data: string, hmacKeyBytes: number[]): Promise<number[]> {
  const dataBytes = stringToBytes(data);
  return CryptoNative.hmacSha256(dataBytes, hmacKeyBytes);
}

/**
 * Encrypt a string and return JSON-encoded encrypted result with HMAC
 */
export async function encryptString(plainText: string, key: SecureKey): Promise<string> {
  const data = stringToBytes(plainText);
  const result = await encrypt(data, key);

  // Compute HMAC over the ciphertext for integrity
  const hmacKeyBytes = await deriveHmacKeyFromMasterKey(key);
  const ciphertextJson = JSON.stringify(result);
  const hmacBytes = await computeHmac(ciphertextJson, hmacKeyBytes);
  // Clear HMAC key from memory
  hmacKeyBytes.fill(0);

  return JSON.stringify({ ...result, hmac: hmacBytes });
}

/**
 * Decrypt a JSON-encoded encrypted string with HMAC verification
 */
export async function decryptString(encryptedJson: string, key: SecureKey): Promise<string> {
  // Safe JSON parse — prevent prototype pollution
  const parsed = safeJsonParse(encryptedJson);

  const storedHmac = parsed.hmac as number[] | undefined;
  if (!storedHmac || !Array.isArray(storedHmac)) {
    throw new Error('Missing HMAC — data may be corrupted or tampered');
  }

  const { hmac, ...cryptoResult } = parsed;

  // Verify HMAC before decrypting
  const hmacKeyBytes = await deriveHmacKeyFromMasterKey(key);
  const ciphertextJson = JSON.stringify(cryptoResult);
  const expectedHmacBytes = await computeHmac(ciphertextJson, hmacKeyBytes);
  // Clear HMAC key from memory
  hmacKeyBytes.fill(0);

  // Constant-time comparison
  if (!constantTimeEqual(storedHmac, expectedHmacBytes)) {
    throw new Error('HMAC verification failed — data may have been tampered with');
  }

  const decrypted = await decrypt(cryptoResult.ciphertext as number[], key, cryptoResult.nonce as number[], cryptoResult.tag as number[]);
  return bytesToString(decrypted);
}

/**
 * Safe JSON parser — strips dangerous keys to prevent prototype pollution
 */
function safeJsonParse(json: string): Record<string, unknown> {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  const parsed = JSON.parse(json, (key, value) => {
    if (typeof key === 'string' && dangerousKeys.includes(key)) {
      return undefined;
    }
    return value;
  });

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid encrypted data format');
  }

  return parsed as Record<string, unknown>;
}
