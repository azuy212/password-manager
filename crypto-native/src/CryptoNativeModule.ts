import { NativeModule, requireNativeModule } from 'expo';

import { CryptoNativeModuleEvents, EncryptionResult, KeyBytes, KeyPair, Salt, DataBytes } from './CryptoNative.types';

declare class CryptoNativeModule extends NativeModule<CryptoNativeModuleEvents> {
  generateSalt(length: number): Promise<Salt>;
  deriveKey(password: string, salt: Salt, iterations: number, keyLength: number): Promise<KeyBytes>;
  encrypt(data: DataBytes, key: KeyBytes): Promise<EncryptionResult>;
  decrypt(ciphertext: DataBytes, key: KeyBytes, nonce: DataBytes, tag: DataBytes): Promise<DataBytes>;
  generateKeyPair(): Promise<KeyPair>;
  sign(data: DataBytes, privateKey: KeyBytes): Promise<DataBytes>;
  verify(data: DataBytes, signature: DataBytes, publicKey: KeyBytes): Promise<boolean>;
  hmacSha256(data: DataBytes, key: KeyBytes): Promise<DataBytes>;
  generateRandomBytes(length: number): Promise<DataBytes>;
}

export default requireNativeModule<CryptoNativeModule>('CryptoNative');
