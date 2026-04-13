import { supabase } from '../../services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to changes on shared_entries for a specific user.
 * Triggers callback when entries are inserted, updated, or deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToSharedEntries(
  userId: string,
  onSharedEntriesChange: () => void
): { unsubscribe: () => void } {
  const channel: RealtimeChannel = supabase
    .channel(`shared_entries:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_entries',
        filter: `shared_with_id=eq.${userId}`,
      },
      () => {
        onSharedEntriesChange();
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Subscribe to changes on vault_entries for a specific vault.
 * Useful for detecting changes made from another device.
 */
export function subscribeToVaultEntries(
  vaultId: string,
  onVaultEntriesChange: () => void
): { unsubscribe: () => void } {
  const channel: RealtimeChannel = supabase
    .channel(`vault_entries:${vaultId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'vault_entries',
        filter: `vault_id=eq.${vaultId}`,
      },
      () => {
        onVaultEntriesChange();
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
