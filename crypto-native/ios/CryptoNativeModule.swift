import ExpoModulesCore
import CryptoKit
import Security

public class CryptoNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CryptoNative")

    // Generate a random salt
    AsyncFunction("generateSalt") { (length: Int) -> [UInt8] in
      var salt = [UInt8](repeating: 0, count: length)
      let status = SecRandomCopyBytes(kSecRandomDefault, salt.count, &salt)
      guard status == errSecSuccess else {
        throw CryptoError.failedToGenerateRandom
      }
      return salt
    }

    // Derive key using PBKDF2 (iOS doesn't have Argon2 natively, using PBKDF2-SHA256)
    AsyncFunction("deriveKey") { (password: String, salt: [UInt8], iterations: Int, keyLength: Int) -> [UInt8] in
      let passwordData = Data(password.utf8)
      let saltData = Data(salt)
      
      var derivedKey = [UInt8](repeating: 0, count: keyLength)
      let derivationStatus = CCKeyDerivationPBKDF(
        CCPBKDFAlgorithm(kCCPBKDF2),
        password,
        passwordData.count,
        salt,
        saltData.count,
        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
        UInt32(iterations),
        &derivedKey,
        keyLength
      )
      
      guard derivationStatus == kCCSuccess else {
        throw CryptoError.keyDerivationFailed
      }
      
      return derivedKey
    }

    // AES-GCM Encrypt
    AsyncFunction("encrypt") { (data: [UInt8], keyBytes: [UInt8]) -> [String: Any] in
      let plainText = Data(data)
      let key = SymmetricKey(data: Data(keyBytes))
      
      let sealedBox = try AES.GCM.seal(plainText, using: key)
      
      return [
        "ciphertext": Array(sealedBox.ciphertext),
        "nonce": Array(sealedBox.nonce),
        "tag": Array(sealedBox.tag)
      ]
    }

    // AES-GCM Decrypt
    AsyncFunction("decrypt") { (ciphertext: [UInt8], keyBytes: [UInt8], nonce: [UInt8], tag: [UInt8]) -> [UInt8] in
      let key = SymmetricKey(data: Data(keyBytes))
      let nonceData = Data(nonce)
      let ciphertextData = Data(ciphertext)
      let tagData = Data(tag)
      
      let sealedBox = try AES.GCM.SealedBox(
        nonce: AES.GCM.Nonce(data: nonceData),
        ciphertext: ciphertextData,
        tag: tagData
      )
      
      let decrypted = try AES.GCM.open(sealedBox, using: key)
      return Array(decrypted)
    }

    // Generate KeyPair (Ed25519)
    AsyncFunction("generateKeyPair") { () -> [String: Any] in
      let privateKey = Curve25519.Signing.PrivateKey()
      let publicKey = privateKey.publicKey
      
      return [
        "privateKey": Array(privateKey.rawRepresentation),
        "publicKey": Array(publicKey.rawRepresentation)
      ]
    }

    // Sign data with private key
    AsyncFunction("sign") { (data: [UInt8], privateKeyBytes: [UInt8]) -> [UInt8] in
      guard let privateKey = try? Curve25519.Signing.PrivateKey(rawRepresentation: Data(privateKeyBytes)) else {
        throw CryptoError.invalidKey
      }
      
      let signature = try privateKey.signature(for: Data(data))
      return Array(signature)
    }

    // Verify signature with public key
    AsyncFunction("verify") { (data: [UInt8], signature: [UInt8], publicKeyBytes: [UInt8]) -> Bool in
      guard let publicKey = try? Curve25519.Signing.PublicKey(rawRepresentation: Data(publicKeyBytes)) else {
        throw CryptoError.invalidKey
      }
      
      return publicKey.isValidSignature(Data(signature), for: Data(data))
    }

    // Generate random bytes
    AsyncFunction("generateRandomBytes") { (length: Int) -> [UInt8] in
      var bytes = [UInt8](repeating: 0, count: length)
      let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
      guard status == errSecSuccess else {
        throw CryptoError.failedToGenerateRandom
      }
      return bytes
    }
  }
}

enum CryptoError: Error {
  case failedToGenerateRandom
  case keyDerivationFailed
  case encryptionFailed
  case decryptionFailed
  case invalidKey
  case invalidSignature
}
