import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { getVaults, createVault, deleteVault } from '@/core/vault/vaultService';
import type { Vault } from '@/types/vault';

export default function VaultsScreen() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const router = useRouter();
  const { setVaults: setStoreVaults, masterKey } = useAppStore();

  useEffect(() => {
    loadVaults();
  }, []);

  const loadVaults = async () => {
    try {
      const data = await getVaults();
      setVaults(data);
      setStoreVaults(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCreateVault = () => {
    Alert.prompt(
      'New Vault',
      'Enter vault name:',
      async (name) => {
        if (name && masterKey) {
          try {
            await createVault(
              {
                name,
                encryptedEncryptionKey: '',
              },
              masterKey
            );
            loadVaults();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        }
      },
      'plain-text'
    );
  };

  const handleDeleteVault = (vault: Vault) => {
    Alert.alert(
      'Delete Vault',
      `Are you sure you want to delete "${vault.name}"? All entries will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVault(vault.id);
              loadVaults();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleOpenVault = (vault: Vault) => {
    router.push({
      pathname: '/vault',
      params: { vaultId: vault.id, vaultName: vault.name },
    });
  };

  const renderItem = ({ item }: { item: Vault }) => (
    <TouchableOpacity
      style={styles.vaultItem}
      onPress={() => handleOpenVault(item)}
      onLongPress={() => handleDeleteVault(item)}
    >
      <Ionicons name="folder" size={24} color="#007AFF" />
      <View style={styles.vaultInfo}>
        <Text style={styles.vaultName}>{item.name}</Text>
        <Text style={styles.vaultDate}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={vaults}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No vaults yet</Text>
            <Text style={styles.emptySubtext}>
              Tap + to create your first vault
            </Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={handleCreateVault}>
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
  list: {
    padding: 16,
  },
  vaultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  vaultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vaultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  vaultDate: {
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
