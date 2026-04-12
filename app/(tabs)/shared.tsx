import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/utils/themedStyles';
import { WebLayout } from '@/components/WebLayout';

export default function SharedScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);

  return (
    <WebLayout>
      <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
      </View>
      <Text style={styles.title}>Shared with Me</Text>
      <Text style={styles.subtitle}>
        Entries shared with you will appear here
      </Text>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonText}>Coming Soon</Text>
      </View>
      </View>
    </WebLayout>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: Math.max(insets.top, spacing.xl),
      paddingBottom: Math.max(insets.bottom, spacing.xl),
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    comingSoonBadge: {
      marginTop: spacing.xl,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.accentMuted,
      borderRadius: 20,
    },
    comingSoonText: {
      ...typography.captionMedium,
      color: colors.accent,
      fontWeight: '600',
    },
  });
