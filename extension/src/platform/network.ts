import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database.types'

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

let _client: ReturnType<typeof createClient<Database>> | null = null

export function getSupabase(): ReturnType<typeof createClient<Database>> {
  if (!_client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error(
        'Supabase credentials required. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in environment.',
      )
    }
    _client = createClient<Database>(url, anonKey, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return _client
}
