import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getEntriesForVault } from '../core/vault/vaultService';
import { useAppStore } from '../store/useAppStore';
import type { VaultEntry } from '../types/vault';

export default function VaultScreen() {
  const params = useLocalSearchParams<{ vaultId: string; vaultName: string }>();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const router = useRouter();
  const { masterKey } = useAppStore();

  const loadEntries = useCallback(async () => {
    if (!params.vaultId || !masterKey) return;
    try {
      const data = await getEntriesForVault(params.vaultId, masterKey);
      setEntries(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load entries');
    }
  }, [params.vaultId, masterKey]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const handleAddEntry = () => {
    router.push({
      pathname: '/entry',
      params: { vaultId: params.vaultId },
    });
  };

  const handleEditEntry = (entry: VaultEntry) => {
    router.push({
      pathname: '/entry',
      params: { vaultId: params.vaultId, entryId: entry.id },
    });
  };

  const renderItem = ({ item }: { item: VaultEntry }) => (
    <TouchableOpacity
      style={styles.entryItem}
      onPress={() => handleEditEntry(item)}
    >
      <Ionicons name="key" size={24} color="#007AFF" />
      <View style={styles.entryInfo}>
        <Text style={styles.entryTitle}>{item.title}</Text>
        <Text style={styles.entryUsername}>{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{params.vaultName}</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="key" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptySubtext}>
              Tap + to add a password
            </Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={handleAddEntry}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
  list: {
    padding: 16,
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  entryUsername: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
