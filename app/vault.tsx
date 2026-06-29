import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEntriesForVault, decryptVaultKey } from '../core/vault/vaultService';
import { getMasterKey } from '../core/masterKeyStore';
import { appStore$, appActions, getSyncState } from '../store/appStore';
import { useValue } from '@legendapp/state/react';
import type { VaultEntry } from '../types/vault';
import { useTheme } from '../hooks/useTheme';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';
import { InlineLoader } from '../components/InlineLoader';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { WebLayout } from '../components/WebLayout';
import { VaultSplitView } from '../components/VaultSplitView';

// ─── Static base styles for VaultEntryItem ───

const vaultEntryItemBase = StyleSheet.create({
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  entryTitle: {
    ...typography.bodyMedium,
  },
  entryUsername: {
    ...typography.small,
    marginTop: 2,
  },
});

interface VaultEntryItemProps {
  item: VaultEntry;
  onPress: (entry: VaultEntry) => void;
  colors: ThemeColors;
}

const VaultEntryItem = React.memo(function VaultEntryItem({ item, onPress, colors }: VaultEntryItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        vaultEntryItemBase.entryItem,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`View entry for ${item.title}`}
    >
      <View style={[vaultEntryItemBase.entryIcon, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons name="key" size={20} color={colors.primary} />
      </View>
      <View style={vaultEntryItemBase.entryInfo}>
        <Text style={[vaultEntryItemBase.entryTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[vaultEntryItemBase.entryUsername, { color: colors.textSecondary }]} numberOfLines={1}>{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
});

export default function VaultScreen() {
  const params = useLocalSearchParams<{ vaultId: string; vaultName: string }>();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const userId = useValue(appStore$.userId);
  const vaults = useValue(appStore$.vaults);

  // Sync state from Legend-State
  const syncs = getSyncState();
  const vaultsSync = useValue(syncs.vaults);
  const entriesSync = useValue(syncs.entries);

  const isSyncing = !!(vaultsSync.isGetting || entriesSync.isGetting);
  const lastSyncedAt = Math.max(vaultsSync.lastSync || 0, entriesSync.lastSync || 0);
  const syncError = vaultsSync.error ? 'Vaults sync error' : entriesSync.error ? 'Entries sync error' : null;

  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  const loadEntries = useCallback(async () => {
    const currentMasterKey = getMasterKey();
    if (!params.vaultId || !currentMasterKey || !vaults) return;
    const vault = vaults.find(v => v.id === params.vaultId);
    if (!vault) return;

    let vaultKey;
    try {
      vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, currentMasterKey);
    } catch {
      Alert.alert('Error', 'Failed to decrypt vault key');
      return;
    }

    setIsLoading(true);
    try {
      const data = await getEntriesForVault(params.vaultId as string, vaultKey);
      setEntries(data);
    } catch {
      Alert.alert('Error', 'Failed to load entries');
    } finally {
      setIsLoading(false);
      vaultKey.destroy();
    }
  }, [params.vaultId, vaults]);

  useFocusEffect(
    useCallback(() => {
      if (params.vaultId) {
        appActions.setActiveVault(params.vaultId);
      }
      loadEntries();
    }, [params.vaultId, loadEntries])
  );

  const handleAddEntry = useCallback(() => {
    router.push({
      pathname: '/entry',
      params: { vaultId: params.vaultId },
    });
  }, [router, params.vaultId]);

  const handleEditEntry = useCallback((entry: VaultEntry) => {
    router.push({
      pathname: '/entry',
      params: { vaultId: params.vaultId, entryId: entry.id },
    });
  }, [router, params.vaultId]);

  const handleSync = useCallback(async () => {
    // Legend-State handles sync automatically, but we can trigger a refresh if needed
    syncs.vaults.sync();
    syncs.entries.sync();
  }, [syncs]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  const renderItem = useCallback(
    ({ item }: { item: VaultEntry }) => (
      <VaultEntryItem item={item} onPress={handleEditEntry} colors={colors} />
    ),
    [handleEditEntry, colors],
  );

  const vaultName = (params.vaultName as string) ?? '';

  return (
    <WebLayout>
      {isDesktop ? (
        <VaultSplitView
          vaultId={params.vaultId as string}
          vaultName={vaultName}
          entries={entries}
          isLoading={isLoading}
          onAddEntry={loadEntries}
        />
      ) : (
        <View style={styles.container}>
          {/* Vault Header */}
          <View style={styles.vaultHeader}>
            <View style={styles.headerTop}>
              <Text style={styles.title} numberOfLines={1}>{vaultName}</Text>
              <SyncStatusIndicator
                isSyncing={isSyncing}
                lastSyncedAt={lastSyncedAt > 0 ? lastSyncedAt : null}
                syncError={syncError}
                onSync={handleSync}
              />
            </View>
            <Text style={styles.entryCount}>
              {(entries || []).length} {(entries || []).length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          <FlatList
            data={entries || []}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={5}
            ListEmptyComponent={
              isLoading ? (
                <InlineLoader />
              ) : (
                <View style={styles.empty}>
                  <Ionicons name="key-outline" size={64} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>No entries yet</Text>
                  <Text style={styles.emptySubtext}>
                    Tap + to add a password
                  </Text>
                </View>
              )
            }
          />

          {/* FAB */}
          <Pressable
            style={styles.fab}
            onPress={handleAddEntry}
            accessibilityRole="button"
            accessibilityLabel="Add new entry"
          >
            <Ionicons name="add" size={28} color={colors.textInverse} />
          </Pressable>
        </View>
      )}
    </WebLayout>
  );
}

const createStyles = (colors: ThemeColors, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    vaultHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    entryCount: {
      ...typography.small,
      color: colors.textSecondary,
    },
    list: {
      padding: spacing.md,
    },
    entryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    entryIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    entryInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    entryTitle: {
      ...typography.bodyMedium,
      color: colors.text,
    },
    entryUsername: {
      ...typography.small,
      color: colors.textSecondary,
      marginTop: 2,
    },
    empty: {
      alignItems: 'center',
      marginTop: spacing.xxxl + spacing.xl,
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      ...typography.h4,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    emptySubtext: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    fab: {
      position: 'absolute',
      right: spacing.md,
      bottom: Math.max(insets.bottom + spacing.sm, spacing.md),
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  });
