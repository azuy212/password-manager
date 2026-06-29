import 'react-native-get-random-values';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/Colors';
import { useAutoLock } from '@/core/security/useAutoLock';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

function AutoLockGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useAutoLock(() => {
    // Only navigate away if not already on the unlock screen
    if (pathname !== '/' && pathname !== '/setup') {
      router.replace('/');
    }
  });

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const themeColors = Colors[colorScheme];

  const navigationTheme = {
    dark: colorScheme === 'dark',
    colors: {
      primary: themeColors.primary,
      background: themeColors.background,
      card: themeColors.surface,
      text: themeColors.text,
      border: themeColors.border,
      notification: themeColors.accent,
    },
    fonts: DefaultTheme.fonts,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <AutoLockGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="vault" />
            <Stack.Screen name="entry" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
