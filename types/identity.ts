export interface Identity {
  id: string;
  publicKey: number[];
  encryptedPrivateKey: string; // AES-GCM encrypted, base64 encoded
  salt: number[]; // Used to derive key for decrypting private key
}

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  createdAt: number;
}
