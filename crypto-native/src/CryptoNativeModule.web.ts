import { NativeModule, registerWebModule } from 'expo';

import type { CryptoNativeModuleEvents } from './CryptoNative.types';
import * as impl from './cryptoImpl';

class CryptoNativeModule extends NativeModule<CryptoNativeModuleEvents> {
  generateSalt(length: number): number[] {
    return impl.generateSalt(length);
  }

  deriveKey(password: string, salt: number[], iterations: number, keyLength: number): Promise<number[]> {
    return impl.deriveKey(password, salt, iterations, keyLength);
  }

  encrypt(data: number[], keyBytes: number[]): Promise<impl.EncryptionResult> {
    return impl.encrypt(data, keyBytes);
  }

  decrypt(ciphertext: number[], keyBytes: number[], nonce: number[], tag: number[]): Promise<number[]> {
    return impl.decrypt(ciphertext, keyBytes, nonce, tag);
  }

  generateKeyPair(): impl.KeyPair {
    return impl.generateKeyPair();
  }

  sign(data: number[], privateKeyBytes: number[]): number[] {
    return impl.sign(data, privateKeyBytes);
  }

  verify(data: number[], signatureBytes: number[], publicKeyBytes: number[]): boolean {
    return impl.verify(data, signatureBytes, publicKeyBytes);
  }

  generateX25519KeyPair(): impl.X25519KeyPair {
    return impl.generateX25519KeyPair();
  }

  ecdh(privateKey: number[], publicKey: number[]): number[] {
    return impl.ecdh(privateKey, publicKey);
  }

  hmacSha256(data: number[], keyBytes: number[]): Promise<number[]> {
    return impl.hmacSha256(data, keyBytes);
  }

  generateRandomBytes(length: number): number[] {
    return impl.generateRandomBytes(length);
  }
}

export default registerWebModule(CryptoNativeModule, 'CryptoNativeModule');
