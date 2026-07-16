import { useState, useCallback, useEffect } from 'react';
import {
  unlockIdentity,
  hasIdentity,
  getIdentity,
  bootstrapIdentityFromCloud,
  getStoredSupabaseUserId,
  fetchUserProfile,
  migrateV1ToV2,
} from './identityService';
import { supabaseSignIn } from './supabaseAuthService';
import { isBiometricUnlockEnabled, unlockWithBiometrics } from './biometricService';
import { setPasswordKey, setCachedEncryptedVEK } from '../keyStore';
import type { SecureKey } from '../crypto';

export interface UnlockResult {
  passwordKey: SecureKey;
  supabaseUserId: string;
  needsMigration?: boolean;
  migrationRecoveryKey?: string;
  migrationWaiting?: boolean;
}

interface UseUnlockReturn {
  isUnlocked: boolean;
  hasIdentity: boolean;
  biometricUnlockAvailable: boolean;
  unlock: (email: string, password: string) => Promise<UnlockResult | { error: string }>;
  unlockWithBio: () => Promise<UnlockResult | { error: string }>;
  confirmMigration: () => Promise<void>;
  pendingMigrationRecoveryKey: string | null;
  lock: () => void;
}

/**
 * Hook to manage unlock state.
 *
 * v2 flow (VEK-based):
 *  1. Sign in to Supabase
 *  2. Fetch user profile (salt, publicKey, encryptedVEKPassword, cryptoVersion)
 *  3. If cryptoVersion === 1 → run migration
 *  4. Derive PasswordKey from password + salt
 *  5. Decrypt VEK from encryptedVEKPassword
 *  6. Verify by decrypting Ed25519 private key
 *  7. Cache PasswordKey + encryptedVEKPassword
 */
export function useUnlock(): UseUnlockReturn {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasIdentityState, setHasIdentityState] = useState<boolean | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pendingMigrationRecoveryKey, setPendingMigrationRecoveryKey] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);

  useEffect(() => {
    hasIdentity().then(setHasIdentityState);
    isBiometricUnlockEnabled().then(setBiometricAvailable);
  }, []);

  const unlock = useCallback(async (
    email: string,
    password: string,
  ): Promise<UnlockResult | { error: string }> => {
    const signInResult = await supabaseSignIn(email, password);
    if (!signInResult.success) {
      return { error: signInResult.error || 'Failed to sign in to cloud' };
    }
    const supabaseUserId = signInResult.userId!;

    const localIdentity = await getIdentity();
    if (localIdentity) {
      const profile = await fetchUserProfile(supabaseUserId);
      if ('error' in profile) {
        return { error: profile.error };
      }

      // Check if migration needed
      if (profile.cryptoVersion < 2 || !profile.encryptedVEKPassword) {
        // Run migration
        const migrationResult = await migrateV1ToV2(password);
        if ('error' in migrationResult) {
          return { error: migrationResult.error };
        }
        // Store pending migration recovery key — user must confirm before proceeding
        setPendingMigrationRecoveryKey(migrationResult.recoveryKey);
        setPendingPassword(password);
        return {
          passwordKey: null as unknown as SecureKey,
          supabaseUserId,
          needsMigration: true,
          migrationWaiting: true,
        };
      }

      // Standard v2 unlock
      const unlockResult = await unlockIdentity(password, profile.encryptedVEKPassword);
      if (unlockResult && !('error' in unlockResult)) {
        // Local identity succeeded
        setPasswordKey(unlockResult.passwordKey);
        setCachedEncryptedVEK(unlockResult.encryptedVEKPassword);
        setIsUnlocked(true);
        return { passwordKey: unlockResult.passwordKey, supabaseUserId };
      }
      // Local identity failed (e.g. stale salt after password change on another device).
      // Fall through to bootstrap path, which uses cloud salt + cloud encryptedVEK.
    }

    // Second device — bootstrap from cloud
    const profile = await fetchUserProfile(supabaseUserId);
    if ('error' in profile) {
      return { error: profile.error };
    }
    if (!profile.encryptedVEKPassword) {
      return { error: 'Vault not initialized with VEK. Please use your primary device first.' };
    }
    const bootstrapResult = await bootstrapIdentityFromCloud(
      password,
      profile.salt,
      profile.publicKey,
      supabaseUserId,
      profile.encryptedVEKPassword,
    );
    if ('error' in bootstrapResult) {
      return { error: bootstrapResult.error };
    }

    setPasswordKey(bootstrapResult.passwordKey);
    setCachedEncryptedVEK(profile.encryptedVEKPassword);
    setIsUnlocked(true);
    return { passwordKey: bootstrapResult.passwordKey, supabaseUserId };
  }, []);

  const confirmMigration = useCallback(async () => {
    if (!pendingPassword || !pendingMigrationRecoveryKey) return;
    // Re-run unlock after migration is confirmed
    const profile = await fetchUserProfile(
      (await (await import('../../services/supabaseClient')).supabase.auth.getSession()).data.session?.user?.id ?? '',
    );
    if ('error' in profile || !profile.encryptedVEKPassword) return;

    const unlockResult = await unlockIdentity(pendingPassword, profile.encryptedVEKPassword);
    if (!unlockResult || 'error' in unlockResult) return;

    setPasswordKey(unlockResult.passwordKey);
    setCachedEncryptedVEK(unlockResult.encryptedVEKPassword);
    setPendingPassword(null);
    setIsUnlocked(true);
  }, [pendingPassword, pendingMigrationRecoveryKey]);

  const unlockWithBio = useCallback(async (): Promise<UnlockResult | { error: string }> => {
    const vek = await unlockWithBiometrics();
    if (!vek) return { error: 'Biometric unlock cancelled or failed.' };

    // Get supabase userId from session
    const { supabase } = await import('../../services/supabaseClient');
    const { data } = await supabase.auth.getSession();
    const supabaseUserId = data.session?.user?.id;
    if (!supabaseUserId) return { error: 'No Supabase session. Please sign in with password first.' };

    setIsUnlocked(true);
    // Note: PasswordKey not cached during biometric unlock (password not available)
    // For vault operations, VEK will need to be derived from DUK again
    return { passwordKey: null as unknown as SecureKey, supabaseUserId };
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
  }, []);

  return {
    isUnlocked,
    hasIdentity: hasIdentityState ?? false,
    biometricUnlockAvailable: biometricAvailable,
    unlock,
    unlockWithBio,
    confirmMigration,
    pendingMigrationRecoveryKey,
    lock,
  };
}
