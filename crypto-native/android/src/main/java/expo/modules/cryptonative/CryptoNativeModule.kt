package expo.modules.cryptonative

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class CryptoNativeModule : Module() {
  private val secureRandom = SecureRandom()

  override fun definition() = ModuleDefinition {
    Name("CryptoNative")

    // Generate a random salt
    AsyncFunction("generateSalt") { length: Int ->
      val salt = ByteArray(length)
      secureRandom.nextBytes(salt)
      salt.toList().map { it.toUByte().toInt() }
    }

    // Derive key using PBKDF2
    AsyncFunction("deriveKey") { password: String, salt: List<Int>, iterations: Int, keyLength: Int ->
      val saltBytes = salt.map { it.toByte() }.toByteArray()
      val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      val spec = javax.crypto.spec.PBEKeySpec(password.toCharArray(), saltBytes, iterations, keyLength * 8)
      val key = factory.generateSecret(spec)
      key.encoded.toList().map { it.toUByte().toInt() }
    }

    // AES-GCM Encrypt
    AsyncFunction("encrypt") { data: List<Int>, keyBytes: List<Int> ->
      val plainText = data.map { it.toByte() }.toByteArray()
      val keyData = keyBytes.map { it.toByte() }.toByteArray()
      val secretKey = SecretKeySpec(keyData, "AES")
      
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, secretKey)
      
      val ciphertext = cipher.doFinal(plainText)
      val nonce = cipher.iv
      val tag = ciphertext.takeLast(16) // GCM tag is last 16 bytes
      
      mapOf(
        "ciphertext" to ciphertext.dropLast(16).map { it.toUByte().toInt() },
        "nonce" to nonce.toList().map { it.toUByte().toInt() },
        "tag" to tag.map { it.toUByte().toInt() }
      )
    }

    // AES-GCM Decrypt
    AsyncFunction("decrypt") { ciphertext: List<Int>, keyBytes: List<Int>, nonce: List<Int>, tag: List<Int> ->
      val keyData = keyBytes.map { it.toByte() }.toByteArray()
      val secretKey = SecretKeySpec(keyData, "AES")
      
      val nonceData = nonce.map { it.toByte() }.toByteArray()
      val ciphertextBytes = ciphertext.map { it.toByte() }.toByteArray()
      val tagBytes = tag.map { it.toByte() }.toByteArray()
      
      val fullCiphertext = ciphertextBytes + tagBytes
      
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      val spec = GCMParameterSpec(128, nonceData)
      cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
      
      val decrypted = cipher.doFinal(fullCiphertext)
      decrypted.toList().map { it.toUByte().toInt() }
    }

    // Generate KeyPair (Ed25519/EdDSA)
    AsyncFunction("generateKeyPair") {
      // For Android, we'll use simple RSA keypair for compatibility
      // In production, consider BouncyCastle for Ed25519
      val keyPairGenerator = KeyPairGenerator.getInstance("RSA")
      keyPairGenerator.initialize(2048)
      val keyPair = keyPairGenerator.generateKeyPair()
      
      mapOf(
        "privateKey" to keyPair.private.encoded.toList().map { it.toUByte().toInt() },
        "publicKey" to keyPair.public.encoded.toList().map { it.toUByte().toInt() }
      )
    }

    // Sign data
    AsyncFunction("sign") { data: List<Int>, privateKeyBytes: List<Int> ->
      // Simplified signing - in production use proper Ed25519
      val signature = Signature.getInstance("SHA256withRSA")
      signature.initSign(java.security.KeyFactory.getInstance("RSA")
        .generatePrivate(java.security.spec.PKCS8EncodedKeySpec(privateKeyBytes.map { it.toByte() }.toByteArray())))
      signature.update(data.map { it.toByte() }.toByteArray())
      signature.sign().toList().map { it.toUByte().toInt() }
    }

    // Verify signature
    AsyncFunction("verify") { data: List<Int>, signatureBytes: List<Int>, publicKeyBytes: List<Int> ->
      try {
        val signature = Signature.getInstance("SHA256withRSA")
        signature.initVerify(java.security.KeyFactory.getInstance("RSA")
          .generatePublic(java.security.spec.X509EncodedKeySpec(publicKeyBytes.map { it.toByte() }.toByteArray())))
        signature.update(data.map { it.toByte() }.toByteArray())
        signature.verify(signatureBytes.map { it.toByte() }.toByteArray())
      } catch (e: Exception) {
        false
      }
    }

    // Generate random bytes
    AsyncFunction("generateRandomBytes") { length: Int ->
      val bytes = ByteArray(length)
      secureRandom.nextBytes(bytes)
      bytes.toList().map { it.toUByte().toInt() }
    }
  }
}
