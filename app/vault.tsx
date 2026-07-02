import VaultEntryItem from '@/components/VaultEntryItem';
import { Ionicons } from '@expo/vector-icons';
import { useValue } from '@legendapp/state/react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InlineLoader } from '../components/InlineLoader';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { VaultSplitView } from '../components/VaultSplitView';
import { WebLayout } from '../components/WebLayout';
import type { ThemeColors } from '../constants/Colors';
import { getMasterKey } from '../core/masterKeyStore';
import { decryptVaultKey, getEntriesForVault } from '../core/vault/vaultService';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { useTheme } from '../hooks/useTheme';
import { appActions, appStore$, getSyncState } from '../store/appStore';
import type { VaultEntry } from '../types/vault';
import { spacing, typography } from '../utils/themedStyles';

export default function VaultScreen() {
  const params = useLocalSearchParams<{ vaultId: string; vaultName: string }>();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();


  // Sync state from Legend-State
  const vaults = useValue(appStore$.vaults);
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

  const wasGettingRef = useRef(entriesSync.isGetting);
  useEffect(() => {
    if (wasGettingRef.current && !entriesSync.isGetting && params.vaultId) {
      loadEntries();
    }
    wasGettingRef.current = entriesSync.isGetting;
  }, [entriesSync.isGetting, params.vaultId, loadEntries]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        syncs.vaults.sync(),
        syncs.entries.sync(),
      ]);

      await loadEntries();
    } catch (error) {
      console.error(error);
      Alert.alert("Sync Failed", "Unable to sync your vault.");
    } finally {
      setRefreshing(false);
    }
  }, [loadEntries, syncs]);

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

  const vaultName = params.vaultName ?? '';

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
                onSync={handleRefresh}
              />
            </View>
            <Text style={styles.entryCount}>
              {(entries).length} {(entries).length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={handleRefresh}
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
