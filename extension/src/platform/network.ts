import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database.types'

// Supabase v2 auth accepts async storage (getItem returns Promise<string | null>).
// The TS DOM Storage declares sync-only, but supabase-js tolerates Promise returns.
const sessionStorage = {
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
    const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_KEY
    if (!url || !publishableKey) {
      throw new Error(
        'Supabase credentials required. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in environment.',
      )
    }
    _client = createClient<Database>(url, publishableKey, {
      auth: {
        storage: sessionStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return _client
}
