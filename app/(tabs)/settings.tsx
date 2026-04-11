import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clearIdentity } from '@/core/auth/identityService';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { reset } = useAppStore();

  const handleReset = () => {
    Alert.alert(
      'Reset Vault',
      'This will delete all data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearIdentity();
            reset();
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
        <Ionicons name="sync" size={24} color="#007AFF" />
        <Text style={styles.settingText}>Sync Now</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
        <Ionicons name="time" size={24} color="#007AFF" />
        <Text style={styles.settingText}>Auto-Lock Timer</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
        <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
        <Text style={styles.settingText}>Security</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, styles.danger]} onPress={handleReset}>
        <Ionicons name="trash" size={24} color="#FF3B30" />
        <Text style={[styles.settingText, styles.dangerText]}>Reset Vault</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
  },
  danger: {
    marginTop: 24,
  },
  dangerText: {
    color: '#FF3B30',
  },
});
