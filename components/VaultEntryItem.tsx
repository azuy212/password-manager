import { ThemeColors } from "@/constants/Colors";
import { radius, spacing, typography } from "@/utils/themedStyles";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VaultEntry } from '../types/vault';

interface VaultEntryItemProps {
  item: VaultEntry;
  onPress: (entry: VaultEntry) => void;
  colors: ThemeColors;
}

const VaultEntryItem: React.FC<VaultEntryItemProps> = React.memo(function VaultEntryItem({ item, onPress, colors }) {
  const styles = useMemo(() => vaultEntryItemBase(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.entryItem,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`View entry for ${item.title}`}
    >
      <View style={[styles.entryIcon, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons name="key" size={20} color={colors.primary} />
      </View>
      <View style={styles.entryInfo}>
        <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.entryUsername, { color: colors.textSecondary }]} numberOfLines={1}>{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
});

export default VaultEntryItem;

const vaultEntryItemBase = (colors: ThemeColors) => StyleSheet.create({
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  entryTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  entryUsername: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
});