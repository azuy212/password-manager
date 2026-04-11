import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppStore } from '@/store/useAppStore';

const DEFAULT_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to automatically lock app after inactivity
 * Locks on both background AND foreground inactivity
 */
export function useAutoLock(timeoutMs: number = DEFAULT_LOCK_TIMEOUT) {
  const appStateRef = useRef(AppState.currentState);
  // @ts-ignore - Type inference issue
  const { lock: lockApp } = useAppStore();
  const backgroundTime = useRef<number | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = useRef(Date.now());

  const resetInactivityTimer = useCallback(() => {
    lastActivity.current = Date.now();

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(() => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= timeoutMs) {
        lockApp();
      }
    }, timeoutMs);
  }, [timeoutMs, lockApp]);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTime.current = Date.now();
        // Clear inactivity timer when backgrounding
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
          inactivityTimer.current = null;
        }
      } else if (nextAppState === 'active' && backgroundTime.current) {
        const elapsed = Date.now() - backgroundTime.current;
        if (elapsed >= timeoutMs) {
          lockApp();
        }
        backgroundTime.current = null;
        // Reset inactivity timer when returning to foreground
        resetInactivityTimer();
      }

      appStateRef.current = nextAppState;
    },
    [timeoutMs, lockApp, resetInactivityTimer]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Start inactivity timer
    resetInactivityTimer();

    return () => {
      subscription.remove();
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [handleAppStateChange, resetInactivityTimer]);

  return { lock: lockApp, resetInactivityTimer };
}
