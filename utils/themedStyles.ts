/**
 * Themed Styles - Centralized style factories for consistent theming
 * All components should import from here instead of creating inline styles
 */

import { StyleSheet, Platform } from 'react-native';
import Colors from '@/constants/Colors';
import type { ThemeColors } from '@/constants/Colors';

// Spacing scale (8pt grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border radius
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// Typography scale
export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 24, fontWeight: '600' as const },
  h4: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
  captionMedium: { fontSize: 14, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  smallMedium: { fontSize: 12, fontWeight: '500' as const },
};

// Shadow presets
export const shadows = (colors: ThemeColors) => ({
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fab: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});

// Common style factories
export const createThemedStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Screen containers
    screenContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flex: 1,
      padding: spacing.lg,
    },
    centeredContent: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: 'center',
    },

    // Typography
    title: {
      ...typography.h2,
      color: colors.text,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    caption: {
      ...typography.caption,
      color: colors.textTertiary,
    },

    // Cards/Surfaces
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardSecondary: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },

    // Inputs
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      ...typography.body,
    },
    inputFocused: {
      borderColor: colors.primary,
    },

    // Buttons
    buttonPrimary: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600' as const,
    },
    buttonDanger: {
      backgroundColor: colors.dangerLight,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    buttonTextDanger: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: '600' as const,
    },

    // FAB
    fab: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
      width: 56,
      height: 56,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows(colors).fab,
    },

    // Empty states
    emptyState: {
      alignItems: 'center',
      marginTop: spacing.xxxl + spacing.xl,
    },
    emptyStateText: {
      ...typography.h4,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    emptyStateSubtext: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.xs,
    },

    // Dividers
    divider: {
      height: 1,
      backgroundColor: colors.divider,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      width: '85%',
      maxWidth: 360,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });

// Platform-specific adjustments
export const platformAdjustments = {
  cardPadding: Platform.OS === 'ios' ? spacing.md : spacing.sm + spacing.xs,
  inputPadding: Platform.OS === 'ios' ? spacing.md : spacing.sm + 2,
  headerPaddingTop: Platform.OS === 'ios' ? spacing.lg : spacing.md,
};
