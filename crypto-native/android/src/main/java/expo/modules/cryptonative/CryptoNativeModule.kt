package expo.modules.cryptonative

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyPairGenerator
import java.security.KeyFactory
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class CryptoNativeModule : Module() {
  // Use default SecureRandom — getInstanceStrong() fails on some emulators
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
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, secureRandom)

      val ciphertext = cipher.doFinal(plainText)
      val nonce = cipher.iv
      val tag = ciphertext.takeLast(16)

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

    // Generate KeyPair using Ed25519 (EdDSA) — Android API 28+
    AsyncFunction("generateKeyPair") {
      try {
        // Try Ed25519 first (API 28+)
        val keyPairGenerator = KeyPairGenerator.getInstance("Ed25519")
        keyPairGenerator.initialize(256)
        val keyPair = keyPairGenerator.generateKeyPair()

        mapOf(
          "privateKey" to keyPair.private.encoded.toList().map { it.toUByte().toInt() },
          "publicKey" to keyPair.public.encoded.toList().map { it.toUByte().toInt() }
        )
      } catch (e: Exception) {
        // Fallback to EC with P-256 curve (available on all Android versions)
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        val keyPair = keyPairGenerator.generateKeyPair()

        mapOf(
          "privateKey" to keyPair.private.encoded.toList().map { it.toUByte().toInt() },
          "publicKey" to keyPair.public.encoded.toList().map { it.toUByte().toInt() }
        )
      }
    }

    // Sign data with Ed25519 (or EC fallback)
    AsyncFunction("sign") { data: List<Int>, privateKeyBytes: List<Int> ->
      try {
        val keySpec = PKCS8EncodedKeySpec(privateKeyBytes.map { it.toByte() }.toByteArray())
        val privateKey = KeyFactory.getInstance("Ed25519").generatePrivate(keySpec)

        val signature = Signature.getInstance("Ed25519")
        signature.initSign(privateKey)
        signature.update(data.map { it.toByte() }.toByteArray())
        signature.sign().toList().map { it.toUByte().toInt() }
      } catch (e: Exception) {
        // Fallback to EC with SHA256
        val keySpec = PKCS8EncodedKeySpec(privateKeyBytes.map { it.toByte() }.toByteArray())
        val privateKey = KeyFactory.getInstance("EC").generatePrivate(keySpec)

        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey)
        signature.update(data.map { it.toByte() }.toByteArray())
        signature.sign().toList().map { it.toUByte().toInt() }
      }
    }

    // Verify signature
    AsyncFunction("verify") { data: List<Int>, signatureBytes: List<Int>, publicKeyBytes: List<Int> ->
      try {
        val keySpec = X509EncodedKeySpec(publicKeyBytes.map { it.toByte() }.toByteArray())
        val publicKey = KeyFactory.getInstance("Ed25519").generatePublic(keySpec)

        val signature = Signature.getInstance("Ed25519")
        signature.initVerify(publicKey)
        signature.update(data.map { it.toByte() }.toByteArray())
        signature.verify(signatureBytes.map { it.toByte() }.toByteArray())
      } catch (e: Exception) {
        try {
          // Fallback to EC with SHA256
          val keySpec = X509EncodedKeySpec(publicKeyBytes.map { it.toByte() }.toByteArray())
          val publicKey = KeyFactory.getInstance("EC").generatePublic(keySpec)

          val signature = Signature.getInstance("SHA256withECDSA")
          signature.initVerify(publicKey)
          signature.update(data.map { it.toByte() }.toByteArray())
          signature.verify(signatureBytes.map { it.toByte() }.toByteArray())
        } catch (e2: Exception) {
          false
        }
      }
    }

    // HMAC-SHA256
    AsyncFunction("hmacSha256") { data: List<Int>, keyBytes: List<Int> ->
      val mac = javax.crypto.Mac.getInstance("HmacSHA256")
      val keySpec = javax.crypto.spec.SecretKeySpec(keyBytes.map { it.toByte() }.toByteArray(), "HmacSHA256")
      mac.init(keySpec)
      mac.doFinal(data.map { it.toByte() }.toByteArray()).toList().map { it.toUByte().toInt() }
    }

    // Generate random bytes
    AsyncFunction("generateRandomBytes") { length: Int ->
      val bytes = ByteArray(length)
      secureRandom.nextBytes(bytes)
      bytes.toList().map { it.toUByte().toInt() }
    }
  }
}
