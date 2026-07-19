import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database.types'

function getSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL || ''
}

const SUPABASE_URL = getSupabaseUrl()
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase credentials required. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in environment.',
  )
}

const sessionStorage: Storage = {
  getItem(key: string) {
    return chrome.storage.session.get(key).then(r => r[key] ?? null)
  },
  setItem(key: string, value: string) {
    return chrome.storage.session.set({ [key]: value })
  },
  removeItem(key: string) {
    return chrome.storage.session.remove(key)
  },
  get length() {
    return 0
  },
  key() {
    return null
  },
  clear() {
    return chrome.storage.session.clear()
  },
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
