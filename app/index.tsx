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
import { useAppStore } from '../store/useAppStore';

export default function UnlockScreen() {
  const [password, setPassword] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const { unlock, hasIdentity } = useUnlock();
  const router = useRouter();
  const { setLoading, setError } = useAppStore();

  useEffect(() => {
    setIsSetup(!hasIdentity);
  }, [hasIdentity]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      if (isSetup) {
        // First time setup
        router.push('/setup');
      } else {
        // Unlock existing
        const success = await unlock(password);
        if (success) {
          router.replace('/(tabs)');
        } else {
          Alert.alert('Error', 'Incorrect password');
        }
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
        <Text style={styles.title}>
          {isSetup ? 'Create Master Password' : 'Unlock Vault'}
        </Text>
        <Text style={styles.subtitle}>
          {isSetup
            ? 'Create a strong password to protect your vault'
            : 'Enter your master password to continue'}
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
          <Text style={styles.buttonText}>
            {isSetup ? 'Get Started' : 'Unlock'}
          </Text>
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
});
