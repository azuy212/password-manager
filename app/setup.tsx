import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { createIdentity } from '../core/auth/identityService';
import { appActions, appStore$ } from '../store/appStore';
import { useValue } from '@legendapp/state/react';
import { useTheme } from '../hooks/useTheme';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';

export default function SetupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Use fine-grained loading state
  const isLoading = useValue(appStore$.isLoading);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleCreate = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    appActions.setLoading(true);
    try {
      const result = await createIdentity(email, password);
      if ('error' in result) {
        Alert.alert('Error', result.error);
        return;
      }
      const { identity, masterKey, supabaseUserId } = result;
      appActions.setIdentity(identity);
      appActions.setMasterKey(masterKey);
      appActions.setUserId(supabaseUserId);
      appActions.setAuthenticated(true);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create vault';
      Alert.alert('Error', message);
    } finally {
      appActions.setLoading(false);
      setIsSubmitting(false);
    }
  }, [email, password, confirmPassword, router]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  return (
    <View style={isDesktop ? styles.webRoot : styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={isDesktop ? styles.webContent : styles.container}
      >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Shield Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.title}>Set Up Your Vault</Text>
        <Text style={styles.subtitle}>
          Create a strong master password. This password cannot be recovered if forgotten.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email (for cloud sync)"
          placeholderTextColor={colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoFocus
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />

        <TouchableOpacity style={styles.button} onPress={handleCreate} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Create Vault</Text>
        </TouchableOpacity>

        {/* Security hint */}
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle" size={16} color={colors.textTertiary} />
          <Text style={styles.hintText}>
            Use a unique password you don't use elsewhere
          </Text>
        </View>
      </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    webRoot: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    webContent: {
      flex: 1,
      width: '100%',
      maxWidth: 480,
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
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.md,
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
      marginBottom: spacing.lg,
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
    hintContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    hintText: {
      ...typography.small,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });
