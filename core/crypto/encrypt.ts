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
 * Decrypt data using AES-GCM.
 * The native module verifies the AES-GCM authentication tag and throws on tamper.
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
 * Encrypt a string and return JSON-encoded encrypted result.
 * Integrity is provided by AES-GCM's built-in authentication tag — no separate HMAC needed.
 */
export async function encryptString(plainText: string, key: SecureKey): Promise<string> {
  const data = stringToBytes(plainText);
  const result = await encrypt(data, key);
  return JSON.stringify(result);
}

/**
 * Decrypt a JSON-encoded encrypted string.
 * AES-GCM authentication tag verification is handled by the native module.
 */
export async function decryptString(encryptedJson: string, key: SecureKey): Promise<string> {
  const parsed = parseEncryptedJson(encryptedJson);
  const decrypted = await decrypt(parsed.ciphertext, key, parsed.nonce, parsed.tag);
  return bytesToString(decrypted);
}

/**
 * Encrypt arbitrary bytes and return JSON-encoded encrypted result.
 * Use instead of encryptString when the input may contain arbitrary binary data.
 */
export async function encryptBytes(data: number[], key: SecureKey): Promise<string> {
  const result = await encrypt(data, key);
  return JSON.stringify(result);
}

/**
 * Decrypt a JSON-encoded encrypted payload back to raw bytes.
 * Use instead of decryptString when the output should be binary data.
 */
export async function decryptBytes(encryptedJson: string, key: SecureKey): Promise<number[]> {
  const parsed = parseEncryptedJson(encryptedJson);
  return decrypt(parsed.ciphertext, key, parsed.nonce, parsed.tag);
}

/**
 * Parse and validate an encrypted JSON payload.
 * Returns typed fields; throws on malformed input.
 */
function parseEncryptedJson(json: string): { ciphertext: number[]; nonce: number[]; tag: number[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid encrypted data — not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid encrypted data format — expected an object');
  }

  const obj = parsed as Record<string, unknown>;
  const { ciphertext, nonce, tag } = obj;

  if (!Array.isArray(ciphertext) || !Array.isArray(nonce) || !Array.isArray(tag)) {
    throw new Error('Invalid encrypted data — missing or malformed ciphertext, nonce, or tag');
  }

  return {
    ciphertext: ciphertext as number[],
    nonce: nonce as number[],
    tag: tag as number[],
  };
}
