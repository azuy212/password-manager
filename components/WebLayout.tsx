import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from '@/components/Sidebar';
import { useAppStore } from '@/store/useAppStore';

type WebLayoutProps = {
  children: React.ReactNode;
};

export function WebLayout({ children }: WebLayoutProps) {
  const breakpoint = useBreakpoint();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lock } = useAppStore();

  const isDesktop = breakpoint === 'desktop';

  const handleLock = () => {
    lock();
    router.replace('/' as any);
  };

  if (!isDesktop) {
    // Mobile/tablet: render children as-is (tabs handle navigation)
    return <>{children}</>;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Sidebar onLock={handleLock} />
      <View style={styles.main}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    ...Platform.select({
      web: {
        flexDirection: 'row',
        width: '100%',
        minHeight: '100vh',
      } as any,
      default: {
        flexDirection: 'row',
      },
    }),
  },
  main: {
    flex: 1,
    ...Platform.select({
      web: {
        minWidth: 0,
      } as any,
      default: {},
    }),
  },
});
