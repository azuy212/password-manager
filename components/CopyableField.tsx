import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/utils/themedStyles';

type CopyableFieldProps = {
  label: string;
  value: string;
  isPassword?: boolean;
  isMultiline?: boolean;
};

export function CopyableField({ label, value, isPassword, isMultiline }: CopyableFieldProps) {
  const colors = useTheme();
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayValue = isPassword && !showPassword ? '••••••••••' : value;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.headerActions}>
          {isPassword && (
            <Pressable
              style={styles.iconBtn}
              onPress={() => setShowPassword((p) => !p)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={16}
                color={colors.textTertiary}
              />
            </Pressable>
          )}
          <Pressable
            style={[styles.copyButton, copied && styles.copyButtonSuccess]}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}
          >
            {copied ? (
              <>
                <Ionicons name="checkmark" size={14} color={colors.success} />
                <Text style={styles.copiedText}>Copied</Text>
              </>
            ) : (
              <>
                <Ionicons name="copy-outline" size={14} color={colors.textTertiary} />
                <Text style={styles.copyText}>Copy</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
      <View style={[styles.valueBox, isMultiline && styles.valueBoxMultiline]}>
        <Text
          style={[styles.valueText, isPassword && styles.valueTextMonospace]}
          numberOfLines={isMultiline ? 4 : 1}
          ellipsizeMode={isMultiline ? 'tail' : 'middle'}
          selectable
        >
          {displayValue}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    iconBtn: {
      padding: spacing.xs,
      borderRadius: radius.sm,
    },
    label: {
      ...typography.captionMedium,
      color: colors.textSecondary,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryMuted,
    },
    copyButtonSuccess: {
      backgroundColor: colors.success + '20',
    },
    copyText: {
      ...typography.small,
      color: colors.textTertiary,
      fontWeight: '500',
    },
    copiedText: {
      ...typography.small,
      color: colors.success,
      fontWeight: '600',
    },
    valueBox: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    valueBoxMultiline: {
      minHeight: 80,
    },
    valueText: {
      ...typography.body,
      color: colors.text,
    },
    valueTextMonospace: {
      fontFamily: 'monospace',
      letterSpacing: 2,
    },
  });
