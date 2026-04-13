import { useState, useCallback, useEffect } from 'react';
import {
  unlockIdentity,
  hasIdentity,
  getIdentity,
  bootstrapIdentityFromCloud,
  getStoredSupabaseUserId,
} from './identityService';
import { supabaseSignIn, fetchUserCryptoParams } from './supabaseAuthService';
import type { SecureKey } from '../crypto';

interface UseUnlockReturn {
  isUnlocked: boolean;
  hasIdentity: boolean;
  unlock: (email: string, password: string) => Promise<{ masterKey: SecureKey; supabaseUserId: string } | { error: string }>;
  lock: () => void;
}

/**
 * Hook to manage unlock state.
 *
 * Flow on device with local identity:
 *   1. Verify password against local identity
 *   2. Sign in to Supabase (or reuse persisted session)
 *
 * Flow on second device (no local identity):
 *   1. Sign in to Supabase with email/password
 *   2. Fetch salt + public_key from cloud users table
 *   3. Derive master key from password + cloud salt
 *   4. Create local identity (new Ed25519 keypair) for future offline unlocks
 */
export function useUnlock(): UseUnlockReturn {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasIdentityState, setHasIdentityState] = useState<boolean | null>(null);

  useEffect(() => {
    hasIdentity().then(setHasIdentityState);
  }, []);

  const unlock = useCallback(async (email: string, password: string): Promise<{ masterKey: SecureKey; supabaseUserId: string } | { error: string }> => {
    console.log('[useUnlock] Step 1: Signing in to Supabase...');
    // Step 1: Always sign in to Supabase first — this works on any device
    const signInResult = await supabaseSignIn(email, password);
    console.log('[useUnlock] Supabase sign-in result:', JSON.stringify({ success: signInResult.success, userId: signInResult.userId, hasError: !!signInResult.error }));
    if (!signInResult.success) {
      return { error: signInResult.error || 'Failed to sign in to cloud' };
    }
    const supabaseUserId = signInResult.userId!;

    // Step 2: Check if we have a local identity
    console.log('[useUnlock] Step 2: Checking local identity...');
    const localIdentity = await getIdentity();
    console.log('[useUnlock] Local identity exists:', !!localIdentity);
    if (localIdentity) {
      // Device already has identity — verify password locally
      console.log('[useUnlock] Verifying password locally...');
      const masterKey = await unlockIdentity(password);
      console.log('[useUnlock] Local unlock result:', masterKey === null ? 'wrong password' : 'error' in masterKey ? masterKey.error : 'success');

      // Handle corruption/error case
      if (masterKey && 'error' in masterKey) {
        return { error: masterKey.error };
      }
      if (!masterKey) {
        // Wrong password — sign out to avoid stale session
        console.log('[useUnlock] Wrong password, signing out from Supabase...');
        await (await import('../../services/supabaseClient')).supabase.auth.signOut().catch(() => {});
        return { error: 'Wrong password or account locked' };
      }
      console.log('[useUnlock] Local unlock successful');
      setIsUnlocked(true);
      return { masterKey, supabaseUserId };
    }

    // Step 3: No local identity — bootstrap from cloud (second device)
    console.log('[useUnlock] Step 3: No local identity, bootstrapping from cloud...');
    console.log('[useUnlock] Fetching crypto params for userId:', supabaseUserId);
    const cryptoParams = await fetchUserCryptoParams(supabaseUserId);
    if ('error' in cryptoParams) {
      console.error('[useUnlock] Failed to fetch crypto params:', cryptoParams.error);
      return { error: cryptoParams.error };
    }
    console.log('[useUnlock] Crypto params fetched, bootstrapping identity...');

    const bootstrapResult = await bootstrapIdentityFromCloud(
      password,
      cryptoParams.salt,
      cryptoParams.publicKey,
      supabaseUserId
    );
    if ('error' in bootstrapResult) {
      console.error('[useUnlock] Bootstrap failed:', bootstrapResult.error);
      return { error: bootstrapResult.error };
    }

    console.log('[useUnlock] Cloud bootstrap successful');
    setIsUnlocked(true);
    return { masterKey: bootstrapResult.masterKey, supabaseUserId };
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
  }, []);

  return {
    isUnlocked,
    hasIdentity: hasIdentityState ?? false,
    unlock,
    lock,
  };
}
