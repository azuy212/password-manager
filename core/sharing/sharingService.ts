import { supabase } from '../../services/supabaseClient';
import { encryptBytes, decryptBytes, SecureKey } from '../crypto';
import { fetchX25519PublicKey, getUserIdByEmail } from '../auth/supabaseAuthService';
import { getDecryptedX25519PrivateKey } from '../auth/identityService';
import { getMasterKey, getCachedEncryptedVEK } from '../keyStore';
import { ecdh } from '../crypto/x25519';

export interface ShareResult {
  success: boolean;
  error?: string;
}

export interface SharedEntryWithVaultEntry {
  id: string;
  entry_id: string;
  owner_id: string;
  shared_with_id: string;
  encrypted_key: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface SharedEntryWithUser {
  id: string;
  entry_id: string;
  owner_id: string;
  shared_with_id: string;
  encrypted_key: string;
  users: {
    email: string;
  } | null;
}

/**
 * Get user's public key by email
 */
export async function getUserPublicKeyByEmail(email: string): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('users')
    .select('public_key')
    .eq('email', email)
    .single();
  
  if (error || !data) {
    console.error('Failed to fetch public key:', error);
    return null;
  }
  
  return JSON.parse(data.public_key);
}

/**
 * Share a vault entry with another user using ECDH-based key wrapping.
 *
 * Flow:
 * 1. Get recipient's user ID and X25519 public key
 * 2. Decrypt sender's X25519 private key
 * 3. ECDH → shared secret
 * 4. Encrypt the vault DEK with the shared secret
 * 5. Upload to shared_entries table
 */
export async function shareEntryWithECDH(
  entryId: string,
  ownerId: string,
  recipientEmail: string,
  vaultDEK: SecureKey,
): Promise<ShareResult> {
  try {
    const passwordKey = getMasterKey();
    const encryptedVEKPassword = getCachedEncryptedVEK();
    if (!passwordKey || !encryptedVEKPassword) return { success: false, error: 'Not authenticated' };

    const recipientId = await getUserIdByEmail(recipientEmail);
    if (!recipientId) return { success: false, error: 'User not found' };

    if (recipientId === ownerId) return { success: false, error: 'Cannot share with yourself' };

    const recipientX25519Pub = await fetchX25519PublicKey(recipientId);
    if (!recipientX25519Pub) return { success: false, error: 'Recipient has no X25519 key' };

    const senderX25519Priv = await getDecryptedX25519PrivateKey(passwordKey, encryptedVEKPassword);
    if (!senderX25519Priv) return { success: false, error: 'Your X25519 key not found' };

    // ECDH: derive shared secret
    const sharedSecret = ecdh(senderX25519Priv, recipientX25519Pub);
    const sharedKey = new SecureKey(sharedSecret);

    // Encrypt vault DEK with shared secret
    const encryptedKey = await encryptBytes(vaultDEK.toArray(), sharedKey);
    sharedKey.destroy();

    // Create share record
    const { error } = await supabase
      .from('shared_entries')
      .insert({
        entry_id: entryId,
        owner_id: ownerId,
        shared_with_id: recipientId,
        encrypted_key: encryptedKey,
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Already shared with this user' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Legacy share entry — creates a share record with a pre-encrypted key.
 * Prefer shareEntryWithECDH for new flows.
 */
export async function shareEntry(
  entryId: string,
  ownerId: string,
  recipientEmail: string,
  encryptedKey: string
): Promise<ShareResult> {
  try {
    const recipientId = await getUserIdByEmail(recipientEmail);
    if (!recipientId) return { success: false, error: 'User not found' };

    const { error } = await supabase
      .from('shared_entries')
      .insert({
        entry_id: entryId,
        owner_id: ownerId,
        shared_with_id: recipientId,
        encrypted_key: encryptedKey,
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Already shared with this user' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Decrypt a shared entry's vault DEK using ECDH.
 * Returns the vault DEK so it can be used to decrypt the entry content.
 */
export async function unwrapSharedEntryKey(
  encryptedKey: string,
  ownerX25519PublicKey: number[],
): Promise<SecureKey | null> {
  const passwordKey = getMasterKey();
  const encryptedVEKPassword = getCachedEncryptedVEK();
  if (!passwordKey || !encryptedVEKPassword) return null;

  const recipientX25519Priv = await getDecryptedX25519PrivateKey(passwordKey, encryptedVEKPassword);
  if (!recipientX25519Priv) return null;

  try {
    const sharedSecret = ecdh(recipientX25519Priv, ownerX25519PublicKey);
    const sharedKey = new SecureKey(sharedSecret);

    const dekBytes = await decryptBytes(encryptedKey, sharedKey);
    sharedKey.destroy();

    return new SecureKey(dekBytes);
  } catch {
    return null;
  }
}

/**
 * Get entries shared with current user.
 * Recipients access the actual encrypted_payload from vault_entries
 * via the merged RLS policy (shared-with path).
 */
export async function getSharedWithMe(userId: string): Promise<SharedEntryWithVaultEntry[]> {
  const { data, error } = await supabase
    .from('shared_entries')
    .select('*')
    .eq('shared_with_id', userId);

  if (error) {
    console.error('Failed to fetch shared entries:', error);
    return [];
  }

  return data || [];
}

/**
 * Get entries shared by current user
 */
export async function getSharedByMe(userId: string): Promise<SharedEntryWithUser[]> {
  const { data, error } = await supabase
    .from('shared_entries')
    .select(`
      *,
      users!shared_with_id (
        email
      )
    `)
    .eq('owner_id', userId);
  
  if (error) {
    console.error('Failed to fetch shared entries:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Revoke access to a shared entry
 */
export async function revokeShare(shareId: string, ownerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('shared_entries')
    .delete()
    .eq('id', shareId)
    .eq('owner_id', ownerId);
  
  return !error;
}
