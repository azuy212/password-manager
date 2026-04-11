import CryptoNative from 'crypto-native';

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(data: number[], key: number[]): Promise<{
  ciphertext: number[];
  nonce: number[];
  tag: number[];
}> {
  return CryptoNative.encrypt(data, key);
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(
  ciphertext: number[],
  key: number[],
  nonce: number[],
  tag: number[]
): Promise<number[]> {
  return CryptoNative.decrypt(ciphertext, key, nonce, tag);
}

/**
 * Encrypt a string and return JSON-encoded encrypted result
 */
export async function encryptString(plainText: string, key: number[]): Promise<string> {
  const data = Array.from(new TextEncoder().encode(plainText));
  const result = await encrypt(data, key);

  // Store as JSON instead of base64 (btoa not available in RN)
  return JSON.stringify(result);
}

/**
 * Decrypt a JSON-encoded encrypted string
 */
export async function decryptString(encryptedJson: string, key: number[]): Promise<string> {
  const result = JSON.parse(encryptedJson);

  const decrypted = await decrypt(result.ciphertext, key, result.nonce, result.tag);
  return new TextDecoder().decode(new Uint8Array(decrypted));
}
