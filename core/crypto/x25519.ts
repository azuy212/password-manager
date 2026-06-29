import { x25519 } from '@noble/curves/ed25519.js';

export interface X25519KeyPair {
  privateKey: number[];
  publicKey: number[];
}

export function generateX25519KeyPair(): X25519KeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey: Array.from(privateKey),
    publicKey: Array.from(publicKey),
  };
}

export function ecdh(privateKey: number[], publicKey: number[]): number[] {
  const sharedSecret = x25519.getSharedSecret(
    new Uint8Array(privateKey),
    new Uint8Array(publicKey),
  );
  return Array.from(sharedSecret);
}
