import { Database } from '@/types/database.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

function getSupabaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  if (Platform.OS === 'android') {
    return url.replace('localhost', '10.0.2.2');
  }
  return url;
}

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Supabase credentials are required. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in your environment.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
