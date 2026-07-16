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
  ScrollView,
} from 'react-native';
import { createIdentity } from '../core/auth/identityService';
import { setCachedEncryptedVEK } from '../core/keyStore';
import { appActions, appStore$ } from '../store/appStore';
import { useValue } from '@legendapp/state/react';
import { useTheme } from '../hooks/useTheme';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { spacing, radius, typography } from '../utils/themedStyles';
import * as Clipboard from 'expo-clipboard';
import type { ThemeColors } from '../constants/Colors';

export default function SetupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [pendingIdentity, setPendingIdentity] = useState<{ identity: any; passwordKey: any; supabaseUserId: string; encryptedVEKPassword: string } | null>(null);
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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
      const { identity, passwordKey, supabaseUserId, recoveryKey, encryptedVEKPassword } = result;

      // Show recovery key before proceeding
      setRecoveryKey(recoveryKey);
      setPendingIdentity({ identity, passwordKey, supabaseUserId, encryptedVEKPassword });
      setShowRecoveryKey(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create vault';
      Alert.alert('Error', message);
    } finally {
      appActions.setLoading(false);
      setIsSubmitting(false);
    }
  }, [email, password, confirmPassword, router]);

  const handleRecoveryConfirmed = useCallback(async () => {
    if (!pendingIdentity) return;
    const { identity, passwordKey, supabaseUserId, encryptedVEKPassword } = pendingIdentity;

    appActions.setIdentity(identity);
    appActions.setPasswordKey(passwordKey);
    setCachedEncryptedVEK(encryptedVEKPassword);
    appActions.setUserId(supabaseUserId);
    appActions.setAuthenticated(true);

    // Clear recovery key from state
    setRecoveryKey(null);
    setPendingIdentity(null);

    router.replace('/(tabs)');
  }, [pendingIdentity, router]);

  const handleCopyKey = useCallback(async () => {
    if (recoveryKey) {
      await Clipboard.setStringAsync(recoveryKey);
      Alert.alert('Copied', 'Recovery Key copied to clipboard');
    }
  }, [recoveryKey]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  if (showRecoveryKey && recoveryKey) {
    return (
      <View style={isDesktop ? styles.webRoot : styles.container}>
        <ScrollView contentContainerStyle={styles.recoveryContainer}>
          <View style={styles.recoveryIconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={48} color={colors.accent} />
            </View>
          </View>

          <Text style={styles.recoveryTitle}>Your Recovery Key</Text>
          <Text style={styles.recoveryWarning}>
            This is the only time you will see this key. If you lose it, your vault cannot be recovered.
          </Text>

          <View style={styles.recoveryKeyBox}>
            <Text style={styles.recoveryKeyText} selectable>{recoveryKey}</Text>
          </View>

          <TouchableOpacity style={styles.copyButton} onPress={handleCopyKey} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={18} color={colors.textInverse} />
            <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.confirmCheckbox}
            onPress={() => setRecoveryConfirmed(!recoveryConfirmed)}
          >
            <View style={[styles.checkbox, recoveryConfirmed && styles.checkboxChecked]}>
              {recoveryConfirmed && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
            </View>
            <Text style={styles.confirmText}>I have saved my Recovery Key</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueButton, !recoveryConfirmed && styles.continueButtonDisabled]}
            onPress={handleRecoveryConfirmed}
            disabled={!recoveryConfirmed}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue to Vault</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={isDesktop ? styles.webRoot : styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={isDesktop ? styles.webContent : styles.container}
      >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
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
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => setTimeout(() => passwordRef.current?.focus(), 50)}
        />

        <TextInput
          style={styles.input}
          placeholder="Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="off"
          importantForAutofill="no"
          value={password}
          onChangeText={setPassword}
          ref={passwordRef}
          autoFocus
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          textContentType="none"
          autoComplete="off"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          ref={confirmPasswordRef}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />

        <TouchableOpacity style={styles.button} onPress={handleCreate} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Create Vault</Text>
        </TouchableOpacity>

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
    recoveryContainer: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.xl,
      paddingBottom: insets.bottom + spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    recoveryIconContainer: {
      alignItems: 'center',
      marginBottom: spacing.lg,
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
    recoveryTitle: {
      ...typography.h2,
      color: colors.text,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    recoveryWarning: {
      ...typography.caption,
      color: colors.danger,
      marginBottom: spacing.xl,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.md,
      fontWeight: '500',
    },
    recoveryKeyBox: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
      width: '100%',
    },
    recoveryKeyText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 18,
      color: colors.text,
      letterSpacing: 2,
      textAlign: 'center',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      marginBottom: spacing.xl,
      gap: spacing.xs,
    },
    copyButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '600',
    },
    confirmCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
      gap: spacing.md,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    confirmText: {
      ...typography.body,
      color: colors.text,
      flex: 1,
    },
    continueButton: {
      backgroundColor: colors.primary,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      width: '100%',
    },
    continueButtonDisabled: {
      opacity: 0.4,
    },
    continueButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
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
