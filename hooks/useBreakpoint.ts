import { useState, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint(width));

  useEffect(() => {
    setBreakpoint(getBreakpoint(width));
  }, [width]);

  return breakpoint;
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width >= TABLET_MIN) return 'tablet';
  return 'mobile';
}

export function useIsDesktop(): boolean {
  return useBreakpoint() === 'desktop';
}

export function useIsTablet(): boolean {
  return useBreakpoint() === 'tablet';
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}
