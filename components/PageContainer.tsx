import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const WEB_MAX_WIDTH = 480;

type PageContainerProps = {
  children: React.ReactNode;
  style?: any;
};

export function PageContainer({ children, style }: PageContainerProps) {
  const colors = useTheme();

  const isWeb = Platform.OS === 'web';

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: colors.background },
        isWeb && styles.webWrapper,
      ]}
    >
      <View
        style={[
          styles.content,
          { backgroundColor: colors.background },
          isWeb && styles.webContent,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  webWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  content: {
    flex: 1,
  },
  webContent: {
    width: '100%',
    maxWidth: WEB_MAX_WIDTH,
  },
});
