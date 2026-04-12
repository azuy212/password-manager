import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import type { VaultEntry } from '@/types/vault';
import { createEntry, updateEntry, deleteEntry } from '@/core/vault/vaultService';
import { useAppStore } from '@/store/useAppStore';
import { CopyableField } from '@/components/CopyableField';

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
}: VaultSplitViewProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { masterKey } = useAppStore();

  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EntryFormData>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load entry data when selected
  const handleSelectEntry = (entry: VaultEntry) => {
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
  };

  const handleNewEntry = () => {
    setIsEditing(true);
    setSelectedEntry(null);
    setFormData(EMPTY_FORM);
    setShowPassword(false);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.username.trim()) {
      Alert.alert('Error', 'Title and username are required');
      return;
    }
    if (!masterKey) {
      Alert.alert('Error', 'Master key not available');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
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
        await updateEntry(selectedEntry.id, input, masterKey);
      } else {
        await createEntry(input, masterKey);
      }

      setIsEditing(false);
      setFormData(EMPTY_FORM);
      setSelectedEntry(null);
      onAddEntry();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
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
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(colors, insets);
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
          <Text style={styles.listTitle} numberOfLines={1}>{vaultName}</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleNewEntry}>
            <Ionicons name="add" size={20} color={colors.accent} />
          </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* List */}
        {isLoading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={filteredEntries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isActive = selectedEntry?.id === item.id;
              return (
                <TouchableOpacity
                  style={[styles.listItem, isActive && styles.listItemActive]}
                  onPress={() => handleSelectEntry(item)}
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
                </TouchableOpacity>
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
                    <TouchableOpacity
                      style={styles.detailActionBtn}
                      onPress={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={styles.detailActionText}>Save</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailActionBtn}
                      onPress={() => {
                        setIsEditing(false);
                        if (!selectedEntry) {
                          setFormData(EMPTY_FORM);
                        }
                      }}
                    >
                      <Text style={[styles.detailActionText, { color: colors.textTertiary }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.detailActionBtn}
                      onPress={() => setIsEditing(true)}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailActionBtn}
                      onPress={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      )}
                    </TouchableOpacity>
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
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs }}>
        {label}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          padding: spacing.md,
          borderRadius: radius.md,
          color: colors.text,
          ...typography.body,
        }}
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
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs }}>
        {label}
      </Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={{
            backgroundColor: colors.inputBackground,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            padding: spacing.md,
            paddingRight: 88,
            borderRadius: radius.md,
            color: colors.text,
            ...typography.body,
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder="Enter password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <View style={{ position: 'absolute', right: spacing.sm, top: '50%', marginTop: -16, flexDirection: 'row', gap: 2 }}>
          <TouchableOpacity
            style={{
              padding: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: copied ? (colors.success + '20') : colors.primaryMuted,
            }}
            onPress={handleCopy}
            disabled={!value}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={16}
              color={copied ? colors.success : colors.textTertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              padding: spacing.xs,
              borderRadius: radius.sm,
            }}
            onPress={onTogglePassword}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={16}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
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
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs }}>
        {label}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          padding: spacing.md,
          borderRadius: radius.md,
          color: colors.text,
          ...typography.body,
          minHeight: 100,
          textAlignVertical: 'top',
        }}
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
        web: { height: '100%' } as any,
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
    listTitle: {
      ...typography.h4,
      color: colors.text,
      flex: 1,
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
        web: { height: '100%' } as any,
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
