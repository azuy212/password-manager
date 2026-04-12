import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type InlineLoaderProps = {
  size?: 'small' | 'large';
  color?: string;
};

export function InlineLoader({ size = 'small', color }: InlineLoaderProps) {
  const colors = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color ?? colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
});
