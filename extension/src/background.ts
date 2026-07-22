import { getSupabase } from './platform/network'
import type { PostgrestSingleResponse } from '@supabase/supabase-js'
import {
  MessageType,
  type Message,
  type SignInResponse,
  type SessionResponse,
  type ActiveTabResponse,
} from './messageTypes'

function handleResponse<T>(res: PostgrestSingleResponse<T>) {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

async function handleSupabaseQuery(table: string, select?: string, filters?: Record<string, unknown>, single?: boolean) {
  let query = getSupabase().from(table as never).select(select ?? '*')
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
  let query = getSupabase().from(table as never).upsert(values as never)
  if (onConflict) {
    query = query.onConflict(onConflict)
  }
  return handleResponse(await query.select().single())
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Password Manager] Installed')
})

async function handleSignIn(email: string, password: string): Promise<SignInResponse> {
  const result = await getSupabase().auth.signInWithPassword({ email, password })
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
  await getSupabase().auth.signOut()
}

async function handleGetSession(): Promise<SessionResponse> {
  const { data } = await getSupabase().auth.getSession()
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
      case MessageType.SIGN_IN:
        handleSignIn(message.email, message.password)
          .then(sendResponse)
          .catch(err => sendResponse({ success: false, error: err.message }))
        return true

      case MessageType.SIGN_OUT:
        handleSignOut()
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ success: false, error: err.message }))
        return true

      case MessageType.GET_SESSION:
        handleGetSession().then(sendResponse).catch(err => sendResponse({ session: null, error: err.message }))
        return true

      case MessageType.GET_ACTIVE_TAB:
        handleGetActiveTab()
          .then(sendResponse)
          .catch(err => sendResponse({ error: err.message }))
        return true

      case MessageType.SUPABASE_QUERY:
        handleSupabaseQuery(message.table, message.select, message.filters, message.single)
          .then(data => sendResponse({ data }))
          .catch(err => sendResponse({ error: err.message }))
        return true

      case MessageType.SUPABASE_UPSERT:
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


