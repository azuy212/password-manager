import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/utils/themedStyles';

type SyncStatusIndicatorProps = {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;
  onSync: () => void;
};

function formatLastSynced(timestamp: number | null): string {
  if (!timestamp) return 'Never synced';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function SyncStatusIndicator({
  isSyncing,
  lastSyncedAt,
  syncError,
  onSync,
}: SyncStatusIndicatorProps) {
  const colors = useTheme();
  
  const containerStyle = [
    styles.container,
    { backgroundColor: colors.surface },
    syncError && { backgroundColor: colors.dangerLight },
  ];
  
  return (
    <Pressable
      style={containerStyle}
      onPress={onSync}
      disabled={isSyncing}
      accessibilityRole="button"
      accessibilityLabel="Sync with cloud"
      accessibilityHint={isSyncing ? 'Sync in progress' : 'Tap to sync now'}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : syncError ? (
        <Ionicons name="warning" size={16} color={colors.danger} />
      ) : (
        <Ionicons name="cloud-done" size={16} color={colors.textSecondary} />
      )}
      
      <Text
        style={[
          styles.text,
          { color: syncError ? colors.danger : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {isSyncing ? 'Syncing...' : syncError ? 'Sync error' : formatLastSynced(lastSyncedAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
  },
  text: {
    ...typography.captionMedium,
    fontSize: 12,
  },
});
