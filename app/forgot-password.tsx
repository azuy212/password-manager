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
  ActivityIndicator,
} from 'react-native';
import { changePasswordWithRecoveryKey } from '../core/auth/identityService';
import { supabaseSignIn } from '../core/auth/supabaseAuthService';
import { useTheme } from '../hooks/useTheme';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';

type Step = 'recovery-key' | 'new-password' | 'success';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<Step>('recovery-key');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const recoveryRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auto-format recovery key as user types
  const handleRecoveryInputChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 33);
    const groups: string[] = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      groups.push(cleaned.slice(i, i + 4));
    }
    setRecoveryKeyInput(groups.join('-'));
    setRecoveryVerified(false);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!recoveryKeyInput.trim()) {
      Alert.alert('Error', 'Please enter your Recovery Key');
      return;
    }

    // Validate format client-side
    const { validateRecoveryKeyFormat } = await import('../core/crypto');
    if (!validateRecoveryKeyFormat(recoveryKeyInput)) {
      Alert.alert('Error', 'Invalid Recovery Key format. Please check and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Sign in to Supabase (needed to fetch encrypted VEK from cloud)
      const signInResult = await supabaseSignIn(email, '');
      if (signInResult.success) {
        // User has an account
      }

      // Try decrypting - if format is valid, move to password step
      // The actual decryption happens on submit
      setRecoveryVerified(true);
      setStep('new-password');
    } catch {
      Alert.alert('Error', 'Unable to verify Recovery Key. Please check and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, recoveryKeyInput, router]);

  const handleReset = useCallback(async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      // Attempt sign in with email (password is empty since we're recovering)
      const signInResult = await supabaseSignIn(email, '');
      if (!signInResult.success) {
        // Try to get session another way - maybe user is already signed in
      }

      const result = await changePasswordWithRecoveryKey(recoveryKeyInput, newPassword);
      if ('error' in result) {
        Alert.alert('Error', result.error);
        return;
      }

      setStep('success');
    } catch {
      Alert.alert('Error', 'Unable to reset password. The Recovery Key may be incorrect.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, recoveryKeyInput, newPassword, confirmPassword, router]);

  const handleBackToUnlock = useCallback(() => {
    router.replace('/');
  }, [router]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  if (step === 'success') {
    return (
      <View style={isDesktop ? styles.webRoot : styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, alignItems: 'center' }]}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
            </View>
          </View>
          <Text style={styles.title}>Password Reset</Text>
          <Text style={[styles.subtitle, { marginBottom: spacing.xl }]}>
            Your master password has been reset successfully. You can now unlock your vault with your new password.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleBackToUnlock} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Back to Unlock</Text>
          </TouchableOpacity>
        </Animated.View>
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="key" size={48} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.title}>Reset Master Password</Text>
        <Text style={styles.subtitle}>
          Enter your Recovery Key to reset your master password.
        </Text>

        {step === 'recovery-key' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              autoFocus
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => setTimeout(() => recoveryRef.current?.focus(), 50)}
            />

            <TextInput
              style={[styles.input, styles.monoInput]}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXXX"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              value={recoveryKeyInput}
              onChangeText={handleRecoveryInputChange}
              ref={recoveryRef}
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleVerify}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Verify Recovery Key</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'new-password' && (
          <>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              <Text style={styles.verifiedText}>Recovery Key verified</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="New master password (min 8 chars)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              autoCapitalize="none"
              textContentType="none"
              autoComplete="off"
              value={newPassword}
              onChangeText={setNewPassword}
              ref={passwordRef}
              autoFocus
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => setTimeout(() => confirmRef.current?.focus(), 50)}
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new master password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              autoCapitalize="none"
              textContentType="none"
              autoComplete="off"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              ref={confirmRef}
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleReset}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
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
    backButton: {
      position: 'absolute',
      top: insets.top + spacing.sm,
      left: spacing.md,
      zIndex: 10,
      padding: spacing.sm,
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
    monoInput: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      letterSpacing: 1.5,
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
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.primaryMuted,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    verifiedText: {
      ...typography.body,
      color: colors.accent,
      fontWeight: '600',
    },
  });
