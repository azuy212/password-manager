import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { getIdentity, clearIdentity, getStoredSupabaseUserId, migrateV1ToV2 } from '../core/auth/identityService';
import { isBiometricUnlockEnabled, unlockWithBiometrics } from '../core/auth/biometricService';
import { appActions, appStore$ } from '../store/appStore';
import { useValue } from '@legendapp/state/react';
import { useTheme } from '../hooks/useTheme';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { spacing, radius, typography } from '../utils/themedStyles';
import type { ThemeColors } from '../constants/Colors';

export default function UnlockScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { unlock } = useUnlock();
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);

  // Migration recovery key display
  const [showMigrationKey, setShowMigrationKey] = useState(false);
  const [migrationKey, setMigrationKey] = useState<string | null>(null);
  const [migrationConfirmed, setMigrationConfirmed] = useState(false);
  const [pendingMasterKey, setPendingMasterKey] = useState<any>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);

  const isLoading = useValue(appStore$.isLoading);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    getIdentity().then(identity => {
      if (identity) {
        setHasIdentity(true);
      } else {
        getStoredSupabaseUserId().then(uid => {
          if (uid) {
            setHasIdentity(true);
          } else {
            setHasIdentity(false);
          }
        });
      }
    });

    isBiometricUnlockEnabled().then(enabled => {
      setBiometricEnabled(enabled);
      if (enabled) {
        setShowBiometric(true);
      }
    });
  }, [fadeAnim, router]);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim() || isSubmitting) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    setIsSubmitting(true);
    appActions.setLoading(true);
    try {
      const result = await unlock(email, password);
      if ('error' in result) {
        Alert.alert('Error', result.error);
        return;
      }

      if (result.needsMigration && result.migrationWaiting) {
        // Migration happened — re-run unlock to get keys
        const reResult = await unlock(email, password);
        if ('error' in reResult) {
          Alert.alert('Error', reResult.error);
          return;
        }
        const identity = await getIdentity();
        if (identity) {
          appActions.setIdentity(identity);
        }
        appActions.setUserId(reResult.supabaseUserId);
        appActions.setAuthenticated(true);
        router.replace('/(tabs)');
        return;
      }

      const { supabaseUserId } = result;
      const identity = await getIdentity();
      if (identity) {
        appActions.setIdentity(identity);
      }
      appActions.setUserId(supabaseUserId);
      appActions.setAuthenticated(true);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', 'Unable to unlock vault');
    } finally {
      appActions.setLoading(false);
      setIsSubmitting(false);
    }
  }, [email, password, isSubmitting, unlock, router]);

  const handleBiometricUnlock = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await unlockWithBiometrics();
      if (!result) {
        Alert.alert('Error', 'Biometric unlock failed');
        return;
      }

      const { supabase } = await import('../services/supabaseClient');
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) {
        // Need to sign in
        Alert.alert('Sign In Required', 'Please enter your password to sign in first');
        return;
      }

      const identity = await getIdentity();
      if (identity) {
        appActions.setIdentity(identity);
      }
      appActions.setUserId(userId);
      appActions.setAuthenticated(true);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Biometric unlock failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [router]);

  const handleMigrationConfirmed = useCallback(async () => {
    setMigrationKey(null);
    setShowMigrationKey(false);
    if (pendingMasterKey && pendingUserId) {
      const identity = await getIdentity();
      if (identity) appActions.setIdentity(identity);
      appActions.setUserId(pendingUserId);
      appActions.setMasterKey(pendingMasterKey);
      appActions.setAuthenticated(true);
      router.replace('/(tabs)');
    }
  }, [pendingMasterKey, pendingUserId, router]);

  const copyMigrationKey = useCallback(async () => {
    if (migrationKey) {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(migrationKey);
      Alert.alert('Copied', 'Recovery Key copied to clipboard');
    }
  }, [migrationKey]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

  if (showMigrationKey && migrationKey) {
    return (
      <View style={isDesktop ? styles.webRoot : styles.container}>
        <View style={styles.recoveryContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={48} color={colors.accent} />
            </View>
          </View>
          <Text style={styles.recoveryTitle}>Vault Updated</Text>
          <Text style={styles.recoveryWarning}>
            Your vault has been upgraded with recovery key support. Save this key now.
          </Text>
          <View style={styles.recoveryKeyBox}>
            <Text style={styles.recoveryKeyText} selectable>{migrationKey}</Text>
          </View>
          <TouchableOpacity style={styles.copyBtn} onPress={copyMigrationKey} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={18} color={colors.textInverse} />
            <Text style={styles.copyBtnText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmRow}
            onPress={() => setMigrationConfirmed(!migrationConfirmed)}
          >
            <View style={[styles.checkbox, migrationConfirmed && styles.checkboxChecked]}>
              {migrationConfirmed && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
            </View>
            <Text style={styles.confirmText}>I have saved my Recovery Key</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueBtn, !migrationConfirmed && styles.continueBtnDisabled]}
            onPress={handleMigrationConfirmed}
            disabled={!migrationConfirmed}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  return (
    <View style={isDesktop ? styles.webRoot : styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={isDesktop ? styles.webContent : styles.container}
      >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={48} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.title}>Unlock Vault</Text>
        <Text style={styles.subtitle}>
          Enter your master password to continue
        </Text>

        {showBiometric && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricUnlock}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            <Ionicons name="finger-print" size={24} color={colors.textInverse} />
            <Text style={styles.biometricButtonText}>Unlock with Face ID</Text>
          </TouchableOpacity>
        )}

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
          onSubmitEditing={() => setTimeout(() => passwordRef.current?.focus(), 50)}
        />

        <TextInput
          style={styles.input}
          placeholder="Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          textContentType="none"
          autoComplete="off"
          value={password}
          onChangeText={setPassword}
          ref={passwordRef}
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
          style={styles.linkButton}
          onPress={() => router.push('/forgot-password')}
        >
          <Text style={styles.linkButtonText}>Forgot your password? Use Recovery Key</Text>
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
                    setEmail('');
                    router.replace('/setup');
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.resetButtonText}>Reset Vault</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/setup')}
        >
          <Text style={styles.createButtonText}>
            {hasIdentity ? 'Create New Account' : 'New? Create Account'}
          </Text>
        </TouchableOpacity>
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
      flex: 1,
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
    copyBtn: {
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
    copyBtnText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '600',
    },
    confirmRow: {
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
    continueBtn: {
      backgroundColor: colors.primary,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      width: '100%',
    },
    continueBtnDisabled: {
      opacity: 0.4,
    },
    continueBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    biometricButtonText: {
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
    linkButton: {
      marginTop: spacing.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    resetButton: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      alignItems: 'center',
    },
    resetButtonText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '500',
    },
    createButton: {
      marginTop: spacing.sm,
      padding: spacing.md,
      alignItems: 'center',
    },
    createButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
