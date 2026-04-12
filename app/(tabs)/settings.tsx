import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearIdentity } from '@/core/auth/identityService';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { WebLayout } from '@/components/WebLayout';

// Shared styles for SettingItem (static, no dependencies on insets)
const itemStyles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
  },
});

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useTheme>;
};

function SettingItem({ icon, label, onPress, danger, colors }: SettingItemProps) {
  return (
    <TouchableOpacity
      style={[
        itemStyles.settingItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
        danger && { backgroundColor: colors.dangerLight, borderColor: colors.danger },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[itemStyles.iconContainer, { backgroundColor: danger ? colors.dangerLight : colors.primaryMuted }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[itemStyles.settingText, { color: colors.text }, danger && { color: colors.danger }]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { reset } = useAppStore();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = () => {
    Alert.alert(
      'Reset Vault',
      'This will permanently delete all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await clearIdentity();
              reset();
              router.replace('/');
            } catch {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      padding: spacing.md,
      paddingTop: Math.max(insets.top, spacing.md),
      paddingBottom: Math.max(insets.bottom + spacing.md, spacing.md),
    },
    headerTitle: {
      ...typography.h2,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.sm,
    },
    sectionHeader: {
      ...typography.captionMedium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    section: {
      borderRadius: radius.md,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
  }), [colors, insets]);

  return (
    <WebLayout>
      <View style={styles.container}>
      <LoadingOverlay visible={isResetting} message="Resetting vault..." />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Text style={styles.headerTitle}>Settings</Text>

        {/* Security Section */}
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.section}>
          <SettingItem
            icon="sync"
            label="Sync Now"
            onPress={() => {}}
            colors={colors}
          />
          <SettingItem
            icon="time"
            label="Auto-Lock Timer"
            onPress={() => {}}
            colors={colors}
          />
          <SettingItem
            icon="shield-checkmark"
            label="Security Settings"
            onPress={() => {}}
            colors={colors}
          />
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeader, { marginTop: spacing.xl }]}>Danger Zone</Text>
        <View style={styles.section}>
          <SettingItem
            icon="trash"
            label="Reset Vault"
            onPress={handleReset}
            danger
            colors={colors}
          />
        </View>
      </ScrollView>
      </View>
    </WebLayout>
  );
}
