import { LoadingOverlay } from '@/components/LoadingOverlay';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { WebLayout } from '@/components/WebLayout';
import { changePassword, clearIdentity, regenerateRecoveryKey } from '@/core/auth/identityService';
import { isBiometricUnlockEnabled, setupBiometricUnlock, disableBiometricUnlock, isBiometricsAvailable } from '@/core/auth/biometricService';
import { getPasswordKey, getCachedEncryptedVEK, decryptVEK } from '@/core/keyStore';
import { useTheme } from '@/hooks/useTheme';
import { appActions, getSyncState } from '@/store/appStore';
import { radius, spacing, typography } from '@/utils/themedStyles';
import { Ionicons } from '@expo/vector-icons';
import { useValue } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

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
  settingDetail: {
    fontSize: 13,
    marginRight: spacing.sm,
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

  // Recovery key state
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [recoveryKeyValue, setRecoveryKeyValue] = useState<string | null>(null);
  const [isLoadingRecoveryKey, setIsLoadingRecoveryKey] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showNewRecoveryKey, setShowNewRecoveryKey] = useState(false);
  const [newRecoveryKeyValue, setNewRecoveryKeyValue] = useState<string | null>(null);
  const [newRecoveryConfirmed, setNewRecoveryConfirmed] = useState(false);

  // Biometric state
  const [isBiometricOn, setIsBiometricOn] = useState(false);

  useEffect(() => {
    isBiometricUnlockEnabled().then(setIsBiometricOn);
  }, []);

  const handleSync = useCallback(async () => {
    await Promise.all([
      syncs.vaults.sync(),
      syncs.entries.sync(),
    ]);
  }, []);

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
    const passwordKey = getPasswordKey();
    if (!passwordKey) {
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
      const encryptedVEK = getCachedEncryptedVEK();
      if (!encryptedVEK) {
        Alert.alert('Error', 'Session expired. Please unlock again.');
        return;
      }

      const newKey = await changePassword(oldPassword, newPassword, encryptedVEK);
      if (!newKey) {
        Alert.alert('Error', 'Failed to change password. Check your old password is correct.');
        return;
      }

      passwordKey.destroy();
      appActions.setPasswordKey(newKey);

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

  // Recovery key handlers
  const handleViewRecoveryKey = useCallback(async () => {
    const encryptedVEK = getCachedEncryptedVEK();
    if (!encryptedVEK) {
      Alert.alert('Error', 'Please unlock the app first');
      return;
    }
    setIsLoadingRecoveryKey(true);
    try {
      const vek = await decryptVEK();
      if (!vek) {
        Alert.alert('Error', 'Failed to decrypt vault');
        return;
      }

      // Decrypt encryptedVEKRecovery from cloud
      const { supabase } = await import('../../services/supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user?.id) {
        Alert.alert('Error', 'Not authenticated');
        vek.destroy();
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('encrypted_vek_recovery')
        .eq('id', sessionData.session.user.id)
        .single();

      if (!userData?.encrypted_vek_recovery) {
        Alert.alert('Error', 'No recovery key set up');
        vek.destroy();
        return;
      }

      // We need to write the VEK bytes to the recovery key encrypted blob to get the key out
      // Actually, the recovery key is what we show. We don't have it - it's encrypted in the cloud
      // To get it back, we'd need to rotate it. Let's just show a different approach:
      // The recovery key is stored encrypted in the cloud. We show it only at creation/regeneration.
      Alert.alert(
        'Recovery Key',
        'For security, the Recovery Key is only shown when created or regenerated.\n\nYou can regenerate it to get a new key.',
        [{ text: 'OK' }]
      );
      vek.destroy();
    } catch {
      Alert.alert('Error', 'Failed to retrieve recovery key');
    } finally {
      setIsLoadingRecoveryKey(false);
    }
  }, []);

  const handleRegenerateRecoveryKey = useCallback(async () => {
    const encryptedVEK = getCachedEncryptedVEK();
    if (!encryptedVEK) {
      Alert.alert('Error', 'Please unlock the app first');
      return;
    }

    setIsRegenerating(true);
    try {
      const newKey = await regenerateRecoveryKey(encryptedVEK);
      if (!newKey) {
        Alert.alert('Error', 'Failed to regenerate recovery key');
        return;
      }
      setNewRecoveryKeyValue(newKey);
      setNewRecoveryConfirmed(false);
      setShowNewRecoveryKey(true);
      setShowRegenerateConfirm(false);
    } catch {
      Alert.alert('Error', 'Failed to regenerate recovery key');
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  const handleCopyNewKey = useCallback(async () => {
    if (newRecoveryKeyValue) {
      await Clipboard.setStringAsync(newRecoveryKeyValue);
      Alert.alert('Copied', 'New Recovery Key copied to clipboard');
    }
  }, [newRecoveryKeyValue]);

  const handleNewKeyConfirmed = useCallback(() => {
    setShowNewRecoveryKey(false);
    setNewRecoveryKeyValue(null);
    Alert.alert('Success', 'Recovery Key regenerated. The old key is no longer valid.');
  }, []);

  // Biometric handlers
  const handleToggleBiometric = useCallback(async () => {
    if (isBiometricOn) {
      Alert.alert(
        'Disable Biometric Unlock',
        'Face ID / Touch ID will no longer unlock your vault.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await disableBiometricUnlock();
              setIsBiometricOn(false);
            },
          },
        ]
      );
    } else {
      const available = await isBiometricsAvailable();
      if (!available) {
        Alert.alert(
          'Not Available',
          Platform.OS === 'android'
            ? 'No biometric hardware found or no fingerprints enrolled. Go to Settings > Security to enroll.'
            : 'Face ID / Touch ID is not available. Enable it in Settings first.'
        );
        return;
      }
      const encryptedVEK = getCachedEncryptedVEK();
      if (!encryptedVEK) {
        Alert.alert('Error', 'Please unlock the app first');
        return;
      }
      try {
        const vek = await decryptVEK();
        if (!vek) {
          Alert.alert('Error', 'Failed to decrypt vault');
          return;
        }
        const success = await setupBiometricUnlock(vek);
        vek.destroy();
        if (success) {
          setIsBiometricOn(true);
          Alert.alert('Success', 'Biometric unlock enabled');
        } else {
          Alert.alert('Error', 'Failed to set up biometric unlock');
        }
      } catch {
        Alert.alert('Error', 'Failed to set up biometric unlock');
      }
    }
  }, [isBiometricOn]);

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
      color: colors.text,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.sm,
    },
    sectionHeader: {
      ...typography.captionMedium,
      color: colors.textSecondary,
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
    modalButtonDanger: {
      backgroundColor: colors.danger,
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
    recoveryBox: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    recoveryText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 16,
      color: colors.text,
      letterSpacing: 1.5,
      textAlign: 'center',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  }), [colors, insets]);

  return (
    <WebLayout>
      <View style={styles.container}>
      <LoadingOverlay visible={isResetting} message="Resetting vault..." />
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <SettingItem
            icon="key"
            label="View Recovery Key"
            onPress={handleViewRecoveryKey}
            colors={colors}
          />
          <SettingItem
            icon="refresh"
            label="Regenerate Recovery Key"
            onPress={() => setShowRegenerateConfirm(true)}
            colors={colors}
          />
        </View>

        {/* Biometric Section */}
        <Text style={styles.sectionHeader}>Biometric Unlock</Text>
        <View style={styles.section}>
          <Pressable
            style={[itemStyles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleToggleBiometric}
            accessibilityRole="button"
            accessibilityLabel="Toggle biometric unlock"
          >
            <View style={[itemStyles.iconContainer, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="finger-print" size={20} color={colors.primary} />
            </View>
            <Text style={[itemStyles.settingText, { color: colors.text }]}>
              {isBiometricOn ? (Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Biometric Unlock') : 'Enable Biometric Unlock'}
            </Text>
            <Text style={[itemStyles.settingDetail, { color: isBiometricOn ? colors.accent : colors.textTertiary }]}>
              {isBiometricOn ? 'On' : 'Off'}
            </Text>
          </Pressable>
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
              Your vault data will not be affected.
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

      {/* Regenerate Recovery Key Confirm Modal */}
      <Modal visible={showRegenerateConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Regenerate Recovery Key</Text>
            <Text style={styles.modalSubtitle}>
              This will permanently invalidate your current Recovery Key.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => setShowRegenerateConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleRegenerateRecoveryKey}
                disabled={isRegenerating}
                accessibilityRole="button"
                accessibilityLabel="Confirm regenerate"
              >
                {isRegenerating ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>Regenerate</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Recovery Key Display Modal */}
      <Modal visible={showNewRecoveryKey} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440 }]}>
            <Text style={styles.modalTitle}>New Recovery Key</Text>
            <Text style={styles.modalSubtitle}>
              Save this key. It can reset your master password if forgotten.
            </Text>

            <View style={styles.recoveryBox}>
              <Text style={styles.recoveryText} selectable>{newRecoveryKeyValue}</Text>
            </View>

            <Pressable
              style={styles.copyButton}
              onPress={handleCopyNewKey}
              accessibilityRole="button"
              accessibilityLabel="Copy recovery key"
            >
              <Ionicons name="copy-outline" size={18} color={colors.textInverse} />
              <Text style={{ color: colors.textInverse, fontWeight: '600' }}>Copy</Text>
            </Pressable>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setNewRecoveryConfirmed(!newRecoveryConfirmed)}
            >
              <View style={[styles.checkbox, newRecoveryConfirmed && styles.checkboxChecked]}>
                {newRecoveryConfirmed && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
              </View>
              <Text style={{ color: colors.text, flex: 1 }}>I have saved my new Recovery Key</Text>
            </Pressable>

            <Pressable
              style={[styles.modalButtonSave, !newRecoveryConfirmed && { opacity: 0.4 }, { padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }]}
              onPress={handleNewKeyConfirmed}
              disabled={!newRecoveryConfirmed}
              accessibilityRole="button"
              accessibilityLabel="Confirm saved"
            >
              <Text style={styles.modalButtonTextSave}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </View>
    </WebLayout>
  );
}
