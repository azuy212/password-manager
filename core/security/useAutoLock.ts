import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppStore } from '@/store/useAppStore';

const DEFAULT_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to automatically lock app after inactivity
 */
export function useAutoLock(timeoutMs: number = DEFAULT_LOCK_TIMEOUT) {
  const appStateRef = useRef(AppState.currentState);
  // @ts-ignore - Type inference issue with AppState
  const { lock: lockApp } = useAppStore();
  const backgroundTime = useRef<number | null>(null);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Record time when app goes to background
        backgroundTime.current = Date.now();
      } else if (nextAppState === 'active' && backgroundTime.current) {
        // Check if timeout has elapsed
        const elapsed = Date.now() - backgroundTime.current;
        if (elapsed > timeoutMs) {
          lockApp();
        }
        backgroundTime.current = null;
      }

      appStateRef.current = nextAppState;
    },
    [timeoutMs, lockApp]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  return { lock: lockApp };
}
