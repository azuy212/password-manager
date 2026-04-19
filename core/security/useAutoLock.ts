import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { appActions } from '@/store/appStore';

const DEFAULT_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to automatically lock app after inactivity
 * Locks on both background AND foreground inactivity
 *
 * @param onLock — Optional callback called when lock triggers (e.g. navigation)
 * @param timeoutMs — Inactivity timeout in milliseconds
 */
export function useAutoLock(
  onLock?: () => void,
  timeoutMs: number = DEFAULT_LOCK_TIMEOUT,
) {
  const appStateRef = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = useRef(Date.now());

  const handleLock = useCallback(() => {
    appActions.lock();
    onLock?.();
  }, [onLock]);

  const resetInactivityTimer = useCallback(() => {
    lastActivity.current = Date.now();

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(() => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= timeoutMs) {
        handleLock();
      }
    }, timeoutMs);
  }, [timeoutMs, handleLock]);

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
          handleLock();
        }
        backgroundTime.current = null;
        // Reset inactivity timer when returning to foreground
        resetInactivityTimer();
      }

      appStateRef.current = nextAppState;
    },
    [timeoutMs, handleLock, resetInactivityTimer]
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

  return { lock: handleLock, resetInactivityTimer };
}
