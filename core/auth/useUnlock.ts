import { useState, useCallback, useEffect } from 'react';
import { unlockIdentity, hasIdentity, getIdentity } from './identityService';
import type { SecureKey } from '../crypto';

interface UseUnlockReturn {
  isUnlocked: boolean;
  hasIdentity: boolean;
  unlock: (password: string) => Promise<SecureKey | null>;
  lock: () => void;
}

/**
 * Hook to manage unlock state
 */
export function useUnlock(): UseUnlockReturn {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasIdentityState, setHasIdentityState] = useState<boolean | null>(null);

  useEffect(() => {
    hasIdentity().then(setHasIdentityState);
  }, []);

  const unlock = useCallback(async (password: string): Promise<SecureKey | null> => {
    const masterKey = await unlockIdentity(password);
    if (masterKey) {
      setIsUnlocked(true);
    }
    return masterKey;
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
