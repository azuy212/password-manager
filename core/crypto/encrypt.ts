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
 * Encrypt a string and return base64-encoded result
 */
export async function encryptString(plainText: string, key: number[]): Promise<string> {
  const data = Array.from(new TextEncoder().encode(plainText));
  const result = await encrypt(data, key);
  
  // Combine nonce + tag + ciphertext and encode as base64
  const combined = [...result.nonce, ...result.tag, ...result.ciphertext];
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded encrypted string
 */
export async function decryptString(encryptedBase64: string, key: number[]): Promise<string> {
  const binary = atob(encryptedBase64);
  const combined = Array.from(binary).map(c => c.charCodeAt(0));
  
  // Extract nonce (12 bytes for AES-GCM), tag (16 bytes), and ciphertext
  const nonceLength = 12;
  const tagLength = 16;
  
  const nonce = combined.slice(0, nonceLength);
  const tag = combined.slice(nonceLength, nonceLength + tagLength);
  const ciphertext = combined.slice(nonceLength + tagLength);
  
  const decrypted = await decrypt(ciphertext, key, nonce, tag);
  return new TextDecoder().decode(new Uint8Array(decrypted));
}
