import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ThemeColors } from '../constants/Colors';
import { createEntry, deleteEntry, getEntry, updateEntry, decryptVaultKey } from '../core/vault/vaultService';
import { getMasterKey } from '../core/masterKeyStore';
import { shareEntryWithECDH } from '../core/sharing/sharingService';
import { appStore$ } from '../store/appStore';
import { useValue } from '@legendapp/state/react';
import { useTheme } from '../hooks/useTheme';
import type { VaultEntryInput } from '../types/vault';
import { radius, spacing, typography } from '../utils/themedStyles';

export default function EntryScreen() {
  const params = useLocalSearchParams<{ vaultId: string; entryId?: string }>();
  const router = useRouter();
  
  const vaults = useValue(appStore$.vaults);

  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingEntry, setIsLoadingEntry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleCopyField = useCallback(async (value: string, field: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  useEffect(() => {
    if (params.entryId) {
      loadEntry();
    }
  }, [params.entryId]);

  const loadEntry = useCallback(async () => {
    const key = getMasterKey();
    if (!params.entryId || !key) return;
    setIsLoadingEntry(true);
    try {
      const vault = (vaults || []).find(v => v.id === params.vaultId);
      if (!vault) { setIsLoadingEntry(false); return; }

      const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, key);
      try {
        const entry = await getEntry(params.entryId as string, vaultKey);
        if (entry) {
          setTitle(entry.title);
          setUsername(entry.username);
          setPassword(entry.password || '');
          setNotes(entry.notes || '');
          setUrl(entry.url || '');
        }
      } finally {
        vaultKey.destroy();
      }
    } catch {
      Alert.alert('Error', 'Failed to load entry');
    } finally {
      setIsLoadingEntry(false);
    }
  }, [params.entryId, params.vaultId, vaults]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !username.trim()) {
      Alert.alert('Error', 'Title and username are required');
      return;
    }

    const key = getMasterKey();
    if (!key) {
      Alert.alert('Error', 'Master key not available');
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    try {
      const vault = (vaults || []).find(v => v.id === params.vaultId);
      if (!vault) {
        Alert.alert('Error', 'Vault not found');
        return;
      }

      const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, key);
      try {
        const input: VaultEntryInput = {
          vaultId: params.vaultId as string,
          title,
          username,
          password,
          url: url || undefined,
          notes: notes.trim() || undefined,
        };

        if (params.entryId) {
          await updateEntry(params.entryId, input, vaultKey);
        } else {
          await createEntry(input, vaultKey);
        }
      } finally {
        vaultKey.destroy();
      }

      router.back();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save entry';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  }, [title, username, isSaving, params.vaultId, params.entryId, url, notes, password, router]);

  const handleDelete = useCallback(async () => {
    if (!params.entryId || isDeleting) return;

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteEntry(params.entryId as string);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete entry');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [params.entryId, isDeleting, router]);

  const handleShare = useCallback(async () => {
    if (!params.entryId || !shareEmail.trim()) return;

    const key = getMasterKey();
    if (!key) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    setIsSharing(true);
    try {
      const vault = (vaults || []).find(v => v.id === params.vaultId);
      if (!vault) throw new Error('Vault not found');

      const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, key);
      try {
        const result = await shareEntryWithECDH(
          params.entryId,
          vault.userId,
          shareEmail.trim(),
          vaultKey,
        );

        if (result.success) {
          setShowShareModal(false);
          setShareEmail('');
          Alert.alert('Shared', 'Entry shared successfully');
        } else {
          Alert.alert('Error', result.error || 'Failed to share entry');
        }
      } finally {
        vaultKey.destroy();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to share entry';
      Alert.alert('Error', message);
    } finally {
      setIsSharing(false);
    }
  }, [params.entryId, params.vaultId, shareEmail, vaults]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={28} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {params.entryId ? 'Edit Entry' : 'New Entry'}
        </Text>
        <View style={styles.headerActions}>
          {params.entryId && (
            <Pressable
              onPress={() => { setShowShareModal(true); setShareEmail(''); }}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Share entry"
            >
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </Pressable>
          )}
          <Pressable
            onPress={handleSave}
            style={styles.headerButton}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save entry"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveButton}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {isLoadingEntry && (
          <View style={styles.inlineLoadingBar}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.inlineLoadingText, { color: colors.textSecondary }]}>
              Loading entry...
            </Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.inputWithIconField, isLoadingEntry && styles.inputDisabled]}
              placeholder="e.g., Gmail"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={colors.placeholder}
              editable={!isLoadingEntry}
            />
            <Pressable
              style={[styles.inputActionBtn, copiedField === 'title' && styles.inputActionBtnSuccess]}
              onPress={() => handleCopyField(title, 'title')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isLoadingEntry || !title}
              accessibilityRole="button"
              accessibilityLabel="Copy title"
            >
              <Ionicons
                name={copiedField === 'title' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copiedField === 'title' ? colors.success : colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Username / Email</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.inputWithIconField, isLoadingEntry && styles.inputDisabled]}
              placeholder="e.g., user@email.com"
              value={username}
              onChangeText={setUsername}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              editable={!isLoadingEntry}
            />
            <Pressable
              style={[styles.inputActionBtn, copiedField === 'username' && styles.inputActionBtnSuccess]}
              onPress={() => handleCopyField(username, 'username')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isLoadingEntry || !username}
              accessibilityRole="button"
              accessibilityLabel="Copy username"
            >
              <Ionicons
                name={copiedField === 'username' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copiedField === 'username' ? colors.success : colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, isLoadingEntry && styles.inputDisabled]}
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor={colors.placeholder}
              textContentType="password"
              autoCapitalize="none"
              editable={!isLoadingEntry}
            />
            <View style={styles.passwordActions}>
              <Pressable
                style={styles.passwordActionBtn}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={isLoadingEntry}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={colors.textTertiary}
                />
              </Pressable>
              <Pressable
                style={[
                  styles.passwordActionBtn,
                  copiedField === 'password' && styles.passwordActionBtnSuccess,
                ]}
                onPress={() => handleCopyField(password, 'password')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={isLoadingEntry || !password}
                accessibilityRole="button"
                accessibilityLabel="Copy password"
              >
                <Ionicons
                  name={copiedField === 'password' ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color={copiedField === 'password' ? colors.success : colors.textTertiary}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Website URL (optional)</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.inputWithIconField, isLoadingEntry && styles.inputDisabled]}
              placeholder="e.g., https://gmail.com"
              value={url}
              onChangeText={setUrl}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              keyboardType="url"
              editable={!isLoadingEntry}
            />
            <Pressable
              style={[styles.inputActionBtn, copiedField === 'url' && styles.inputActionBtnSuccess]}
              onPress={() => handleCopyField(url, 'url')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isLoadingEntry || !url}
              accessibilityRole="button"
              accessibilityLabel="Copy URL"
            >
              <Ionicons
                name={copiedField === 'url' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copiedField === 'url' ? colors.success : colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes (optional)</Text>
          <View style={styles.inputWithIconMultiline}>
            <TextInput
              style={[styles.inputWithIconField, styles.notesInput, isLoadingEntry && styles.inputDisabled]}
              placeholder="Add any additional notes..."
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isLoadingEntry}
            />
            <Pressable
              style={[styles.inputActionBtnMultiline, copiedField === 'notes' && styles.inputActionBtnSuccess]}
              onPress={() => handleCopyField(notes, 'notes')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isLoadingEntry || !notes}
              accessibilityRole="button"
              accessibilityLabel="Copy notes"
            >
              <Ionicons
                name={copiedField === 'notes' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copiedField === 'notes' ? colors.success : colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        {params.entryId && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Delete entry"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={styles.deleteButtonText}>Delete Entry</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>

      {/* Share Modal */}
      <Modal visible={showShareModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Entry</Text>
            <Text style={styles.modalSubtitle}>
              Enter the email of the user to share this entry with
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Recipient email"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={shareEmail}
              onChangeText={setShareEmail}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleShare}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => setShowShareModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalButtonShare}
                onPress={handleShare}
                disabled={isSharing || !shareEmail.trim()}
                accessibilityRole="button"
                accessibilityLabel="Share entry"
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextShare}>Share</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: insets.top + spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerButton: {
      padding: spacing.xs,
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerTitle: {
      ...typography.h4,
      color: colors.text,
    },
    saveButton: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: Math.max(insets.bottom + spacing.md, spacing.md),
    },
    inlineLoadingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    inlineLoadingText: {
      ...typography.caption,
    },
    formGroup: {
      marginBottom: spacing.md,
    },
    label: {
      ...typography.captionMedium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: spacing.md,
      borderRadius: radius.md,
      color: colors.text,
      ...typography.body,
    },
    inputDisabled: {
      opacity: 0.5,
    },
    inputWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: radius.md,
    },
    inputWithIconField: {
      flex: 1,
      padding: spacing.md,
      paddingRight: 4,
      color: colors.text,
      ...typography.body,
    },
    inputActionBtn: {
      padding: spacing.sm,
      borderRadius: radius.sm,
    },
    inputActionBtnMultiline: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      padding: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.inputBackground,
    },
    inputActionBtnSuccess: {
      backgroundColor: colors.success + '20',
    },
    inputWithIconMultiline: {
      position: 'relative',
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: spacing.md,
      paddingRight: 80,
      borderRadius: radius.md,
      color: colors.text,
      ...typography.body,
    },
    passwordActions: {
      position: 'absolute',
      right: spacing.xs,
      top: '50%',
      marginTop: -16,
      flexDirection: 'row',
      gap: 2,
    },
    passwordActionBtn: {
      padding: spacing.xs,
      borderRadius: radius.sm,
    },
    passwordActionBtnSuccess: {
      backgroundColor: colors.success + '20',
    },
    notesInput: {
      minHeight: 100,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
      backgroundColor: colors.dangerLight,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: spacing.sm,
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
    modalButtonCancel: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalButtonShare: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    modalButtonTextCancel: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 16,
    },
    modalButtonTextShare: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: 16,
    },
  });
