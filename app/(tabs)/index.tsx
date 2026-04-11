import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { getVaults, createVault, deleteVault } from '@/core/vault/vaultService';
import type { Vault } from '@/types/vault';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function VaultsScreen() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [showNewVaultModal, setShowNewVaultModal] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const router = useRouter();
  const { setVaults: setStoreVaults, masterKey } = useAppStore();

  const loadVaults = useCallback(async () => {
    try {
      const data = await getVaults();
      setVaults(data);
      setStoreVaults(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }, [setStoreVaults]);

  useFocusEffect(
    useCallback(() => {
      loadVaults();
    }, [loadVaults])
  );

  const handleCreateVault = () => {
    setNewVaultName('');
    setShowNewVaultModal(true);
  };

  const handleSaveVault = async () => {
    if (!newVaultName.trim() || !masterKey) {
      setShowNewVaultModal(false);
      return;
    }
    try {
      await createVault(
        {
          name: newVaultName.trim(),
          encryptedEncryptionKey: '',
        },
        masterKey
      );
      setShowNewVaultModal(false);
      loadVaults();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create vault');
      setShowNewVaultModal(false);
    }
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

      <Modal visible={showNewVaultModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Vault</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter vault name"
              placeholderTextColor="#999"
              value={newVaultName}
              onChangeText={setNewVaultName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveVault}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowNewVaultModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCreate]}
                onPress={handleSaveVault}
              >
                <Text style={styles.modalButtonTextCreate}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonCreate: {
    backgroundColor: '#007AFF',
  },
  modalButtonTextCancel: {
    color: '#333',
    fontWeight: '600',
  },
  modalButtonTextCreate: {
    color: '#fff',
    fontWeight: '600',
  },
});
