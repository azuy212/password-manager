import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions, Platform } from 'react-native';
import { getEntriesForVault } from '../core/vault/vaultService';
import { useAppStore } from '../store/useAppStore';
import type { VaultEntry } from '../types/vault';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';
import { InlineLoader } from '../components/InlineLoader';
import { WebLayout } from '../components/WebLayout';
import { VaultSplitView } from '../components/VaultSplitView';

const DESKTOP_MIN = 1024;

export default function VaultScreen() {
  const params = useLocalSearchParams<{ vaultId: string; vaultName: string }>();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { masterKey } = useAppStore();
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const loadEntries = useCallback(async () => {
    if (!params.vaultId || !masterKey) return;
    setIsLoading(true);
    try {
      const data = await getEntriesForVault(params.vaultId, masterKey);
      setEntries(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load entries');
    } finally {
      setIsLoading(false);
    }
  }, [params.vaultId, masterKey]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const handleAddEntry = () => {
    router.push({
      pathname: '/entry',
      params: { vaultId: params.vaultId },
    });
  };

  const handleEditEntry = (entry: VaultEntry) => {
    router.push({
      pathname: '/entry',
      params: { vaultId: params.vaultId, entryId: entry.id },
    });
  };

  const styles = createStyles(colors, insets);

  const renderItem = ({ item }: { item: VaultEntry }) => (
    <TouchableOpacity
      style={styles.entryItem}
      onPress={() => handleEditEntry(item)}
      activeOpacity={0.7}
    >
      <View style={styles.entryIcon}>
        <Ionicons name="key" size={20} color={colors.primary} />
      </View>
      <View style={styles.entryInfo}>
        <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.entryUsername} numberOfLines={1}>{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_MIN;

  return (
    <WebLayout>
      {isDesktop ? (
        <VaultSplitView
          vaultId={params.vaultId as string}
          vaultName={params.vaultName as string}
          entries={entries}
          isLoading={isLoading}
          onAddEntry={loadEntries}
        />
      ) : (
        <View style={styles.container}>
          {/* Vault Header */}
          <View style={styles.vaultHeader}>
            <Text style={styles.title} numberOfLines={1}>{params.vaultName}</Text>
            <Text style={styles.entryCount}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
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
          <TouchableOpacity
            style={styles.fab}
            onPress={handleAddEntry}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={28} color={colors.textInverse} />
          </TouchableOpacity>
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
