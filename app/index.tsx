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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUnlock } from '../core/auth/useUnlock';
import { getIdentity, clearIdentity } from '../core/auth/identityService';
import { useAppStore } from '../store/useAppStore';

export default function UnlockScreen() {
  const [password, setPassword] = useState('');
  const { unlock } = useUnlock();
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null);
  const router = useRouter();
  const { setLoading, setError, setAuthenticated, setIdentity, setMasterKey, setUserId } = useAppStore();

  useEffect(() => {
    getIdentity().then(identity => {
      if (!identity) {
        // No identity — go to setup immediately
        router.replace('/setup');
      } else {
        setHasIdentity(true);
      }
    });
  }, []);

  if (hasIdentity === null) {
    // Still loading
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

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
        Alert.alert('Error', 'Incorrect password');
      }
    } catch (error: any) {
      setError(error.message);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Unlock Vault</Text>
        <Text style={styles.subtitle}>
          Enter your master password to continue
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Master Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Unlock</Text>
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
});
