import * as impl from '../../../crypto-native/src/cryptoImpl'
import type { CryptoProvider } from '../../../core/platform/interfaces'

export const cryptoProvider: CryptoProvider = {
  deriveKey: impl.deriveKey,
  encrypt: impl.encrypt,
  decrypt: impl.decrypt,
  generateSalt: async (l) => impl.generateSalt(l),
  generateRandomBytes: async (l) => impl.generateRandomBytes(l),
  generateKeyPair: async () => impl.generateKeyPair(),
  sign: async (d, k) => impl.sign(d, k),
  verify: async (d, s, k) => impl.verify(d, s, k),
  generateX25519KeyPair: async () => impl.generateX25519KeyPair(),
  ecdh: async (p, q) => impl.ecdh(p, q),
  hmacSha256: async (d, k) => impl.hmacSha256(d, k),
}
