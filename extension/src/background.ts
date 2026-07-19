import { supabase } from './platform/network'
import type { PostgrestSingleResponse } from '@supabase/supabase-js'

interface SignInMessage {
  type: 'SIGN_IN'
  email: string
  password: string
}

interface SignOutMessage {
  type: 'SIGN_OUT'
}

interface GetSessionMessage {
  type: 'GET_SESSION'
}

interface GetActiveTabMessage {
  type: 'GET_ACTIVE_TAB'
}

interface SupabaseQueryMessage {
  type: 'SUPABASE_QUERY'
  table: 'users' | 'vaults' | 'vault_entries'
  select?: string
  filters?: Record<string, unknown>
  single?: boolean
}

interface SupabaseUpsertMessage {
  type: 'SUPABASE_UPSERT'
  table: 'users' | 'vaults' | 'vault_entries'
  values: Record<string, unknown>
  onConflict?: string
}

type Message =
  | SignInMessage
  | SignOutMessage
  | GetSessionMessage
  | GetActiveTabMessage
  | SupabaseQueryMessage
  | SupabaseUpsertMessage

interface SignInResponse {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

interface SessionResponse {
  session: { userId: string; email: string } | null
}

interface ActiveTabResponse {
  url: string
  host: string
  title: string
}

function handleResponse<T>(res: PostgrestSingleResponse<T>) {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

async function handleSupabaseQuery(table: string, select?: string, filters?: Record<string, unknown>, single?: boolean) {
  let query = supabase.from(table as never).select(select ?? '*')
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null) as typeof query
      } else {
        query = query.eq(key, value as never)
      }
    }
  }
  if (single) {
    query = query.single() as typeof query
  }
  return handleResponse(await query)
}

async function handleSupabaseUpsert(table: string, values: Record<string, unknown>, onConflict?: string) {
  let query = supabase.from(table as never).upsert(values as never)
  if (onConflict) {
    query = query.onConflict(onConflict)
  }
  return handleResponse(await query.select().single())
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Password Manager] Installed')
})

async function handleSignIn(email: string, password: string): Promise<SignInResponse> {
  const result = await supabase.auth.signInWithPassword({ email, password })
  if (result.error) {
    return { success: false, error: result.error.message }
  }
  if (!result.data.user) {
    return { success: false, error: 'Sign in failed — no user returned' }
  }
  return {
    success: true,
    userId: result.data.user.id,
    email: result.data.user.email ?? undefined,
  }
}

async function handleSignOut(): Promise<void> {
  await supabase.auth.signOut()
}

async function handleGetSession(): Promise<SessionResponse> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user) {
    return { session: null }
  }
  return {
    session: {
      userId: data.session.user.id,
      email: data.session.user.email ?? '',
    },
  }
}

async function handleGetActiveTab(): Promise<ActiveTabResponse | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.url) return null
  const url = new URL(tab.url)
  return {
    url: tab.url,
    host: url.hostname.replace(/^www\./, ''),
    title: tab.title ?? '',
  }
}

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case 'SIGN_IN':
        handleSignIn(message.email, message.password).then(sendResponse)
        return true

      case 'SIGN_OUT':
        handleSignOut().then(() => sendResponse({ success: true }))
        return true

      case 'GET_SESSION':
        handleGetSession().then(sendResponse)
        return true

      case 'GET_ACTIVE_TAB':
        handleGetActiveTab().then(sendResponse)
        return true

      case 'SUPABASE_QUERY':
        handleSupabaseQuery(message.table, message.select, message.filters, message.single)
          .then(data => sendResponse({ data }))
          .catch(err => sendResponse({ error: err.message }))
        return true

      case 'SUPABASE_UPSERT':
        handleSupabaseUpsert(message.table, message.values, message.onConflict)
          .then(data => sendResponse({ data }))
          .catch(err => sendResponse({ error: err.message }))
        return true

      default:
        sendResponse({ error: 'Unknown message type' })
        return false
    }
  },
)

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    chrome.storage.local.remove(['cachedVaults', 'cachedEntries'])
  }
})
