import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from '@/components/Sidebar';
import { appActions } from '@/store/appStore';

type WebLayoutProps = {
  children: React.ReactNode;
};

export function WebLayout({ children }: WebLayoutProps) {
  const breakpoint = useBreakpoint();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isDesktop = breakpoint === 'desktop';

  const handleLock = () => {
    appActions.lock();
    router.replace('/');
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      flexDirection: 'row',
      width: '100%',
      minHeight: '100vh',
    } : {
      flexDirection: 'row',
    }),
  } as any,
  main: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      minWidth: 0,
    } : {}),
  },
});
