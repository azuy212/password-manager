import { supabase } from '../../services/supabaseClient';
import CryptoNative from 'crypto-native';

import { encryptString } from '../crypto';

export interface ShareResult {
  success: boolean;
  error?: string;
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
 * Share a vault entry with another user
 * 
 * Flow:
 * 1. Fetch recipient's public key
 * 2. Encrypt the entry's key with recipient's public key
 * 3. Upload to shared_entries table
 */
export async function shareEntry(
  entryId: string,
  ownerId: string,
  recipientEmail: string,
  encryptedKey: string
): Promise<ShareResult> {
  try {
    // Get recipient's user ID
    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('id')
      .eq('email', recipientEmail)
      .single();
    
    if (recipientError || !recipientData) {
      return { success: false, error: 'User not found' };
    }
    
    // Create share record
    const { error } = await supabase
      .from('shared_entries')
      .insert({
        entry_id: entryId,
        owner_id: ownerId,
        shared_with_id: recipientData.id,
        encrypted_key: encryptedKey,
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get entries shared with current user
 */
export async function getSharedWithMe(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('shared_entries')
    .select(`
      *,
      vault_entries (
        id,
        title,
        username,
        encrypted_password,
        encrypted_notes,
        url
      )
    `)
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
export async function getSharedByMe(userId: string): Promise<any[]> {
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
