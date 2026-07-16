import VaultEntryItem from '@/components/VaultEntryItem';
import { Ionicons } from '@expo/vector-icons';
import { useValue } from '@legendapp/state/react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InlineLoader } from '../components/InlineLoader';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { VaultSplitView } from '../components/VaultSplitView';
import { WebLayout } from '../components/WebLayout';
import type { ThemeColors } from '../constants/Colors';
import { useCsvImport } from '../hooks/useCsvImport';
import { decryptVaultKey, getEntriesForVault, decryptVEKForOperation } from '../core/vault/vaultService';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { useEntrySearch } from '../hooks/useEntrySearch';
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
  const vaultsSyncError = vaultsSync.error;
  const entriesSyncError = entriesSync.error;
  const syncError = vaultsSyncError ? `${vaultsSyncError}` : entriesSyncError ? `${entriesSyncError}` : null;

  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  const loadEntries = useCallback(async () => {
    const vek = await decryptVEKForOperation();
    if (!params.vaultId || !vek || !vaults) return;
    const vault = vaults.find(v => v.id === params.vaultId);
    if (!vault) { vek.destroy(); return; }

    let vaultKey;
    try {
      vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, vek);
    } catch {
      Alert.alert('Error', 'Failed to decrypt vault key');
      vek.destroy();
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
      vek.destroy();
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

  const { isImporting, importCsvFromFile } = useCsvImport(loadEntries);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        syncs.vaults.sync(),
        syncs.entries.sync(),
      ]);

      await loadEntries();
    } catch {
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
  const { searchQuery, setSearchQuery, filteredEntries, isSearching } = useEntrySearch(entries);

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
              <View style={styles.headerActions}>
                {isImporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Pressable
                    onPress={() => importCsvFromFile(params.vaultId)}
                    style={styles.headerActionBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Import CSV"
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                  </Pressable>
                )}
                <SyncStatusIndicator
                  isSyncing={isSyncing}
                  lastSyncedAt={lastSyncedAt > 0 ? lastSyncedAt : null}
                  syncError={syncError}
                  onSync={handleRefresh}
                />
              </View>
            </View>
            <Text style={styles.entryCount}>
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
              {isSearching ? ' (filtered)' : ''}
            </Text>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search entries"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={filteredEntries}
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
                  <Text style={styles.emptyText}>
                    {isSearching ? 'No matching entries' : 'No entries yet'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {isSearching ? 'No entries match your search.' : 'Tap + to add a password'}
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerActionBtn: {
      padding: spacing.xs,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      paddingVertical: spacing.xs,
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
