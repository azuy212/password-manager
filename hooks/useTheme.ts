/**
 * useTheme hook - Provides access to the current theme colors
 * Dark mode first approach
 */

import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import type { ThemeColors } from '@/constants/Colors';

export function useTheme(): ThemeColors {
  const colorScheme = useColorScheme() ?? 'dark';
  return Colors[colorScheme];
}

export function useThemeColor(
  props: { light?: string; dark?: string }
): string {
  const colorScheme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  return props[colorScheme] ?? Colors[colorScheme].text;
}
