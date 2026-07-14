import { secureStorage } from '@/utils/secureStorage';
import CryptoNative from 'crypto-native';
import { encryptBytes, decryptBytes, SecureKey } from '@/core/crypto';

const DUK_KEY = 'device_unlock_key';
const ENCRYPTED_VEK_DEVICE_KEY = 'encrypted_vek_device';

/**
 * Check if biometric hardware is available on this device.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Check if biometric unlock has been set up.
 */
export async function isBiometricUnlockEnabled(): Promise<boolean> {
  try {
    const duk = await secureStorage.getItem(DUK_KEY);
    const encrypted = await secureStorage.getItem(ENCRYPTED_VEK_DEVICE_KEY);
    return !!duk && !!encrypted;
  } catch {
    return false;
  }
}

/**
 * Set up biometric unlock for the current device.
 * Generates a Device Unlock Key (DUK), stores it in SecureStore (biometric-gated),
 * and stores the VEK encrypted with DUK.
 */
export async function setupBiometricUnlock(vek: SecureKey): Promise<boolean> {
  try {
    const SecureStore = require('expo-secure-store');

    // Generate DUK (256-bit random)
    const dukBytes = await CryptoNative.generateRandomBytes(32);
    const duk = new SecureKey(dukBytes);

    // Encrypt VEK with DUK
    const encryptedVEK = await encryptBytes(vek.toArray(), duk);

    // Store DUK in biometric-gated SecureStore
    await SecureStore.setItemAsync(DUK_KEY, JSON.stringify(Array.from(dukBytes)), {
      requireAuthentication: true,
      authenticationType: SecureStore.AuthenticationType.Biometric,
    });

    // Store encrypted VEK in regular SecureStore (already encrypted)
    await secureStorage.setItem(ENCRYPTED_VEK_DEVICE_KEY, encryptedVEK);

    duk.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Unlock using biometrics.
 * Prompts Face ID / Touch ID, releases DUK from Keychain, decrypts VEK.
 * Returns VEK as SecureKey (caller must destroy after use).
 * Returns null if user cancels or biometrics fail.
 */
export async function unlockWithBiometrics(): Promise<SecureKey | null> {
  try {
    const SecureStore = require('expo-secure-store');

    // Retrieve DUK — triggers biometric prompt
    const dukJson = await SecureStore.getItemAsync(DUK_KEY, {
      requireAuthentication: true,
      authenticationType: SecureStore.AuthenticationType.Biometric,
    });
    if (!dukJson) return null;

    const dukBytes: number[] = JSON.parse(dukJson);
    const duk = new SecureKey(dukBytes);

    // Retrieve encrypted VEK
    const encryptedVEK = await secureStorage.getItem(ENCRYPTED_VEK_DEVICE_KEY);
    if (!encryptedVEK) {
      duk.destroy();
      return null;
    }

    // Decrypt VEK
    const vekBytes = await decryptBytes(encryptedVEK, duk);
    duk.destroy();

    return new SecureKey(vekBytes);
  } catch {
    return null;
  }
}

/**
 * Disable biometric unlock.
 * Deletes DUK and encrypted VEK from SecureStore.
 */
export async function disableBiometricUnlock(): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync(DUK_KEY).catch(() => {});
  } catch {}
  await secureStorage.deleteItem(ENCRYPTED_VEK_DEVICE_KEY).catch(() => {});
}
