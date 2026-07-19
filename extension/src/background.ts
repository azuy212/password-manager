import { supabase } from './platform/network'

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

type Message = SignInMessage | SignOutMessage | GetSessionMessage | GetActiveTabMessage

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

      default:
        sendResponse({ error: 'Unknown message type' })
        return false
    }
  },
)

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    chrome.storage.local.remove(['cachedVaults', 'cachedEntries'])
  }
})
