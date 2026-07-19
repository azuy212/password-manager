import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sendMessage } from '../messaging'
import { destroyAll } from '../../src/platform/unlock'
import { fetchVaults, fetchEntries, createEntry } from '../../src/repository/vaultRepository'
import { decryptVaultKey, decryptEntryPayload, encryptEntryPayload } from '../../src/repository/vaultCrypto'
import { SecureKey } from '../../src/platform/unlock'
import type { Vault as VaultRow } from '../../src/repository/vaultRepository'
import type { DecryptedEntry } from '../../src/repository/vaultCrypto'

interface Props {
  email: string
  userId: string
  onSignOut: () => void
  onLock: () => void
}

type Page =
  | { type: 'vault-list' }
  | { type: 'entry-list' }
  | { type: 'search' }
  | { type: 'entry-detail'; entry: DecryptedEntry }
  | { type: 'add-entry' }

interface SearchResult {
  entry: DecryptedEntry
  vaultName: string
}

export function VaultView({ email, userId, onSignOut, onLock }: Props) {
  const [page, setPage] = useState<Page>({ type: 'vault-list' })
  const [vaults, setVaults] = useState<VaultRow[]>([])
  const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [allEntries, setAllEntries] = useState<Map<string, DecryptedEntry[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const activeVault = useRef<VaultRow | null>(null)
  const activeDek = useRef<SecureKey | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchVaults(userId)
      .then(setVaults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
    return () => {
      activeDek.current?.destroy()
    }
  }, [userId])

  const loadEntries = useCallback(async (vault: VaultRow) => {
    setLoading(true)
    setError('')
    activeDek.current?.destroy()
    try {
      const dek = await decryptVaultKey(vault)
      if (!dek) {
        setError('Failed to decrypt vault key')
        setLoading(false)
        return
      }
      activeVault.current = vault
      activeDek.current = dek
      const entries = await fetchEntries(vault.id)
      const decrypted: DecryptedEntry[] = []
      for (const entry of entries) {
        const d = await decryptEntryPayload(entry.encryptedPayload, dek)
        if (d) {
          decrypted.push({
            ...d, id: entry.id, vaultId: entry.vaultId,
            createdAt: entry.createdAt, updatedAt: entry.updatedAt,
          })
        }
      }
      setDecryptedEntries(decrypted)
      setPage({ type: 'entry-list' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAllVaultEntries = useCallback(async () => {
    setSearchLoading(true)
    setError('')
    const map = new Map<string, DecryptedEntry[]>()
    try {
      for (const vault of vaults) {
        const dek = await decryptVaultKey(vault)
        if (!dek) continue
        const entries = await fetchEntries(vault.id)
        const decrypted: DecryptedEntry[] = []
        for (const entry of entries) {
          const d = await decryptEntryPayload(entry.encryptedPayload, dek)
          if (d) {
            decrypted.push({
              ...d, id: entry.id, vaultId: entry.vaultId,
              createdAt: entry.createdAt, updatedAt: entry.updatedAt,
            })
          }
        }
        dek.destroy()
        if (decrypted.length > 0) map.set(vault.id, decrypted)
      }
      setAllEntries(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [vaults])

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []
    for (const vault of vaults) {
      const entries = allEntries.get(vault.id) ?? []
      for (const entry of entries) {
        if (
          entry.title.toLowerCase().includes(q) ||
          entry.username.toLowerCase().includes(q) ||
          entry.url.toLowerCase().includes(q) ||
          entry.notes.toLowerCase().includes(q)
        ) {
          results.push({ entry, vaultName: vault.name })
        }
      }
    }
    results.sort((a, b) => a.entry.title.localeCompare(b.entry.title))
    return results
  }, [searchQuery, allEntries, vaults])

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (value.trim() && allEntries.size === 0) {
        loadAllVaultEntries()
      }
    }, 300)
  }, [allEntries.size, loadAllVaultEntries])

  const handleCopy = useCallback(async (text: string, entryId: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(entryId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const isSearchActive = searchQuery.trim().length > 0

  const handleLock = async () => {
    destroyAll()
    onLock()
  }

  const handleSignOutAndLock = async () => {
    destroyAll()
    await sendMessage({ type: 'SIGN_OUT' })
    onSignOut()
  }

  const goBackToVaults = useCallback(() => {
    activeVault.current = null
    activeDek.current?.destroy()
    activeDek.current = null
    setPage({ type: 'vault-list' })
  }, [])

  const handleEntryClick = useCallback((entry: DecryptedEntry) => {
    setPage({ type: 'entry-detail', entry })
  }, [])

  if (loading && page.type === 'vault-list') {
    return <BaseShell email={email}><p style={styles.loading}>Loading vaults...</p></BaseShell>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Password Manager</h1>
          <button onClick={handleLock} style={styles.lockBtn}>Lock</button>
        </div>
        <p style={styles.email}>{email}</p>

        {page.type !== 'entry-detail' && page.type !== 'add-entry' && (
          <div style={styles.searchWrap}>
            <input
              type="text"
              placeholder="Search all vaults..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        {isSearchActive && page.type !== 'entry-detail' && page.type !== 'add-entry' && (
          <div>
            {searchLoading && searchResults.length === 0 && (
              <p style={styles.loadingText}>Decrypting entries...</p>
            )}
            {!searchLoading && searchResults.length === 0 && searchQuery.trim() && (
              <p style={styles.empty}>No matching entries</p>
            )}
            {searchResults.length > 0 && (
              <ul style={styles.list}>
                {searchResults.map(r => (
                  <li key={r.entry.id} style={styles.listItem} onClick={() => handleEntryClick(r.entry)}>
                    <div>
                      <div style={styles.entryTitle}>{r.entry.title}</div>
                      <div style={styles.entrySub}>
                        {r.entry.username}
                        <span style={styles.vaultTag}>{r.vaultName}</span>
                      </div>
                    </div>
                    <span style={styles.chevron}>→</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isSearchActive && page.type === 'vault-list' && (
          <div>
            <h2 style={styles.sectionTitle}>Vaults ({vaults.length})</h2>
            {vaults.length === 0
              ? <p style={styles.empty}>No vaults found</p>
              : <ul style={styles.list}>
                  {vaults.map(v => (
                    <li key={v.id} style={styles.listItem} onClick={() => loadEntries(v)}>
                      <span style={styles.vaultName}>{v.name}</span>
                      <span style={styles.chevron}>→</span>
                    </li>
                  ))}
                </ul>
            }
          </div>
        )}

        {!isSearchActive && page.type === 'entry-list' && (
          <div>
            <button onClick={goBackToVaults} style={styles.backBtn}>← Vaults</button>
            {loading
              ? <p style={styles.loadingText}>Decrypting entries...</p>
              : <>
                  <div style={styles.sectionRow}>
                    <h2 style={styles.sectionTitle}>Entries ({decryptedEntries.length})</h2>
                    <button onClick={() => setPage({ type: 'add-entry' })} style={styles.addBtn}>+ Add</button>
                  </div>
                  {decryptedEntries.length === 0
                    ? <p style={styles.empty}>No entries</p>
                    : <ul style={styles.list}>
                        {decryptedEntries.map(e => (
                          <li key={e.id} style={styles.listItem} onClick={() => handleEntryClick(e)}>
                            <div>
                              <div style={styles.entryTitle}>{e.title}</div>
                              <div style={styles.entrySub}>{e.username}</div>
                            </div>
                            <span style={styles.chevron}>→</span>
                          </li>
                        ))}
                      </ul>
                  }
                </>
            }
          </div>
        )}

        {page.type === 'entry-detail' && (
          <EntryDetail
            entry={page.entry}
            copied={copiedId === page.entry.id}
            onCopy={() => handleCopy(page.entry.password, page.entry.id)}
            onBack={() => setPage(isSearchActive ? { type: 'search' } : { type: 'entry-list' })}
          />
        )}

        {page.type === 'add-entry' && (
          <AddEntryForm
            vaultId={activeVault.current?.id ?? ''}
            onBack={() => setPage({ type: 'entry-list' })}
            onSubmit={async (data) => {
              const vault = activeVault.current
              const dek = activeDek.current
              if (!vault || !dek) return
              setError('')
              try {
                const payload = await encryptEntryPayload(data, dek)
                await createEntry(vault.id, payload)
                // Refresh
                const entries = await fetchEntries(vault.id)
                const decrypted: DecryptedEntry[] = []
                for (const entry of entries) {
                  const d = await decryptEntryPayload(entry.encryptedPayload, dek)
                  if (d) {
                    decrypted.push({
                      ...d, id: entry.id, vaultId: entry.vaultId,
                      createdAt: entry.createdAt, updatedAt: entry.updatedAt,
                    })
                  }
                }
                setDecryptedEntries(decrypted)
                setPage({ type: 'entry-list' })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create entry')
              }
            }}
          />
        )}

        <button onClick={handleSignOutAndLock} style={styles.signOut}>Sign out</button>
      </div>
    </div>
  )
}

function BaseShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Password Manager</h1>
        </div>
        <p style={styles.email}>{email}</p>
        {children}
      </div>
    </div>
  )
}

function EntryDetail({ entry, copied, onCopy, onBack }: {
  entry: DecryptedEntry; copied: boolean; onCopy: () => void; onBack: () => void
}) {
  const copyField = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }
  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back</button>
      <h2 style={styles.sectionTitle}>{entry.title}</h2>
      <Field label="Username" value={entry.username} onCopy={() => copyField(entry.username)} />
      <Field label="Password" value={entry.password} onCopy={onCopy} copyLabel={copied ? 'Copied!' : 'Copy'} />
      {entry.url && <Field label="URL" value={entry.url} onCopy={() => copyField(entry.url)} />}
      {entry.notes && (
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Notes</div>
          <div style={styles.notesText}>{entry.notes}</div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onCopy, copyLabel }: {
  label: string; value: string; onCopy?: () => void; copyLabel?: string
}) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldRow}>
        <input type="text" readOnly value={value} style={styles.fieldValue} />
        {onCopy && (
          <button onClick={onCopy} style={styles.copyBtn}>{copyLabel ?? 'Copy'}</button>
        )}
      </div>
    </div>
  )
}

function AddEntryForm({ vaultId, onBack, onSubmit }: {
  vaultId: string
  onBack: () => void
  onSubmit: (data: { title: string; username: string; password: string; url: string; notes: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !password) return
    setSubmitting(true)
    await onSubmit({ title, username, password, url, notes })
  }

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back</button>
      <h2 style={styles.sectionTitle}>New Entry</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <Inp label="Title" value={title} onChange={setTitle} required />
        <Inp label="Username" value={username} onChange={setUsername} />
        <Inp label="Password" value={password} onChange={setPassword} required type="password" />
        <Inp label="URL" value={url} onChange={setUrl} />
        <Inp label="Notes" value={notes} onChange={setNotes} multiline />
        <button type="submit" disabled={submitting || !title} style={styles.saveBtn}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  )
}

function Inp({ label, value, onChange, required, type, multiline }: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; type?: string; multiline?: boolean
}) {
  return (
    <label style={styles.inpBlock}>
      <span style={styles.fieldLabel}>{label}</span>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} style={{ ...styles.inp, minHeight: 56, resize: 'vertical' as const }} />
        : <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} required={required} style={styles.inp} />
      }
    </label>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: 360, minHeight: 300, maxHeight: 560, overflowY: 'auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14, color: '#1a1a1a', background: '#f5f5f5',
  },
  card: { background: '#fff', borderRadius: 8, padding: 20, margin: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 600, margin: 0, color: '#2d6a4f' },
  email: { fontSize: 12, color: '#888', margin: '0 0 12px' },
  searchWrap: { margin: '0 0 8px' },
  searchInput: {
    width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, background: '#f9f9f9',
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, margin: '12px 0 8px', color: '#333' },
  sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: {
    padding: '10px 12px', borderBottom: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
  },
  vaultName: { fontWeight: 500, color: '#2d6a4f' },
  vaultTag: {
    display: 'inline-block', marginLeft: 6, padding: '0 5px', borderRadius: 3,
    background: '#e8f5e9', color: '#2e7d32', fontSize: 10, fontWeight: 600,
  },
  chevron: { color: '#ccc', fontSize: 16 },
  entryTitle: { fontWeight: 500, color: '#333' },
  entrySub: { fontSize: 12, color: '#888', marginTop: 2 },
  backBtn: { background: 'none', border: 'none', color: '#2d6a4f', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 8 },
  lockBtn: { padding: '4px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 12, cursor: 'pointer' },
  addBtn: { padding: '4px 10px', borderRadius: 4, border: 'none', background: '#2d6a4f', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { padding: '10px 16px', borderRadius: 4, border: 'none', background: '#2d6a4f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 12 },
  signOut: { background: 'none', border: 'none', color: '#bbb', fontSize: 12, cursor: 'pointer', marginTop: 16, display: 'block', width: '100%', textAlign: 'center' },
  empty: { color: '#999', fontSize: 13, fontStyle: 'italic', padding: '8px 0' },
  error: { color: '#d32f2f', fontSize: 12, padding: '8px 0' },
  loading: { textAlign: 'center' as const, color: '#999', padding: 40 },
  loadingText: { textAlign: 'center' as const, color: '#999', padding: 20 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  fieldRow: { display: 'flex', gap: 4 },
  fieldValue: {
    flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid #eee',
    fontSize: 13, background: '#f9f9f9', color: '#333', fontFamily: 'monospace',
  },
  copyBtn: { padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  notesText: { padding: '6px 8px', fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' as const, background: '#f9f9f9', borderRadius: 4, border: '1px solid #eee' },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  inpBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  inp: { padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, outline: 'none' },
}
