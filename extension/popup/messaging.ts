export function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

export async function supabaseQuery<T>(
  table: 'users' | 'vaults' | 'vault_entries',
  options?: { select?: string; filters?: Record<string, unknown>; single?: boolean },
): Promise<T> {
  const res = await sendMessage<{ data?: T; error?: string }>({
    type: 'SUPABASE_QUERY',
    table,
    ...options,
  })
  if (res.error) throw new Error(res.error)
  return res.data as T
}

export async function supabaseUpsert<T>(
  table: 'users' | 'vaults' | 'vault_entries',
  values: Record<string, unknown>,
  onConflict?: string,
): Promise<T> {
  const res = await sendMessage<{ data?: T; error?: string }>({
    type: 'SUPABASE_UPSERT',
    table,
    values,
    onConflict,
  })
  if (res.error) throw new Error(res.error)
  return res.data as T
}
