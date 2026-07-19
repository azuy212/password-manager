import * as impl from '../../../crypto-native/src/cryptoImpl'
import type { CryptoProvider } from '../../../core/platform/interfaces'

export const cryptoProvider: CryptoProvider = {
  deriveKey: impl.deriveKey,
  encrypt: impl.encrypt,
  decrypt: impl.decrypt,
  generateSalt: (l) => Promise.resolve(impl.generateSalt(l)),
  generateRandomBytes: (l) => Promise.resolve(impl.generateRandomBytes(l)),
  generateKeyPair: () => Promise.resolve(impl.generateKeyPair()),
  sign: (d, k) => Promise.resolve(impl.sign(d, k)),
  verify: (d, s, k) => Promise.resolve(impl.verify(d, s, k)),
  generateX25519KeyPair: () => Promise.resolve(impl.generateX25519KeyPair()),
  ecdh: (p, q) => Promise.resolve(impl.ecdh(p, q)),
  hmacSha256: impl.hmacSha256,
}
