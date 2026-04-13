import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { getVaults, createVault, deleteVault } from '@/core/vault/vaultService';
import type { Vault } from '@/types/vault';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import type { ThemeColors } from '@/constants/Colors';
import { InlineLoader } from '@/components/InlineLoader';
import { WebLayout } from '@/components/WebLayout';

// ─── Memoized Vault Item ───

interface VaultItemProps {
  item: Vault;
  onPress: (vault: Vault) => void;
  onLongPress: (vault: Vault) => void;
  colors: ThemeColors;
}

const VaultItem = React.memo(function VaultItem({ item, onPress, onLongPress, colors }: VaultItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        vaultItemStyles.item,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open vault ${item.name}`}
      accessibilityHint="Long press to delete"
    >
      <View style={[vaultItemStyles.icon, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons name="folder" size={20} color={colors.primary} />
      </View>
      <View style={vaultItemStyles.info}>
        <Text style={[vaultItemStyles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[vaultItemStyles.date, { color: colors.textSecondary }]}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
});

const vaultItemStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    ...typography.bodyMedium,
  },
  date: {
    ...typography.small,
    marginTop: 2,
  },
});

// ─── Main Screen ───

export default function VaultsScreen() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [showNewVaultModal, setShowNewVaultModal] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [isLoadingVaults, setIsLoadingVaults] = useState(false);
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const router = useRouter();
  const { setVaults: setStoreVaults, masterKey } = useAppStore();
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  // Animated values — use useMemo to keep stable references
  const modalScale = useMemo(() => new Animated.Value(0.9), []);
  const modalOpacity = useMemo(() => new Animated.Value(0), []);

  const loadVaults = useCallback(async () => {
    setIsLoadingVaults(true);
    try {
      const data = await getVaults();
      setVaults(data);
      setStoreVaults(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load vaults';
      Alert.alert('Error', message);
    } finally {
      setIsLoadingVaults(false);
    }
  }, [setStoreVaults]);

  useFocusEffect(
    useCallback(() => {
      loadVaults();
    }, [loadVaults])
  );

  const handleCreateVault = useCallback(() => {
    setNewVaultName('');
    setShowNewVaultModal(true);
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        tension: 200,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [modalScale, modalOpacity]);

  const closeModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setShowNewVaultModal(false);
    });
  }, [modalScale, modalOpacity]);

  const handleSaveVault = useCallback(async () => {
    if (!newVaultName.trim() || !masterKey) {
      closeModal();
      return;
    }
    if (isCreatingVault) return;

    setIsCreatingVault(true);
    try {
      await createVault(
        {
          name: newVaultName.trim(),
        },
        masterKey
      );
      closeModal();
      loadVaults();
    } catch {
      Alert.alert('Error', 'Failed to create vault');
      closeModal();
    } finally {
      setIsCreatingVault(false);
    }
  }, [newVaultName, masterKey, isCreatingVault, closeModal, loadVaults]);

  const handleDeleteVault = useCallback((vault: Vault) => {
    Alert.alert(
      'Delete Vault',
      `Are you sure you want to delete "${vault.name}"? All entries will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVault(vault.id);
              loadVaults();
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Failed to delete vault';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  }, [loadVaults]);

  const handleOpenVault = useCallback((vault: Vault) => {
    router.push({
      pathname: '/vault',
      params: { vaultId: vault.id, vaultName: vault.name },
    });
  }, [router]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  const renderItem = useCallback(
    ({ item }: { item: Vault }) => (
      <VaultItem item={item} onPress={handleOpenVault} onLongPress={handleDeleteVault} colors={colors} />
    ),
    [handleOpenVault, handleDeleteVault, colors],
  );

  return (
    <WebLayout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Vaults</Text>
          <Text style={styles.headerSubtitle}>
            {vaults.length} {vaults.length === 1 ? 'vault' : 'vaults'}
          </Text>
        </View>

        <FlatList
          data={vaults}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={
            isLoadingVaults ? (
              <InlineLoader />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="folder-open-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No vaults yet</Text>
                <Text style={styles.emptySubtext}>
                  Tap + to create your first vault
                </Text>
              </View>
            )
          }
        />

        {/* FAB */}
        <Pressable
          style={styles.fab}
          onPress={handleCreateVault}
          accessibilityRole="button"
          accessibilityLabel="Create new vault"
        >
          <Ionicons name="add" size={28} color={colors.textInverse} />
        </Pressable>

        {/* New Vault Modal */}
        <Modal visible={showNewVaultModal} transparent animationType="none">
          <View style={styles.modalOverlay}>
            <Animated.View
              style={[
                styles.modalContent,
                {
                  opacity: modalOpacity,
                  transform: [{ scale: modalScale }],
                }
              ]}
            >
              <Text style={styles.modalTitle}>New Vault</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter vault name"
                placeholderTextColor={colors.placeholder}
                value={newVaultName}
                onChangeText={setNewVaultName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveVault}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeModal}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCreate]}
                  onPress={handleSaveVault}
                  disabled={isCreatingVault}
                  accessibilityRole="button"
                  accessibilityLabel="Create vault"
                >
                  {isCreatingVault ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={styles.modalButtonTextCreate}>Create</Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </View>
    </WebLayout>
  );
}

const createStyles = (colors: ThemeColors, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: Math.max(insets.top, spacing.md),
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.text,
    },
    headerSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
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
    modalTitle: {
      ...typography.h4,
      color: colors.text,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    modalInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: spacing.md,
      borderRadius: radius.md,
      color: colors.text,
      marginBottom: spacing.md,
      ...typography.body,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    modalButton: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalButtonCreate: {
      backgroundColor: colors.primary,
    },
    modalButtonTextCancel: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 16,
    },
    modalButtonTextCreate: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: 16,
    },
  });
