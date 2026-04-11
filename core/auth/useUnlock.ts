import { useState, useCallback } from 'react';
import { unlockIdentity, hasIdentity } from './identityService';

interface UseUnlockReturn {
  isUnlocked: boolean;
  hasIdentity: boolean;
  unlock: (password: string) => Promise<number[] | null>;
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

  const unlock = useCallback(async (password: string): Promise<number[] | null> => {
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
    hasIdentity: hasIdentityState,
    unlock,
    lock,
  };
}
