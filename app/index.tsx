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
import { getIdentity, clearIdentity, getStoredSupabaseUserId } from '../core/auth/identityService';
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
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Use fine-grained loading state
  const isLoading = useValue(appStore$.isLoading);

  useEffect(() => {
    console.log('[Unlock] Component mounted, checking identity...');
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Always show unlock screen — if no local identity exists, the unlock flow
    // will attempt cloud bootstrap (second device). Only redirect to setup if
    // the Supabase session doesn't exist either (truly new user).
    getIdentity().then(identity => {
      console.log('[Unlock] Local identity found:', !!identity);
      if (identity) {
        setHasIdentity(true);
      } else {
        console.log('[Unlock] No local identity, checking cloud session...');
        // No local identity — check if there's a persisted Supabase session
        getStoredSupabaseUserId().then(uid => {
          console.log('[Unlock] Stored Supabase userId:', uid);
          if (uid) {
            // User has a cloud account — show unlock with email hint
            setHasIdentity(true);
          } else {
            // Truly new — no local identity and no cloud session
            setHasIdentity(false);
          }
        });
      }
    });
  }, [fadeAnim, router]);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim() || isSubmitting) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    console.log('[Unlock] Submitting unlock for email:', email.trim());
    setIsSubmitting(true);
    appActions.setLoading(true);
    try {
      console.log('[Unlock] Calling unlock()...');
      const result = await unlock(email, password);
      console.log('[Unlock] unlock() returned, has error:', 'error' in result);
      if ('error' in result) {
        console.error('[Unlock] Unlock error:', result.error);
        Alert.alert('Error', result.error);
        return;
      }
      const { masterKey, supabaseUserId } = result;
      console.log('[Unlock] Setting store values, identity:', !!masterKey, 'userId:', supabaseUserId);
      const identity = await getIdentity();
      if (identity) {
        appActions.setIdentity(identity);
      }
      appActions.setUserId(supabaseUserId);
      appActions.setMasterKey(masterKey);
      console.log('[Unlock] Navigating to tabs...');
      appActions.setAuthenticated(true);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[Unlock] Unexpected exception during unlock:', err);
      Alert.alert('Error', 'Unable to unlock vault');
    } finally {
      console.log('[Unlock] Clearing loading state');
      appActions.setLoading(false);
      setIsSubmitting(false);
    }
  }, [email, password, isSubmitting, unlock, router]);

  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );

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
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          autoFocus
        />

        <TextInput
          style={styles.input}
          placeholder="Master Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
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
                    setEmail('');
                    router.replace('/setup');
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.resetButtonText}>Forgot Password? Reset Vault</Text>
        </TouchableOpacity>

        {!hasIdentity && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/setup')}
          >
            <Text style={styles.createButtonText}>New? Create Account</Text>
          </TouchableOpacity>
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
