import CryptoNative from 'crypto-native';
import { SecureKey } from './deriveMasterKey';
import { encryptBytes, decryptBytes } from './encrypt';

// Crockford Base32 alphabet (excludes I, L, O, U to avoid confusion)
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CROCKFORD_MAP: Record<string, number> = {};
for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
  CROCKFORD_MAP[CROCKFORD_ALPHABET[i]] = i;
}

const RECOVERY_KEY_BYTES = 20; // 160 bits
const CHECK_BASE = 37;

function crockfordEncode(bytes: number[]): string {
  let bits = 0;
  let bitCount = 0;
  let result = '';
  for (const b of bytes) {
    bits = (bits << 8) | b;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      result += CROCKFORD_ALPHABET[(bits >> bitCount) & 0x1f];
    }
  }
  if (bitCount > 0) {
    result += CROCKFORD_ALPHABET[(bits << (5 - bitCount)) & 0x1f];
  }
  return result;
}

function crockfordDecode(encoded: string): number[] | null {
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];
  for (const ch of encoded.toUpperCase()) {
    const val = CROCKFORD_MAP[ch];
    if (val === undefined) return null;
    bits = (bits << 5) | val;
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
    }
  }
  return bytes;
}

function checksumChar(data: string): string {
  let sum = 0;
  for (const ch of data.toUpperCase()) {
    const val = CROCKFORD_MAP[ch];
    if (val !== undefined) sum = (sum + val) % CHECK_BASE;
  }
  return CROCKFORD_ALPHABET[sum % 32];
}

function verifyChecksum(data: string, check: string): boolean {
  return checksumChar(data) === check.toUpperCase();
}

/**
 * Generate a human-readable recovery key.
 * Returns raw bytes + formatted string with Crockford Base32 + checksum.
 */
export async function generateRecoveryKey(): Promise<{ bytes: number[]; formatted: string }> {
  const raw = await CryptoNative.generateRandomBytes(RECOVERY_KEY_BYTES);
  const encoded = crockfordEncode(raw);
  const check = checksumChar(encoded);
  const full = encoded + check;
  const groups: string[] = [];
  for (let i = 0; i < full.length; i += 4) {
    groups.push(full.substring(i, i + 4));
  }
  return { bytes: raw, formatted: groups.join('-') };
}

/**
 * Parse a formatted recovery key back into raw bytes.
 * Accepts input with or without dashes, lowercase or uppercase.
 * Returns null if format or checksum is invalid.
 */
export function parseRecoveryKey(input: string): number[] | null {
  const stripped = input.replace(/[- ]/g, '').toUpperCase();
  if (stripped.length < 2) return null;
  const encoded = stripped.slice(0, -1);
  const check = stripped.slice(-1);
  if (!verifyChecksum(encoded, check)) return null;
  const bytes = crockfordDecode(encoded);
  if (!bytes || bytes.length !== RECOVERY_KEY_BYTES) return null;
  return bytes;
}

export function validateRecoveryKeyFormat(input: string): boolean {
  return parseRecoveryKey(input) !== null;
}

async function deriveAESKey(recoveryBytes: number[]): Promise<number[]> {
  const zeroKey = new Array(32).fill(0);
  return await CryptoNative.hmacSha256(recoveryBytes, zeroKey);
}

/**
 * Encrypt VEK with recovery key bytes.
 * Derives AES-256 key via HMAC-SHA256 for AES-GCM compatibility.
 * Returns JSON-encrypted string suitable for cloud storage.
 */
export async function encryptVEKWithRecoveryKey(
  vekBytes: number[],
  recoveryBytes: number[]
): Promise<string> {
  const aesKey = await deriveAESKey(recoveryBytes);
  const recoveryKey = new SecureKey(aesKey);
  try {
    return await encryptBytes(vekBytes, recoveryKey);
  } finally {
    recoveryKey.destroy();
  }
}

/**
 * Decrypt VEK from recovery-key-encrypted blob.
 * Returns raw VEK bytes on success, null on failure.
 */
export async function decryptVEKWithRecoveryKey(
  encryptedVEK: string,
  recoveryBytes: number[]
): Promise<number[] | null> {
  const aesKey = await deriveAESKey(recoveryBytes);
  const recoveryKey = new SecureKey(aesKey);
  try {
    return await decryptBytes(encryptedVEK, recoveryKey);
  } catch {
    return null;
  } finally {
    recoveryKey.destroy();
  }
}
