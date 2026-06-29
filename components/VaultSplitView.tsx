import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList as RNFlatList,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import type { VaultEntry } from '@/types/vault';
import { createEntry, updateEntry, deleteEntry, decryptVaultKey } from '@/core/vault/vaultService';
import { getMasterKey } from '@/core/masterKeyStore';
import { appStore$, getSyncState } from '@/store/appStore';
import { useValue, For } from '@legendapp/state/react';
import { CopyableField } from '@/components/CopyableField';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';

const ENTRY_LIST_WIDTH = 320;

type VaultSplitViewProps = {
  vaultId: string;
  vaultName: string;
  entries: VaultEntry[];
  isLoading: boolean;
  onAddEntry: () => void;
  InlineLoader?: React.ComponentType;
};

type EntryFormData = {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
};

const EMPTY_FORM: EntryFormData = {
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
};

export function VaultSplitView({
  vaultId,
  vaultName,
  entries,
  isLoading,
  onAddEntry,
  InlineLoader,
}: VaultSplitViewProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const vaults = useValue(appStore$.vaults);

  // Sync state from Legend-State
  const syncs = getSyncState();
  const vaultsSync = useValue(syncs.vaults);
  const entriesSync = useValue(syncs.entries);

  const isSyncing = !!(vaultsSync.isGetting || entriesSync.isGetting);
  const lastSyncedAt = Math.max(vaultsSync.lastSync || 0, entriesSync.lastSync || 0);
  const syncError = vaultsSync.error ? 'Vaults sync error' : entriesSync.error ? 'Entries sync error' : null;

  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EntryFormData>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSync = useCallback(async () => {
    // Legend-State handles sync automatically, but we can trigger a refresh if needed
    syncs.vaults.sync();
    syncs.entries.sync();
  }, [syncs]);

  // Load entry data when selected
  const handleSelectEntry = useCallback((entry: VaultEntry) => {
    setSelectedEntry(entry);
    setIsEditing(false);
    setFormData({
      title: entry.title,
      username: entry.username,
      password: entry.password || '',
      url: entry.url || '',
      notes: entry.notes || '',
    });
    setShowPassword(false);
  }, []);

  const handleNewEntry = useCallback(() => {
    setIsEditing(true);
    setSelectedEntry(null);
    setFormData(EMPTY_FORM);
    setShowPassword(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.title.trim() || !formData.username.trim()) {
      Alert.alert('Error', 'Title and username are required');
      return;
    }
    const key = getMasterKey();
    if (!key) {
      Alert.alert('Error', 'Master key not available');
      return;
    }
    if (isSaving) return;

    const vault = (vaults || []).find(v => v.id === vaultId);
    if (!vault) {
      Alert.alert('Error', 'Vault not found');
      return;
    }

    setIsSaving(true);
    try {
      const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, key);
      try {
        const input = {
          vaultId,
          title: formData.title,
          username: formData.username,
          password: formData.password,
          url: formData.url || undefined,
          notes: formData.notes.trim() || undefined,
        };

        if (selectedEntry) {
          await updateEntry(selectedEntry.id, input, vaultKey);
        } else {
          await createEntry(input, vaultKey);
        }
      } finally {
        vaultKey.destroy();
      }

      setIsEditing(false);
      setFormData(EMPTY_FORM);
      setSelectedEntry(null);
      onAddEntry();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save entry';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  }, [formData, isSaving, selectedEntry, vaultId, onAddEntry]);

  const handleDelete = useCallback(() => {
    if (!selectedEntry || isDeleting) return;
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
              await deleteEntry(selectedEntry.id);
              setSelectedEntry(null);
              setIsEditing(false);
              onAddEntry();
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Failed to delete entry';
              Alert.alert('Error', message);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [selectedEntry, isDeleting, onAddEntry]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );
  const filteredEntries = searchQuery
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  return (
    <View style={styles.root}>
      {/* Entry List Pane */}
      <View style={styles.listPane}>
        <View style={styles.listHeader}>
          <SyncStatusIndicator
            isSyncing={isSyncing}
            lastSyncedAt={lastSyncedAt > 0 ? lastSyncedAt : null}
            syncError={syncError}
            onSync={handleSync}
          />
          <Pressable style={styles.addButton} onPress={handleNewEntry} accessibilityRole="button" accessibilityLabel="Add new entry">
            <Ionicons name="add" size={20} color={colors.accent} />
          </Pressable>
        </View>

        {/* Vault Name */}
        <View style={styles.vaultNameContainer}>
          <Text style={styles.vaultName} numberOfLines={1}>{vaultName}</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        {/* List */}
        {isLoading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <RNFlatList
            data={filteredEntries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isActive = selectedEntry?.id === item.id;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.listItem,
                    isActive && styles.listItemActive,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => handleSelectEntry(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`View entry ${item.title}`}
                >
                  <View style={styles.listItemIcon}>
                    <Ionicons name="key" size={18} color={isActive ? colors.accent : colors.primary} />
                  </View>
                  <View style={styles.listItemInfo}>
                    <Text style={[styles.listItemTitle, isActive && styles.listItemTitleActive]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.listItemUsername} numberOfLines={1}>{item.username}</Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.listEmpty}>
                <Ionicons name="key-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.listEmptyText}>
                  {searchQuery ? 'No matching entries' : 'No entries yet'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Detail Pane */}
      <View style={styles.detailPane}>
        {isEditing || selectedEntry ? (
          <>
            {/* Detail Header */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedEntry ? selectedEntry.title : 'New Entry'}
              </Text>
              <View style={styles.detailActions}>
                {isEditing ? (
                  <>
                    <Pressable
                      style={styles.detailActionBtn}
                      onPress={handleSave}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Save entry"
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={styles.detailActionText}>Save</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.detailActionBtn}
                      onPress={() => {
                        setIsEditing(false);
                        if (!selectedEntry) {
                          setFormData(EMPTY_FORM);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel"
                    >
                      <Text style={[styles.detailActionText, { color: colors.textTertiary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={styles.detailActionBtn}
                      onPress={() => setIsEditing(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Edit entry"
                    >
                      <Ionicons name="create-outline" size={18} color={colors.accent} />
                    </Pressable>
                    <Pressable
                      style={styles.detailActionBtn}
                      onPress={handleDelete}
                      disabled={isDeleting}
                      accessibilityRole="button"
                      accessibilityLabel="Delete entry"
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Detail Content */}
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
              {isEditing ? (
                <>
                  <DetailInput
                    label="Title"
                    value={formData.title}
                    onChangeText={(v) => setFormData((p) => ({ ...p, title: v }))}
                    placeholder="e.g., Gmail"
                    colors={colors}
                  />
                  <DetailInput
                    label="Username / Email"
                    value={formData.username}
                    onChangeText={(v) => setFormData((p) => ({ ...p, username: v }))}
                    placeholder="e.g., user@email.com"
                    colors={colors}
                  />
                  <DetailPasswordInput
                    label="Password"
                    value={formData.password}
                    onChangeText={(v) => setFormData((p) => ({ ...p, password: v }))}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword((p) => !p)}
                    colors={colors}
                  />
                  <DetailInput
                    label="Website URL (optional)"
                    value={formData.url}
                    onChangeText={(v) => setFormData((p) => ({ ...p, url: v }))}
                    placeholder="e.g., https://gmail.com"
                    colors={colors}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <DetailTextarea
                    label="Notes (optional)"
                    value={formData.notes}
                    onChangeText={(v) => setFormData((p) => ({ ...p, notes: v }))}
                    placeholder="Add any additional notes..."
                    colors={colors}
                  />
                </>
              ) : (
                <>
                  <CopyableField label="Username" value={formData.username} />
                  <CopyableField label="Password" value={formData.password} isPassword />
                  {formData.url && <CopyableField label="URL" value={formData.url} />}
                  {formData.notes && <CopyableField label="Notes" value={formData.notes} isMultiline />}
                </>
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.detailPlaceholder}>
            <Ionicons name="key-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.detailPlaceholderText}>Select an entry to view details</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Detail Sub-Components ───

function DetailInput({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof import('@/hooks/useTheme').useTheme>;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url';
}) {
  return (
    <View style={detailStyles.container}>
      <Text style={[detailStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          detailStyles.input,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        {...rest}
      />
    </View>
  );
}

function DetailPasswordInput({
  label,
  value,
  onChangeText,
  showPassword,
  onTogglePassword,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  colors: ReturnType<typeof import('@/hooks/useTheme').useTheme>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={detailStyles.container}>
      <Text style={[detailStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={detailStyles.passwordWrapper}>
        <TextInput
          style={[
            detailStyles.passwordInput,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.text,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Enter password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <View style={detailStyles.passwordActions}>
          <Pressable
            style={[
              detailStyles.passwordActionBtn,
              { backgroundColor: copied ? (colors.success + '20') : colors.primaryMuted },
            ]}
            onPress={handleCopy}
            disabled={!value}
            accessibilityRole="button"
            accessibilityLabel="Copy password"
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={16}
              color={copied ? colors.success : colors.textTertiary}
            />
          </Pressable>
          <Pressable
            style={detailStyles.passwordActionBtn}
            onPress={onTogglePassword}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={16}
              color={colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DetailTextarea({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof import('@/hooks/useTheme').useTheme>;
}) {
  return (
    <View style={detailStyles.container}>
      <Text style={[detailStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          detailStyles.textarea,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        numberOfLines={4}
      />
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.captionMedium,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  input: {
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    ...typography.body,
  },
  textarea: {
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 100,
    textAlignVertical: 'top',
    ...typography.body,
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    padding: spacing.md,
    paddingRight: 88,
    borderRadius: radius.md,
    ...typography.body,
  },
  passwordActions: {
    position: 'absolute',
    right: spacing.sm,
    top: '50%',
    marginTop: -16,
    flexDirection: 'row',
    gap: 2,
  },
  passwordActionBtn: {
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
});

function createStyles(colors: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
    },
    listPane: {
      width: ENTRY_LIST_WIDTH,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.background,
      ...Platform.select({
        web: { height: '100%' as const },
        default: {},
      }),
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    vaultNameContainer: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    vaultName: {
      ...typography.h4,
      color: colors.text,
    },
    addButton: {
      padding: spacing.xs,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.inputBackground,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      gap: spacing.xs,
    },
    searchInput: {
      flex: 1,
      paddingVertical: spacing.sm,
      color: colors.text,
      ...typography.body,
    },
    listContent: {
      padding: spacing.sm,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm + 2,
      borderRadius: radius.sm,
      marginBottom: 2,
      gap: spacing.sm,
    },
    listItemActive: {
      backgroundColor: colors.primaryMuted,
    },
    listItemIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listItemInfo: {
      flex: 1,
    },
    listItemTitle: {
      ...typography.bodyMedium,
      fontSize: 14,
      color: colors.text,
    },
    listItemTitleActive: {
      color: colors.accent,
    },
    listItemUsername: {
      ...typography.small,
      color: colors.textSecondary,
      marginTop: 1,
    },
    listEmpty: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    listEmptyText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    centerLoader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailPane: {
      flex: 1,
      backgroundColor: colors.background,
      ...Platform.select({
        web: { height: '100%' as const },
        default: {},
      }),
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailTitle: {
      ...typography.h4,
      color: colors.text,
      flex: 1,
    },
    detailActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    detailActionBtn: {
      padding: spacing.xs,
      minWidth: 36,
      minHeight: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailActionText: {
      ...typography.bodyMedium,
      color: colors.accent,
      fontSize: 14,
    },
    detailScroll: {
      flex: 1,
    },
    detailScrollContent: {
      padding: spacing.lg,
    },
    detailPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    detailPlaceholderText: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });
}
