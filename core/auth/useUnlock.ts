import { useState, useCallback } from 'react';
import { unlockIdentity, hasIdentity, getDecryptedPrivateKey } from './identityService';

interface UseUnlockReturn {
  isUnlocked: boolean;
  hasIdentity: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

/**
 * Hook to manage unlock state
 */
export function useUnlock(): UseUnlockReturn {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasIdentityState, setHasIdentityState] = useState(false);

  // Check if identity exists on mount
  useState(() => {
    hasIdentity().then(setHasIdentityState);
  });

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const success = await unlockIdentity(password);
    if (success) {
      setIsUnlocked(true);
    }
    return success;
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
  }, []);

  return {
    isUnlocked,
    hasIdentity: hasIdentityState,
    unlock,
    lock,
  };
}
