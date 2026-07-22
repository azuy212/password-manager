export const MessageType = {
  SIGN_IN: 'SIGN_IN',
  SIGN_OUT: 'SIGN_OUT',
  GET_SESSION: 'GET_SESSION',
  GET_ACTIVE_TAB: 'GET_ACTIVE_TAB',
  SUPABASE_QUERY: 'SUPABASE_QUERY',
  SUPABASE_UPSERT: 'SUPABASE_UPSERT',
} as const

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType]

export interface SignInMessage {
  type: typeof MessageType.SIGN_IN
  email: string
  password: string
}

export interface SignOutMessage {
  type: typeof MessageType.SIGN_OUT
}

export interface GetSessionMessage {
  type: typeof MessageType.GET_SESSION
}

export interface GetActiveTabMessage {
  type: typeof MessageType.GET_ACTIVE_TAB
}

export interface SupabaseQueryMessage {
  type: typeof MessageType.SUPABASE_QUERY
  table: 'users' | 'vaults' | 'vault_entries'
  select?: string
  filters?: Record<string, unknown>
  single?: boolean
}

export interface SupabaseUpsertMessage {
  type: typeof MessageType.SUPABASE_UPSERT
  table: 'users' | 'vaults' | 'vault_entries'
  values: Record<string, unknown>
  onConflict?: string
}

export type Message =
  | SignInMessage
  | SignOutMessage
  | GetSessionMessage
  | GetActiveTabMessage
  | SupabaseQueryMessage
  | SupabaseUpsertMessage

export interface SignInResponse {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

export interface SessionResponse {
  session: { userId: string; email: string } | null
}

export interface ActiveTabResponse {
  url: string
  host: string
  title: string
}
