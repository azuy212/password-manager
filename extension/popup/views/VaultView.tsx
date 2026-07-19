import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sendSignOut, sendGetActiveTab } from '../messaging'
import { destroyAll } from '../../src/platform/unlock'
import { fetchVaults, fetchEntries, createEntry } from '../../src/repository/vaultRepository'
import { decryptVaultKey, decryptEntryPayload, encryptEntryPayload } from '../../src/repository/vaultCrypto'
import { SecureKey } from '@/core/crypto/SecureKey'
import type { Vault as VaultRow } from '../../src/repository/vaultRepository'
import type { DecryptedEntry } from '../../src/repository/vaultCrypto'

interface Props {
  email: string
  userId: string
  onSignOut: () => void
  onLock: () => void
}

type Page =
  | { type: 'entries-list' }
  | { type: 'entry-detail'; entry: DecryptedEntry & { vaultName: string } }
  | { type: 'add-entry' }

interface AllEntry extends DecryptedEntry {
  vaultName: string
}

type CopyTarget = { entryId: string; menuTop: number; menuLeft: number } | null

export function VaultView({ email, userId, onSignOut, onLock }: Props) {
  const [page, setPage] = useState<Page>({ type: 'entries-list' })
  const [vaults, setVaults] = useState<VaultRow[]>([])
  const [allEntries, setAllEntries] = useState<AllEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyTarget, setCopyTarget] = useState<CopyTarget>(null)
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null)
  const [currentHost, setCurrentHost] = useState('')
  const deksRef = useRef<Map<string, SecureKey>>(new Map())

  useEffect(() => {
    sendGetActiveTab().then(tab => {
      if (tab?.host) setCurrentHost(tab.host)
    })
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const vaultsData = await fetchVaults(userId)
        setVaults(vaultsData)
        const all: AllEntry[] = []
        const deks = new Map<string, SecureKey>()
        for (const vault of vaultsData) {
          const dek = await decryptVaultKey(vault)
          if (!dek) continue
          deks.set(vault.id, dek)
          const entries = await fetchEntries(vault.id)
          for (const entry of entries) {
            const d = await decryptEntryPayload(entry.encryptedPayload, dek)
            if (d) {
              all.push({ ...d, id: entry.id, vaultId: entry.vaultId, vaultName: vault.name, createdAt: entry.createdAt, updatedAt: entry.updatedAt })
            }
          }
        }
        setAllEntries(all)
        deksRef.current = deks
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load entries')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      for (const dek of deksRef.current.values()) dek.destroy()
      deksRef.current.clear()
    }
  }, [userId])

  const relevanceScore = (entry: AllEntry, host: string): number => {
    if (!host) return 0
    const entryUrl = entry.url.toLowerCase()
    const h = host.toLowerCase()
    if (entryUrl.includes(h)) return 2
    if (entryUrl.includes(h.split('.')[0])) return 1
    return 0
  }

  const sortedEntries = useMemo(() => {
    const sorted = [...allEntries]
    sorted.sort((a, b) => {
      const sa = relevanceScore(a, currentHost)
      const sb = relevanceScore(b, currentHost)
      if (sa !== sb) return sb - sa
      return a.title.localeCompare(b.title)
    })
    return sorted
  }, [allEntries, currentHost])

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return sortedEntries
    const q = searchQuery.toLowerCase().trim()
    return sortedEntries.filter(
      e => e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q),
    )
  }, [searchQuery, sortedEntries])

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedFeedback(label)
    setCopyTarget(null)
    setTimeout(() => setCopiedFeedback(null), 1500)
  }

  const handleLock = async () => {
    await destroyAll()
    onLock()
  }

  const handleSignOutAndLock = async () => {
    await destroyAll()
    await sendSignOut()
    onSignOut()
  }

  const handleEntryClick = useCallback((entry: AllEntry) => {
    setPage({ type: 'entry-detail', entry })
  }, [])

  const handleCopyMenuOpen = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation()
    if (copyTarget?.entryId === entryId) { setCopyTarget(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setCopyTarget({ entryId, menuTop: rect.bottom + 2, menuLeft: Math.max(4, Math.min(rect.right - 140, 216)) })
  }

  const closeCopyMenu = () => setCopyTarget(null)

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Password Manager</h1>
          </div>
          <p style={styles.email}>{email}</p>
          <p style={styles.loadingText}>Decrypting entries...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Password Manager</h1>
          <button onClick={handleLock} style={styles.lockBtn}>Lock</button>
        </div>
        <p style={styles.email}>{email}</p>

        {page.type !== 'entry-detail' && (
          <div style={styles.searchWrap}>
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        {page.type === 'entries-list' && (
          <div>
            <div style={styles.sectionRow}>
              <h2 style={styles.sectionTitle}>Entries ({filteredEntries.length})</h2>
              <button onClick={() => setPage({ type: 'add-entry' })} style={styles.addBtn}>+ Add</button>
            </div>
            {filteredEntries.length === 0
              ? <p style={styles.empty}>{searchQuery ? 'No matching entries' : 'No entries found'}</p>
              : <ul style={styles.list}>
                  {filteredEntries.map(entry => (
                    <li key={entry.id} style={styles.listItem} onClick={() => handleEntryClick(entry)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.entryTitle}>{entry.title}</div>
                        <div style={styles.entrySub}>
                          {entry.username}
                          <span style={styles.vaultTag}>{entry.vaultName}</span>
                        </div>
                      </div>
                      <div style={styles.copyIconWrap} onClick={e => handleCopyMenuOpen(e, entry.id)}>
                        <span style={styles.copyIcon}>📋</span>
                        {copyTarget?.entryId === entry.id && (
                          <div style={{ ...styles.copyMenu, top: copyTarget.menuTop, left: copyTarget.menuLeft }}>
                            <div style={styles.copyMenuItem} onClick={async (ev) => { ev.stopPropagation(); await handleCopy(entry.username, 'Username copied') }}>
                              Copy Username
                            </div>
                            <div style={styles.copyMenuItem} onClick={async (ev) => { ev.stopPropagation(); await handleCopy(entry.password, 'Password copied') }}>
                              Copy Password
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
            }
              {copiedFeedback && <div style={styles.toast}>{copiedFeedback}</div>}
              {copyTarget && <div style={styles.overlay} onClick={closeCopyMenu} />}
          </div>
        )}

        {page.type === 'entry-detail' && (
          <EntryDetail
            entry={page.entry}
            onBack={() => setPage({ type: 'entries-list' })}
          />
        )}

        {page.type === 'add-entry' && (
          <AddEntryForm
            vaults={vaults}
            deks={deksRef.current}
            onSubmit={async (vaultId, data) => {
              const dek = deksRef.current.get(vaultId)
              if (!dek) { setError('Vault not available'); return }
              setError('')
              try {
                const payload = await encryptEntryPayload(data, dek)
                await createEntry(vaultId, payload)
                const d = await decryptEntryPayload(payload, dek)
                if (d) {
                  const vault = vaults.find(v => v.id === vaultId)
                  const entry: AllEntry = { ...d, id: '', vaultId, vaultName: vault?.name ?? '', createdAt: 0, updatedAt: 0 }
                  const entries = await fetchEntries(vaultId)
                  for (const raw of entries) {
                    const dec = await decryptEntryPayload(raw.encryptedPayload, dek)
                    if (dec) {
                      dec.id = raw.id
                      dec.vaultId = raw.vaultId
                      dec.createdAt = raw.createdAt
                      dec.updatedAt = raw.updatedAt
                    }
                  }
                  // Refresh all entries
                  const vaultsData = await fetchVaults(userId)
                  const all: AllEntry[] = []
                  for (const v of vaultsData) {
                    const dk = deksRef.current.get(v.id) ?? await decryptVaultKey(v)
                    if (!dk) continue
                    if (!deksRef.current.has(v.id)) deksRef.current.set(v.id, dk)
                    const entriesData = await fetchEntries(v.id)
                    for (const raw of entriesData) {
                      const dec = await decryptEntryPayload(raw.encryptedPayload, dk)
                      if (dec) {
                        all.push({ ...dec, id: raw.id, vaultId: raw.vaultId, vaultName: v.name, createdAt: raw.createdAt, updatedAt: raw.updatedAt })
                      }
                    }
                  }
                  all.sort((a, b) => a.title.localeCompare(b.title))
                  setAllEntries(all)
                }
                setPage({ type: 'entries-list' })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create entry')
              }
            }}
            onBack={() => setPage({ type: 'entries-list' })}
          />
        )}

        <button onClick={handleSignOutAndLock} style={styles.signOut}>Sign out</button>
      </div>
    </div>
  )
}

function EntryDetail({ entry, onBack }: { entry: DecryptedEntry & { vaultName: string }; onBack: () => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back</button>
      <h2 style={styles.sectionTitle}>{entry.title}</h2>
      <div style={styles.vaultTagInline}>{entry.vaultName}</div>

      <div style={styles.field}>
        <div style={styles.fieldLabel}>Username</div>
        <div style={styles.fieldRow}>
          <input type="text" readOnly value={entry.username} style={styles.fieldValue} />
          <button onClick={() => copy(entry.username, 'Copied')} style={styles.copyBtn}>{copied === 'Copied' ? '✓' : 'Copy'}</button>
        </div>
      </div>

      <div style={styles.field}>
        <div style={styles.fieldLabel}>Password</div>
        <div style={styles.fieldRow}>
          <div style={{ ...styles.fieldRow, flex: 1, gap: 0 }}>
            <input type={showPassword ? 'text' : 'password'} readOnly value={entry.password} style={{ ...styles.fieldValue, borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
            <button onClick={() => setShowPassword(p => !p)} style={{ ...styles.toggleBtn, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>{showPassword ? '🙈' : '👁'}</button>
          </div>
          <button onClick={() => copy(entry.password, 'Copied')} style={styles.copyBtn}>{copied === 'Copied' ? '✓' : 'Copy'}</button>
        </div>
      </div>

      {entry.url && (
        <div style={styles.field}>
          <div style={styles.fieldLabel}>URL</div>
          <div style={styles.fieldRow}>
            <input type="text" readOnly value={entry.url} style={styles.fieldValue} />
            <button onClick={() => copy(entry.url, 'Copied')} style={styles.copyBtn}>{copied === 'Copied' ? '✓' : 'Copy'}</button>
          </div>
        </div>
      )}
      {entry.notes && (
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Notes</div>
          <div style={styles.notesText}>{entry.notes}</div>
        </div>
      )}
    </div>
  )
}

function AddEntryForm({ vaults, deks, onSubmit, onBack }: {
  vaults: VaultRow[]
  deks: Map<string, SecureKey>
  onSubmit: (vaultId: string, data: { title: string; username: string; password: string; url: string; notes: string }) => Promise<void>
  onBack: () => void
}) {
  const [vaultId, setVaultId] = useState(vaults[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!vaultId && vaults.length > 0) setVaultId(vaults[0].id)
  }, [vaults])

  useEffect(() => {
    sendGetActiveTab().then(tab => {
      if (!tab) return
      setUrl(tab.host)
      if (!title) setTitle(tab.title || tab.host)
    })
  }, [])

  const validVaults = vaults.filter(v => deks.has(v.id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !password || !vaultId) return
    if (!deks.has(vaultId)) return
    setSubmitting(true)
    await onSubmit(vaultId, { title, username, password, url, notes })
  }

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back</button>
      <h2 style={styles.sectionTitle}>New Entry</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        {validVaults.length > 1 && (
          <label style={styles.inpBlock}>
            <span style={styles.fieldLabel}>Vault</span>
            <select value={vaultId} onChange={e => setVaultId(e.target.value)} style={styles.inp}>
              {validVaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        )}
        <Inp label="Title" value={title} onChange={setTitle} required />
        <Inp label="Username" value={username} onChange={setUsername} />
        <Inp label="Password" value={password} onChange={setPassword} required type="password" />
        <Inp label="URL" value={url} onChange={setUrl} />
        <Inp label="Notes" value={notes} onChange={setNotes} multiline />
        <button type="submit" disabled={submitting || !title || !vaultId} style={styles.saveBtn}>
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
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 8,
  },
  vaultTag: {
    display: 'inline-block', marginLeft: 6, padding: '0 5px', borderRadius: 3,
    background: '#e8f5e9', color: '#2e7d32', fontSize: 10, fontWeight: 600,
  },
  vaultTagInline: {
    display: 'inline-block', padding: '2px 6px', borderRadius: 3,
    background: '#e8f5e9', color: '#2e7d32', fontSize: 10, fontWeight: 600, marginBottom: 12,
  },
  entryTitle: { fontWeight: 500, color: '#333', fontSize: 13 },
  entrySub: { fontSize: 11, color: '#888', marginTop: 2 },
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 999,
  },
  copyIconWrap: { position: 'relative' as const, cursor: 'pointer', padding: 4 },
  copyIcon: { fontSize: 16, opacity: 0.6 },
  copyMenu: {
    position: 'fixed' as const, background: '#fff', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    border: '1px solid #eee', zIndex: 1000, width: 140, overflow: 'hidden',
  },
  copyMenuItem: {
    padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#333',
    borderBottom: '1px solid #f0f0f0',
  },
  toast: {
    position: 'fixed' as const, bottom: 12, left: '50%', transform: 'translateX(-50%)',
    background: '#333', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 12,
    zIndex: 2000,
  },
  backBtn: { background: 'none', border: 'none', color: '#2d6a4f', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 8 },
  lockBtn: { padding: '4px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 12, cursor: 'pointer' },
  addBtn: { padding: '4px 10px', borderRadius: 4, border: 'none', background: '#2d6a4f', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { padding: '10px 16px', borderRadius: 4, border: 'none', background: '#2d6a4f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 12 },
  signOut: { background: 'none', border: 'none', color: '#bbb', fontSize: 12, cursor: 'pointer', marginTop: 16, display: 'block', width: '100%', textAlign: 'center' },
  empty: { color: '#999', fontSize: 13, fontStyle: 'italic', padding: '8px 0' },
  error: { color: '#d32f2f', fontSize: 12, padding: '8px 0' },
  loadingText: { textAlign: 'center' as const, color: '#999', padding: 20 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  fieldRow: { display: 'flex', gap: 4 },
  fieldValue: {
    flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid #eee',
    fontSize: 13, background: '#f9f9f9', color: '#333', fontFamily: 'monospace',
  },
  toggleBtn: { padding: '6px 8px', border: '1px solid #eee', background: '#fff', color: '#555', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' },
  copyBtn: { padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  notesText: { padding: '6px 8px', fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' as const, background: '#f9f9f9', borderRadius: 4, border: '1px solid #eee' },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  inpBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  inp: { padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, outline: 'none' },
}
