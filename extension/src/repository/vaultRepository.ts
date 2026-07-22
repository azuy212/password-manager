import { supabaseQuery, supabaseUpsert } from '../../popup/messaging'

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
  const rows = await supabaseQuery<VaultRow[]>('vaults', { filters: { user_id: userId, deleted_at: null } })
  return (rows ?? []).map(parseVaultRow)
}

export async function fetchEntries(vaultId: string): Promise<VaultEntry[]> {
  const rows = await supabaseQuery<VaultEntryRow[]>('vault_entries', { filters: { vault_id: vaultId, deleted_at: null } })
  return (rows ?? []).map(parseEntryRow)
}

export async function createEntry(
  vaultId: string,
  encryptedPayload: string,
): Promise<VaultEntry> {
  const data = await supabaseUpsert<VaultEntryRow>('vault_entries', {
    vault_id: vaultId,
    encrypted_payload: encryptedPayload,
  })
  return parseEntryRow(data)
}


