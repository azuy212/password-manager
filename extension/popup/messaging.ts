import {
  MessageType,
  type SupabaseQueryMessage,
  type SupabaseUpsertMessage,
  type SignInMessage,
  type SignOutMessage,
  type GetSessionMessage,
  type GetActiveTabMessage,
  type ActiveTabResponse,
} from '../src/messageTypes'

export function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

export function sendSignIn(email: string, password: string) {
  return sendMessage<{ success: boolean; userId?: string; email?: string; error?: string }>({
    type: MessageType.SIGN_IN,
    email,
    password,
  } satisfies SignInMessage)
}

export function sendSignOut() {
  return sendMessage<{ success: boolean }>({ type: MessageType.SIGN_OUT } satisfies SignOutMessage)
}

export function sendGetActiveTab() {
  return sendMessage<ActiveTabResponse | null>(
    { type: MessageType.GET_ACTIVE_TAB } satisfies GetActiveTabMessage,
  )
}

export function sendGetSession() {
  return sendMessage<{ session: { userId: string; email: string } | null }>(
    { type: MessageType.GET_SESSION } satisfies GetSessionMessage,
  )
}

export async function supabaseQuery<T>(
  table: SupabaseQueryMessage['table'],
  options?: { select?: string; filters?: Record<string, unknown>; single?: boolean },
): Promise<T> {
  const res = await sendMessage<{ data?: T; error?: string }>({
    type: MessageType.SUPABASE_QUERY,
    table,
    ...options,
  })
  if (res.error) throw new Error(res.error)
  return res.data as T
}

export async function supabaseUpsert<T>(
  table: SupabaseUpsertMessage['table'],
  values: Record<string, unknown>,
  onConflict?: string,
): Promise<T> {
  const res = await sendMessage<{ data?: T; error?: string }>({
    type: MessageType.SUPABASE_UPSERT,
    table,
    values,
    onConflict,
  })
  if (res.error) throw new Error(res.error)
  return res.data as T
}
