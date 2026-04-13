import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearIdentity } from '@/core/auth/identityService';
import { fullSync, getLastSync } from '@/core/sync/syncService';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { WebLayout } from '@/components/WebLayout';
import { ScrollView } from 'react-native-gesture-handler';

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
    <Pressable
      style={[
        itemStyles.settingItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
        danger && { backgroundColor: colors.dangerLight, borderColor: colors.danger },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[itemStyles.iconContainer, { backgroundColor: danger ? colors.dangerLight : colors.primaryMuted }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[itemStyles.settingText, { color: colors.text }, danger && { color: colors.danger }]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { reset, masterKey, userId, isSyncing, lastSyncedAt, setSyncing, setLastSyncedAt, setVaults, setEntries, activeVault } = useAppStore();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [isResetting, setIsResetting] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    getLastSync().then(ts => {
      setLastSyncTime(ts > 0 ? ts : null);
      setLastSyncedAt(ts > 0 ? ts : null);
    });
  }, []);

  const handleSync = async () => {
    if (!masterKey || !userId) {
      Alert.alert('Error', 'Vault is not unlocked');
      return;
    }

    setSyncing(true);
    try {
      const result = await fullSync(userId, masterKey);
      // Update the Zustand store with merged vaults
      setVaults(result.mergedVaults);

      // If an active vault is set, reload its entries from AsyncStorage
      if (activeVault) {
        const { getEntriesForVault, decryptVaultKey } = await import('@/core/vault/vaultService');
        const vaultKey = await decryptVaultKey(activeVault.encryptedEncryptionKey, masterKey);
        const entries = await getEntriesForVault(activeVault.id, vaultKey);
        setEntries(entries);
        vaultKey.destroy();
      }

      // Update last sync time
      const newLastSync = Date.now();
      setLastSyncTime(newLastSync);
      setLastSyncedAt(newLastSync);

      Alert.alert('Sync Complete', `Synced ${result.syncedVaults} vault(s) and ${result.syncedEntries} entr${result.syncedEntries === 1 ? 'y' : 'ies'}.`);
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'An error occurred during sync.');
    } finally {
      setSyncing(false);
    }
  };

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.sm }}>
          <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Settings</Text>
          <SyncStatusIndicator
            isSyncing={isSyncing}
            lastSyncedAt={lastSyncTime}
            syncError={null}
            onSync={handleSync}
          />
        </View>

        {/* Security Section */}
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.section}>
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
