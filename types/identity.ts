export interface Identity {
  id: string;
  publicKey: number[];
  encryptedPrivateKey: string;       // Ed25519 private key, AES-GCM encrypted with master key
  salt: number[];                    // PBKDF2 salt, used to re-derive the master key
  x25519PublicKey?: number[];        // X25519 public key for ECDH sharing
  encryptedX25519PrivateKey?: string; // X25519 private key, AES-GCM encrypted with master key
}
