import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CopyIcon, ChevronLeftIcon, CheckIcon, EyeIcon, EyeOffIcon } from './Icons'
import { sendSignOut, sendGetActiveTab } from '../messaging'
import { destroyAll } from '../../src/platform/unlock'
import { fetchVaults, fetchEntries, createEntry } from '../../src/repository/vaultRepository'
import { decryptVaultKey, decryptEntryPayload, encryptEntryPayload } from '../../src/repository/vaultCrypto'
import { SecureKey } from '@/core/crypto/SecureKey'
import type { Vault as VaultRow } from '../../src/repository/vaultRepository'
import type { DecryptedEntry } from '../../src/repository/vaultCrypto'
import './styles.css'

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
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    feedbackTimeoutRef.current = setTimeout(() => setCopiedFeedback(null), 1500)
  }

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    }
  }, [])

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
      <div className="wrapper">
        <div className="card">
          <div className="header">
            <h1 className="title">Password Manager</h1>
          </div>
          <p className="email">{email}</p>
          <p className="loading-text">Decrypting entries...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="wrapper">
      <div className="card">
        <div className="header">
          <h1 className="title">Password Manager</h1>
          <button onClick={handleLock} className="lock-btn">Lock</button>
        </div>
        <p className="email">{email}</p>

        {page.type !== 'entry-detail' && (
          <div className="search-wrap">
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {page.type === 'entries-list' && (
          <div>
            <div className="section-row">
              <h2 className="section-title">Entries ({filteredEntries.length})</h2>
              <button onClick={() => setPage({ type: 'add-entry' })} className="add-btn">+ Add</button>
            </div>
            {filteredEntries.length === 0
              ? <p className="empty">{searchQuery ? 'No matching entries' : 'No entries found'}</p>
              : <ul className="list">
                  {filteredEntries.map(entry => (
                    <li key={entry.id} className="list-item" onClick={() => handleEntryClick(entry)}>
                      <div className="entry-main">
                        <div className="entry-title">{entry.title}</div>
                        <div className="entry-sub">
                          {entry.username}
                          <span className="vault-tag">{entry.vaultName}</span>
                        </div>
                      </div>
                      <div className="copy-icon-wrap" onClick={e => handleCopyMenuOpen(e, entry.id)}>
                        <span><CopyIcon /></span>
                        {copyTarget?.entryId === entry.id && (
                          <div className="copy-menu" style={{ top: copyTarget.menuTop, left: copyTarget.menuLeft }}>
                            <div className="copy-menu-item" onClick={async (ev) => { ev.stopPropagation(); await handleCopy(entry.username, 'Username copied') }}>
                              Copy Username
                            </div>
                            <div className="copy-menu-item" onClick={async (ev) => { ev.stopPropagation(); await handleCopy(entry.password, 'Password copied') }}>
                              Copy Password
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
            }
              {copiedFeedback && <div className="toast">{copiedFeedback}</div>}
              {copyTarget && <div className="overlay" onClick={closeCopyMenu} />}
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
                setPage({ type: 'entries-list' })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create entry')
              }
            }}
            onBack={() => setPage({ type: 'entries-list' })}
          />
        )}

        <button onClick={handleSignOutAndLock} className="sign-out">Sign out</button>
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
      <button onClick={onBack} className="back-btn"><ChevronLeftIcon className="icon-middle-right" /> Back</button>
      <h2 className="section-title">{entry.title}</h2>
      <div className="vault-tag-inline">{entry.vaultName}</div>

      <div className="field">
        <div className="field-label">Username</div>
        <div className="field-row">
          <input type="text" readOnly value={entry.username} className="field-value" />
          <button onClick={() => copy(entry.username, 'Username')} className="copy-btn">{copied === 'Username' ? <CheckIcon className="icon-middle" /> : 'Copy'}</button>
        </div>
      </div>

      <div className="field">
        <div className="field-label">Password</div>
        <div className="field-row">
          <div className="field-row field-row--stretch">
            <input type={showPassword ? 'text' : 'password'} readOnly value={entry.password} className="field-value field-value--no-right-radius" />
            <button onClick={() => setShowPassword(p => !p)} className="toggle-btn toggle-btn--no-left-radius">{showPassword ? <EyeOffIcon className="icon-middle" /> : <EyeIcon className="icon-middle" />}</button>
          </div>
          <button onClick={() => copy(entry.password, 'Password')} className="copy-btn">{copied === 'Password' ? <CheckIcon className="icon-middle" /> : 'Copy'}</button>
        </div>
      </div>

      {entry.url && (
        <div className="field">
          <div className="field-label">URL</div>
          <div className="field-row">
            <input type="text" readOnly value={entry.url} className="field-value" />
            <button onClick={() => copy(entry.url, 'URL')} className="copy-btn">{copied === 'URL' ? <CheckIcon className="icon-middle" /> : 'Copy'}</button>
          </div>
        </div>
      )}
      {entry.notes && (
        <div className="field">
          <div className="field-label">Notes</div>
          <div className="notes-text">{entry.notes}</div>
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
      <button onClick={onBack} className="back-btn"><ChevronLeftIcon className="icon-middle-right" /> Back</button>
      <h2 className="section-title">New Entry</h2>
      {validVaults.length === 0 && (
        <p className="empty">No vaults available. Create a vault on your mobile device first.</p>
      )}
      <form onSubmit={handleSubmit} className="form">
        {validVaults.length > 1 && (
          <label className="inp-block">
            <span className="field-label">Vault</span>
            <select value={vaultId} onChange={e => setVaultId(e.target.value)} className="inp">
              {validVaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        )}
        <Inp label="Title" value={title} onChange={setTitle} required />
        <Inp label="Username" value={username} onChange={setUsername} />
        <Inp label="Password" value={password} onChange={setPassword} required type="password" />
        <Inp label="URL" value={url} onChange={setUrl} />
        <Inp label="Notes" value={notes} onChange={setNotes} multiline />
        <button type="submit" className="save-btn" disabled={submitting || !title || !vaultId || validVaults.length === 0}>
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
    <label className="inp-block">
      <span className="field-label">{label}</span>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} className="inp inp--textarea" />
        : <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} required={required} className="inp" />
      }
    </label>
  )
}
