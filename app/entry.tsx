import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { createEntry, updateEntry, getEntry, deleteEntry } from '../core/vault/vaultService';
import type { VaultEntryInput } from '../types/vault';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';
import { PageContainer } from '../components/PageContainer';
import { WebLayout } from '../components/WebLayout';

export default function EntryScreen() {
  const params = useLocalSearchParams<{ vaultId: string; entryId?: string }>();
  const router = useRouter();
  const { masterKey } = useAppStore();
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

  useEffect(() => {
    if (params.entryId) {
      loadEntry();
    }
  }, [params.entryId]);

  const loadEntry = async () => {
    if (!params.entryId || !masterKey) return;
    setIsLoadingEntry(true);
    try {
      const entry = await getEntry(params.entryId, masterKey);
      if (entry) {
        setTitle(entry.title);
        setUsername(entry.username);
        setPassword(entry.password || '');
        setNotes(entry.notes || '');
        setUrl(entry.url || '');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load entry');
    } finally {
      setIsLoadingEntry(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !username.trim()) {
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
      const input: VaultEntryInput = {
        vaultId: params.vaultId as string,
        title,
        username,
        password,
        url: url || undefined,
        notes: notes.trim() || undefined,
      };

      if (params.entryId) {
        await updateEntry(params.entryId, input, masterKey);
      } else {
        await createEntry(input, masterKey);
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
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

  return (
    <WebLayout>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {params.entryId ? 'Edit Entry' : 'New Entry'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
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
          <TextInput
            style={[styles.input, isLoadingEntry && styles.inputDisabled]}
            placeholder="e.g., Gmail"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={colors.placeholder}
            editable={!isLoadingEntry}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Username / Email</Text>
          <TextInput
            style={[styles.input, isLoadingEntry && styles.inputDisabled]}
            placeholder="e.g., user@email.com"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            editable={!isLoadingEntry}
          />
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
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isLoadingEntry}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Website URL (optional)</Text>
          <TextInput
            style={[styles.input, isLoadingEntry && styles.inputDisabled]}
            placeholder="e.g., https://gmail.com"
            value={url}
            onChangeText={setUrl}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            keyboardType="url"
            editable={!isLoadingEntry}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput, isLoadingEntry && styles.inputDisabled]}
            placeholder="Add any additional notes..."
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isLoadingEntry}
          />
        </View>

        {params.entryId && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={styles.deleteButtonText}>Delete Entry</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
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
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: spacing.md,
      paddingRight: spacing.xl + spacing.md,
      borderRadius: radius.md,
      color: colors.text,
      ...typography.body,
    },
    eyeButton: {
      position: 'absolute',
      right: spacing.md,
      top: '50%',
      marginTop: -11,
      padding: spacing.xs,
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
  });
