import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnlock } from '../core/auth/useUnlock';
import { getIdentity, clearIdentity } from '../core/auth/identityService';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';
import { PageContainer } from '../components/PageContainer';
import { WebLayout } from '../components/WebLayout';

export default function UnlockScreen() {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { unlock } = useUnlock();
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null);
  const router = useRouter();
  const { setLoading, setError, setAuthenticated, setIdentity, setMasterKey, setUserId } = useAppStore();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    getIdentity().then(identity => {
      if (!identity) {
        router.replace('/setup');
      } else {
        setHasIdentity(true);
      }
    });
  }, []);

  if (hasIdentity === null) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!password.trim() || isSubmitting) {
      Alert.alert('Error', 'Unable to unlock vault');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);
    try {
      const masterKey = await unlock(password);
      if (masterKey) {
        const identity = await getIdentity();
        if (identity) {
          setIdentity(identity);
          setUserId(identity.id);
        }
        setMasterKey(masterKey);
        setAuthenticated(true);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Unable to unlock vault');
      }
    } catch (error: any) {
      setError(error.message);
      Alert.alert('Error', 'Unable to unlock vault');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const styles = createStyles(colors, insets);

  return (
    <WebLayout>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Lock Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={48} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.title}>Unlock Vault</Text>
        <Text style={styles.subtitle}>
          Enter your master password to continue
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.buttonText}>Unlock</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            Alert.alert(
              'Reset Vault',
              'This will permanently delete all your data. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    await clearIdentity();
                    setPassword('');
                    router.replace('/setup');
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.resetButtonText}>Forgot Password? Reset Vault</Text>
        </TouchableOpacity>
      </Animated.View>
      </KeyboardAvoidingView>
    </WebLayout>
  );
}

const createStyles = (colors: ThemeColors, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.xl,
      paddingBottom: insets.bottom,
      justifyContent: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      ...typography.h2,
      color: colors.text,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
      textAlign: 'center',
      lineHeight: 22,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: spacing.md,
      borderRadius: radius.md,
      color: colors.text,
      marginBottom: spacing.md,
      ...typography.body,
    },
    button: {
      backgroundColor: colors.primary,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
    resetButton: {
      marginTop: spacing.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    resetButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '500',
    },
  });
