import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { getVaults, createVault, deleteVault } from '@/core/vault/vaultService';
import type { Vault } from '@/types/vault';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import type { ThemeColors } from '@/constants/Colors';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { InlineLoader } from '@/components/InlineLoader';
import { WebLayout } from '@/components/WebLayout';

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
  const modalScale = useState(new Animated.Value(0.9))[0];
  const modalOpacity = useState(new Animated.Value(0))[0];

  const loadVaults = useCallback(async () => {
    setIsLoadingVaults(true);
    try {
      const data = await getVaults();
      setVaults(data);
      setStoreVaults(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoadingVaults(false);
    }
  }, [setStoreVaults]);

  useFocusEffect(
    useCallback(() => {
      loadVaults();
    }, [loadVaults])
  );

  const handleCreateVault = () => {
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
  };

  const closeModal = () => {
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
  };

  const handleSaveVault = async () => {
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
          encryptedEncryptionKey: '',
        },
        masterKey
      );
      closeModal();
      loadVaults();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create vault');
      closeModal();
    } finally {
      setIsCreatingVault(false);
    }
  };

  const handleDeleteVault = (vault: Vault) => {
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
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleOpenVault = (vault: Vault) => {
    router.push({
      pathname: '/vault',
      params: { vaultId: vault.id, vaultName: vault.name },
    });
  };

  const styles = createStyles(colors, insets);

  const renderItem = ({ item }: { item: Vault }) => (
    <TouchableOpacity
      style={styles.vaultItem}
      onPress={() => handleOpenVault(item)}
      onLongPress={() => handleDeleteVault(item)}
      activeOpacity={0.7}
    >
      <View style={styles.vaultIcon}>
        <Ionicons name="folder" size={20} color={colors.primary} />
      </View>
      <View style={styles.vaultInfo}>
        <Text style={styles.vaultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.vaultDate}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
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
      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleCreateVault}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>

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
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={closeModal}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCreate]}
                onPress={handleSaveVault}
                disabled={isCreatingVault}
              >
                {isCreatingVault ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextCreate}>Create</Text>
                )}
              </TouchableOpacity>
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
    vaultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    vaultIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    vaultInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    vaultName: {
      ...typography.bodyMedium,
      color: colors.text,
    },
    vaultDate: {
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
