import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { createEntry, updateEntry, getEntry, deleteEntry } from '../core/vault/vaultService';
import { decryptString, encryptString } from '../core/crypto';
import type { VaultEntryInput } from '../types/vault';

export default function EntryScreen() {
  const params = useLocalSearchParams<{ vaultId: string; entryId?: string }>();
  const router = useRouter();
  const { masterKey } = useAppStore();
  
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (params.entryId) {
      loadEntry();
    }
  }, [params.entryId]);

  const loadEntry = async () => {
    if (!params.entryId || !masterKey) return;
    try {
      const entry = await getEntry(params.entryId, masterKey);
      if (entry) {
        setTitle(entry.title);
        setUsername(entry.username);
        // Decrypt password
        try {
          const decryptedPassword = await decryptString(entry.encryptedPassword, masterKey);
          setPassword(decryptedPassword);
        } catch {
          setPassword('');
        }
        // Decrypt notes if present
        if (entry.encryptedNotes) {
          try {
            const decryptedNotes = await decryptString(entry.encryptedNotes, masterKey);
            setNotes(decryptedNotes);
          } catch {
            setNotes('');
          }
        } else {
          setNotes('');
        }
        setUrl(entry.url || '');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load entry');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !username.trim()) {
      Alert.alert('Error', 'Title and username are required');
      return;
    }

    if (!masterKey) {
      Alert.alert('Error', 'Master key not available');
      return;
    }

    try {
      // Encrypt password and notes before saving
      const encryptedPasswordStr = await encryptString(password, masterKey);

      let encryptedNotesStr: string | undefined;
      if (notes.trim()) {
        encryptedNotesStr = await encryptString(notes, masterKey);
      }

      const input: VaultEntryInput = {
        vaultId: params.vaultId as string,
        title,
        username,
        encryptedPassword: encryptedPasswordStr,
        url: url || undefined,
        encryptedNotes: encryptedNotesStr,
      };

      if (params.entryId) {
        await updateEntry(params.entryId, input, masterKey);
      } else {
        await createEntry(input, masterKey);
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = () => {
    if (!params.entryId) return;
    
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntry(params.entryId as string);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {params.entryId ? 'Edit Entry' : 'New Entry'}
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Username / Email"
          value={username}
          onChangeText={setUsername}
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={24}
              color="#666"
            />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Website URL (optional)"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />

        {params.entryId && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash" size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Entry</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
