import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase credentials are required. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          public_key: string;
          salt: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          public_key: string;
          salt: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          public_key?: string;
          salt?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      vaults: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          encrypted_encryption_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          encrypted_encryption_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          encrypted_encryption_key?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      vault_entries: {
        Row: {
          id: string;
          vault_id: string;
          user_id: string;
          title: string;
          username: string;
          encrypted_password: string;
          encrypted_notes: string | null;
          url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vault_id: string;
          user_id: string;
          title: string;
          username: string;
          encrypted_password: string;
          encrypted_notes?: string | null;
          url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vault_id?: string;
          user_id?: string;
          title?: string;
          username?: string;
          encrypted_password?: string;
          encrypted_notes?: string | null;
          url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shared_entries: {
        Row: {
          id: string;
          entry_id: string;
          owner_id: string;
          shared_with_id: string;
          encrypted_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          owner_id: string;
          shared_with_id: string;
          encrypted_key: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          entry_id?: string;
          owner_id?: string;
          shared_with_id?: string;
          encrypted_key?: string;
          created_at?: string;
        };
      };
    };
  };
};
