import { sendMessage } from '../../popup/messaging'

interface VaultRow {
  id: string
  user_id: string
  name: string
  encrypted_encryption_key: string
  version: number
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

interface VaultEntryRow {
  id: string
  vault_id: string
  encrypted_payload: string
  version: number
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface Vault {
  id: string
  userId: string
  name: string
  encryptedEncryptionKey: string
  version: number
  createdAt: number
  updatedAt: number
  deletedAt: number | undefined
}

export interface VaultEntry {
  id: string
  vaultId: string
  encryptedPayload: string
  version: number
  createdAt: number
  updatedAt: number
  deletedAt: number | undefined
}

function ms(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : 0
}

function msOpt(iso: string | null | undefined): number | undefined {
  return iso ? new Date(iso).getTime() : undefined
}

function parseVaultRow(row: VaultRow): Vault {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    encryptedEncryptionKey: row.encrypted_encryption_key,
    version: row.version,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOpt(row.deleted_at),
  }
}

function parseEntryRow(row: VaultEntryRow): VaultEntry {
  return {
    id: row.id,
    vaultId: row.vault_id,
    encryptedPayload: row.encrypted_payload,
    version: row.version,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: msOpt(row.deleted_at),
  }
}

export async function fetchVaults(userId: string): Promise<Vault[]> {
  const res = await sendMessage<{ data?: VaultRow[]; error?: string }>({
    type: 'SUPABASE_QUERY',
    table: 'vaults',
    filters: { user_id: userId, deleted_at: null },
  })
  if (res.error) throw new Error(res.error)
  return (res.data ?? []).map(parseVaultRow)
}

export async function fetchEntries(vaultId: string): Promise<VaultEntry[]> {
  const res = await sendMessage<{ data?: VaultEntryRow[]; error?: string }>({
    type: 'SUPABASE_QUERY',
    table: 'vault_entries',
    filters: { vault_id: vaultId, deleted_at: null },
  })
  if (res.error) throw new Error(res.error)
  return (res.data ?? []).map(parseEntryRow)
}

export async function createVault(
  userId: string,
  name: string,
  encryptedEncryptionKey: string,
): Promise<Vault> {
  const res = await sendMessage<{ data?: VaultRow; error?: string }>({
    type: 'SUPABASE_UPSERT',
    table: 'vaults',
    values: {
      user_id: userId,
      name,
      encrypted_encryption_key: encryptedEncryptionKey,
    },
  })
  if (res.error) throw new Error(res.error)
  return parseVaultRow(res.data!)
}

export async function createEntry(
  vaultId: string,
  encryptedPayload: string,
): Promise<VaultEntry> {
  const res = await sendMessage<{ data?: VaultEntryRow; error?: string }>({
    type: 'SUPABASE_UPSERT',
    table: 'vault_entries',
    values: {
      vault_id: vaultId,
      encrypted_payload: encryptedPayload,
    },
  })
  if (res.error) throw new Error(res.error)
  return parseEntryRow(res.data!)
}

export async function softDeleteVault(vaultId: string): Promise<void> {
  const res = await sendMessage<{ data?: unknown; error?: string }>({
    type: 'SUPABASE_UPSERT',
    table: 'vaults',
    values: {
      id: vaultId,
      deleted_at: new Date().toISOString(),
    },
    onConflict: 'id',
  })
  if (res.error) throw new Error(res.error)
}

export async function softDeleteEntry(entryId: string): Promise<void> {
  const res = await sendMessage<{ data?: unknown; error?: string }>({
    type: 'SUPABASE_UPSERT',
    table: 'vault_entries',
    values: {
      id: entryId,
      deleted_at: new Date().toISOString(),
    },
    onConflict: 'id',
  })
  if (res.error) throw new Error(res.error)
}
