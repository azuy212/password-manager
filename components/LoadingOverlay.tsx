import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/utils/themedStyles';

type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const colors = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          {message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 140,
    borderWidth: 1,
  },
  message: {
    ...typography.caption,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
