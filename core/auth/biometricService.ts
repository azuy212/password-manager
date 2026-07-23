import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import CryptoNative from 'crypto-native';
import { secureStorage } from '@/utils/secureStorage';
import { encryptBytes, decryptBytes, SecureKey } from '@/core/crypto';

const DUK_KEY = 'device_unlock_key';
const BIOMETRIC_ENABLED_KEY = 'biometric_unlock_enabled';
const ENCRYPTED_VEK_DEVICE_KEY = 'encrypted_vek_device';

/**
 * Check if biometric hardware is available AND enrolled on this device.
 * Uses expo-local-authentication which properly checks Android/iOS biometric capability.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Check if biometric unlock has been set up.
 * Uses a plain boolean flag — no biometric prompt needed just to check.
 */
export async function isBiometricUnlockEnabled(): Promise<boolean> {
  try {
    const flag = await secureStorage.getItem(BIOMETRIC_ENABLED_KEY);
    const encrypted = await secureStorage.getItem(ENCRYPTED_VEK_DEVICE_KEY);
    return flag === 'true' && !!encrypted;
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
    // Generate DUK (256-bit random)
    const dukBytes = await CryptoNative.generateRandomBytes(32);
    const duk = new SecureKey(dukBytes);

    // Encrypt VEK with DUK
    const encryptedVEK = await encryptBytes(vek.toArray(), duk);

    // Store DUK in biometric-gated SecureStore.
    // On Android: encrypt + store triggers system biometric prompt.
    // On iOS: stores with kSecAccessControlBiometryCurrentSet (prompts on read).
    await SecureStore.setItemAsync(DUK_KEY, JSON.stringify(Array.from(dukBytes)), {
      requireAuthentication: true,
    });

    // Store encrypted VEK in regular SecureStore (already encrypted)
    await secureStorage.setItem(ENCRYPTED_VEK_DEVICE_KEY, encryptedVEK);

    // Store plain boolean flag — no biometric prompt needed to read this
    await secureStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');

    duk.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Unlock using biometrics.
 * Prompts biometric (iOS: Keychain access control, Android: Keystore auth),
 * releases DUK, decrypts and returns VEK.
 * Caller MUST destroy returned SecureKey after use.
 * Returns null if user cancels or biometrics fail.
 */
export async function unlockWithBiometrics(): Promise<SecureKey | null> {
  try {
    // Retrieve DUK — triggers biometric prompt
    const dukJson = await SecureStore.getItemAsync(DUK_KEY, {
      requireAuthentication: true,
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
 * Deletes DUK, encrypted VEK, and boolean flag from storage.
 */
export async function disableBiometricUnlock(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DUK_KEY);
  } catch {}
  await secureStorage.deleteItem(ENCRYPTED_VEK_DEVICE_KEY).catch(() => {});
  await secureStorage.deleteItem(BIOMETRIC_ENABLED_KEY).catch(() => {});
}
