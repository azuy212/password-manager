import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';
import { WebLayout } from '@/components/WebLayout';
import { appStore$ } from '@/store/appStore';
import { useValue } from '@legendapp/state/react';
import { getMasterKey } from '@/core/masterKeyStore';
import { unwrapSharedEntryKey } from '@/core/sharing/sharingService';
import { decryptString } from '@/core/crypto';
import { supabase } from '@/services/supabaseClient';

/** Extended type that includes the vault_entry data fetched via join */
interface SharedEntryDisplay {
  id: string;
  entry_id: string;
  owner_id: string;
  encrypted_key: string;
  encrypted_payload?: string;
  title: string;
  username: string;
}

export default function SharedScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  
  const userId = useValue(appStore$.userId);
  const sharedEntries = useValue(appStore$.sharedEntries);

  const [displayEntries, setDisplayEntries] = useState<SharedEntryDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSharedEntries = useCallback(async () => {
    const key = getMasterKey();
    if (!userId || !sharedEntries) return;
    setIsLoading(true);
    try {
      if (sharedEntries.length > 0) {
        // Fetch the actual encrypted_payload from vault_entries
        const entryIds = sharedEntries.map(e => e.entryId);
        const { data: vaultData, error: vaultError } = await supabase
          .from('vault_entries')
          .select('id, encrypted_payload')
          .in('id', entryIds);

        if (vaultError) {
          console.error('Failed to fetch vault entries for shared items:', vaultError);
        }

        const vaultMap = new Map<string, string>();
        if (vaultData) {
          for (const row of vaultData) {
            vaultMap.set(row.id, row.encrypted_payload);
          }
        }

        // Batch-fetch owner X25519 public keys (deduplicate owner IDs)
        const ownerIds = [...new Set(sharedEntries.map(e => e.ownerId))];
        const x25519KeyMap = new Map<string, number[]>();
        if (key) {
          for (const ownerId of ownerIds) {
            const { data } = await supabase
              .from('users')
              .select('x25519_public_key')
              .eq('id', ownerId)
              .single();
            if (data?.x25519_public_key) {
              x25519KeyMap.set(ownerId, JSON.parse(data.x25519_public_key));
            }
          }
        }

        // Decrypt using ECDH unwrapping
        const decrypted: SharedEntryDisplay[] = [];
        for (const entry of sharedEntries) {
          const encryptedPayload = vaultMap.get(entry.entryId);
          let title = 'Shared Entry (encrypted)';
          let username = '';

          const ownerX25519Pub = x25519KeyMap.get(entry.ownerId);
          if (encryptedPayload && ownerX25519Pub && key) {
            try {
              const vaultDEK = await unwrapSharedEntryKey(entry.encryptedKey, ownerX25519Pub);
              if (vaultDEK) {
                const contentJson = await decryptString(encryptedPayload, vaultDEK);
                vaultDEK.destroy();
                const content = JSON.parse(contentJson);
                title = content.title || 'Shared Entry';
                username = content.username || '';
              }
            } catch {
              title = 'Shared Entry (encrypted)';
            }
          }

          decrypted.push({
            id: entry.id,
            entry_id: entry.entryId,
            owner_id: entry.ownerId,
            encrypted_key: entry.encryptedKey,
            encrypted_payload: encryptedPayload,
            title,
            username,
          });
        }
        setDisplayEntries(decrypted);
      } else {
        setDisplayEntries([]);
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to load shared entries: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId, sharedEntries]);

  useEffect(() => {
    loadSharedEntries();
  }, [loadSharedEntries]);

  const renderItem = useCallback(({ item }: { item: SharedEntryDisplay }) => (
    <Pressable
      style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => Alert.alert('Shared Entry', item.title)}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons name="share-social" size={20} color={colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
        {item.username ? (
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{item.username}</Text>
        ) : null}
      </View>
    </Pressable>
  ), [colors]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  if (isLoading) {
    return (
      <WebLayout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Shared with Me</Text>

        {displayEntries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Shared Entries</Text>
            <Text style={styles.emptySubtitle}>
              Entries shared with you will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayEntries}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </WebLayout>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Math.max(insets.top, spacing.md),
      paddingBottom: Math.max(insets.bottom, spacing.md),
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.text,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    list: {
      paddingHorizontal: spacing.md,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderWidth: 1,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
    },
    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      ...typography.body,
      fontWeight: '600',
    },
    itemSubtitle: {
      ...typography.small,
      marginTop: 2,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.text,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
