import { LoadingOverlay } from '@/components/LoadingOverlay';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { WebLayout } from '@/components/WebLayout';
import { changePassword, clearIdentity } from '@/core/auth/identityService';
import { getMasterKey } from '@/core/masterKeyStore';
import { reEncryptVaultKeys } from '@/core/vault/vaultService';
import { useTheme } from '@/hooks/useTheme';
import { appActions, getSyncState } from '@/store/appStore';
import { radius, spacing, typography } from '@/utils/themedStyles';
import { Ionicons } from '@expo/vector-icons';
import { useValue } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  // Sync state from Legend-State
  const syncs = getSyncState();
  const vaultsSync = useValue(syncs.vaults);
  const entriesSync = useValue(syncs.entries);

  const isSyncing = !!(vaultsSync.isGetting || entriesSync.isGetting);
  const lastSyncedAt = Math.max(vaultsSync.lastSync || 0, entriesSync.lastSync || 0);
  const syncError = vaultsSync.error ? 'Vaults sync error' : entriesSync.error ? 'Entries sync error' : null;

  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [isResetting, setIsResetting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSync = useCallback(async () => {
    syncs.vaults.sync();
    syncs.entries.sync();
  }, [syncs]);

  const handleReset = useCallback(() => {
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
              appActions.reset();
              router.replace('/');
            } catch {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  }, [router]);

  const handleChangePassword = useCallback(async () => {
    const currentKey = getMasterKey();
    if (!currentKey) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    if (!oldPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const newKey = await changePassword(oldPassword, newPassword, currentKey);
      if (!newKey) {
        Alert.alert('Error', 'Failed to change password. Check your old password is correct.');
        return;
      }

      await reEncryptVaultKeys(currentKey, newKey);
      currentKey.destroy();
      appActions.setMasterKey(newKey);

      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Master password changed successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      Alert.alert('Error', message);
    } finally {
      setIsChangingPassword(false);
    }
  }, [oldPassword, newPassword, confirmPassword]);

  const handleOpenChangePassword = useCallback(() => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowChangePassword(true);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
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
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      ...typography.h4,
      color: colors.text,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    modalSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    input: {
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
      marginTop: spacing.sm,
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
    modalButtonSave: {
      backgroundColor: colors.primary,
    },
    modalButtonTextCancel: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 16,
    },
    modalButtonTextSave: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: 16,
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
            lastSyncedAt={lastSyncedAt > 0 ? lastSyncedAt : null}
            syncError={syncError}
            onSync={handleSync}
          />
        </View>

        {/* Security Section */}
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.section}>
          <SettingItem
            icon="lock-closed"
            label="Change Master Password"
            onPress={handleOpenChangePassword}
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

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Master Password</Text>
            <Text style={styles.modalSubtitle}>
              All vault keys will be re-encrypted with your new password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="New password (min 8 chars)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              returnKeyType="done"
              onSubmitEditing={handleChangePassword}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => setShowChangePassword(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalButtonSave}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                accessibilityRole="button"
                accessibilityLabel="Change password"
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Change</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </WebLayout>
  );
}
