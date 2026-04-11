import CryptoNative from 'crypto-native';
import { SecureKey, deriveHmacKey } from './deriveMasterKey';
import { stringToBytes, bytesToString } from '@/utils/encoding';

/**
 * Encrypt data using AES-GCM with HMAC integrity
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
 * Compute HMAC-SHA256 for integrity verification using native module
 */
async function computeHmac(data: string, key: SecureKey): Promise<string> {
  const dataBytes = stringToBytes(data);
  const hmacBytes = await CryptoNative.hmacSha256(dataBytes, key.toArray());
  return hmacBytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt a string and return JSON-encoded encrypted result with HMAC
 */
export async function encryptString(plainText: string, key: SecureKey): Promise<string> {
  const data = stringToBytes(plainText);
  const result = await encrypt(data, key);

  // Compute HMAC over the ciphertext for integrity
  const ciphertextJson = JSON.stringify(result);
  const hmacKey = await deriveHmacKey(key);
  const hmac = await computeHmac(ciphertextJson, hmacKey);
  hmacKey.destroy();

  return JSON.stringify({ ...result, hmac });
}

/**
 * Decrypt a JSON-encoded encrypted string with HMAC verification
 */
export async function decryptString(encryptedJson: string, key: SecureKey): Promise<string> {
  const parsed = JSON.parse(encryptedJson);

  if (!parsed.hmac) {
    throw new Error('Missing HMAC — data may be corrupted or tampered');
  }

  // Verify HMAC before decrypting
  const { hmac, ...cryptoResult } = parsed;
  const ciphertextJson = JSON.stringify(cryptoResult);
  const hmacKey = await deriveHmacKey(key);
  const expectedHmac = await computeHmac(ciphertextJson, hmacKey);
  hmacKey.destroy();

  if (hmac !== expectedHmac) {
    throw new Error('HMAC verification failed — data may have been tampered with');
  }

  const decrypted = await decrypt(cryptoResult.ciphertext, key, cryptoResult.nonce, cryptoResult.tag);
  return bytesToString(decrypted);
}
