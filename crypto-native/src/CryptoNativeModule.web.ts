/**
 * Web Crypto API fallback for the crypto-native module.
 * Provides equivalent functionality using the Web Crypto API.
 */

/**
 * PBKDF2-SHA256 key derivation
 */
async function deriveKey(
  password: string,
  salt: number[],
  iterations: number,
  keyLength: number
): Promise<number[]> {
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
    keyLength * 8 // bits
  );

  return Array.from(new Uint8Array(derivedBits));
}

/**
 * AES-GCM encrypt
 */
async function encrypt(
  data: number[],
  keyBytes: number[]
): Promise<{ ciphertext: number[]; nonce: number[]; tag: number[] }> {
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
  // AES-GCM appends 16-byte auth tag at the end
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
  tag: number[]
): Promise<number[]> {
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Reassemble: ciphertext + tag
  const fullCiphertext = new Uint8Array([...ciphertext, ...tag]);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    fullCiphertext
  );

  return Array.from(new Uint8Array(decrypted));
}

/**
 * Generate Ed25519 keypair using Web Crypto API (WebCrypto doesn't support Ed25519, use EC P-256)
 */
async function generateKeyPair(): Promise<{ privateKey: number[]; publicKey: number[] }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable so we can export
    ['sign', 'verify']
  );

  const privateKeyBytes = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicKeyBytes = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  return {
    privateKey: Array.from(new Uint8Array(privateKeyBytes)),
    publicKey: Array.from(new Uint8Array(publicKeyBytes)),
  };
}

/**
 * Sign data with ECDSA
 */
async function sign(data: number[], privateKeyBytes: number[]): Promise<number[]> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    new Uint8Array(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new Uint8Array(data)
  );

  return Array.from(new Uint8Array(signature));
}

/**
 * Verify ECDSA signature
 */
async function verify(
  data: number[],
  signatureBytes: number[],
  publicKeyBytes: number[]
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      new Uint8Array(publicKeyBytes),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      new Uint8Array(signatureBytes),
      new Uint8Array(data)
    );
  } catch {
    return false;
  }
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
    ['sign']
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
  hmacSha256,

  generateRandomBytes: async (length: number): Promise<number[]> => {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes);
  },
};
