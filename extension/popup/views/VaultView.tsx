import React, { useEffect, useState } from 'react'
import { sendMessage } from '../messaging'
import { destroyAll } from '../../src/platform/unlock'
import { fetchVaults, fetchEntries } from '../../src/repository/vaultRepository'
import type { Vault, VaultEntry } from '../../src/repository/vaultRepository'

interface Props {
  email: string
  userId: string
  onSignOut: () => void
  onLock: () => void
}

export function VaultView({ email, userId, onSignOut, onLock }: Props) {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVaults(userId)
      .then(setVaults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!activeVaultId) {
      setEntries([])
      return
    }
    fetchEntries(activeVaultId)
      .then(setEntries)
      .catch((e) => setError(e.message))
  }, [activeVaultId])

  const handleLock = async () => {
    destroyAll()
    onLock()
  }

  const handleSignOutAndLock = async () => {
    destroyAll()
    await sendMessage({ type: 'SIGN_OUT' })
    onSignOut()
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loadingText}>Loading vaults...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Password Manager</h1>
          <button onClick={handleLock} style={styles.lockButton}>Lock</button>
        </div>
        <p style={styles.email}>{email}</p>

        {error && <div style={styles.error}>{error}</div>}

        {!activeVaultId && (
          <div>
            <h2 style={styles.sectionTitle}>
              Vaults {vaults.length > 0 && `(${vaults.length})`}
            </h2>
            {vaults.length === 0 ? (
              <p style={styles.empty}>No vaults found</p>
            ) : (
              <ul style={styles.list}>
                {vaults.map((v) => (
                  <li
                    key={v.id}
                    style={styles.listItem}
                    onClick={() => setActiveVaultId(v.id)}
                  >
                    <span style={styles.vaultName}>{v.name}</span>
                    <span style={styles.chevron}>→</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeVaultId && (
          <div>
            <button onClick={() => setActiveVaultId(null)} style={styles.backButton}>
              ← Back
            </button>
            <h2 style={styles.sectionTitle}>
              Entries {entries.length > 0 && `(${entries.length})`}
            </h2>
            {entries.length === 0 ? (
              <p style={styles.empty}>No entries found</p>
            ) : (
              <ul style={styles.list}>
                {entries.map((e) => (
                  <li key={e.id} style={styles.listItem}>
                    <span style={styles.entryId}>
                      Entry {e.id.slice(0, 8)}...
                    </span>
                    <span style={styles.encryptedBadge}>encrypted</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button onClick={handleSignOutAndLock} style={styles.signOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 300,
    maxHeight: 500,
    overflowY: 'auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: '#1a1a1a',
    background: '#f5f5f5',
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: 20,
    margin: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    color: '#2d6a4f',
  },
  email: {
    fontSize: 12,
    color: '#888',
    margin: '0 0 12px',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: '12px 0 8px',
    color: '#333',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  vaultName: {
    fontWeight: 500,
    color: '#2d6a4f',
  },
  chevron: {
    color: '#ccc',
    fontSize: 16,
  },
  entryId: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  encryptedBadge: {
    background: '#fff3e0',
    color: '#e65100',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 3,
    fontWeight: 500,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#2d6a4f',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 4,
  },
  lockButton: {
    padding: '4px 12px',
    borderRadius: 4,
    border: '1px solid #ddd',
    background: '#fff',
    color: '#666',
    fontSize: 12,
    cursor: 'pointer',
  },
  signOut: {
    background: 'none',
    border: 'none',
    color: '#bbb',
    fontSize: 12,
    cursor: 'pointer',
    marginTop: 16,
    display: 'block',
    width: '100%',
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center' as const,
    color: '#999',
    padding: 40,
  },
  empty: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
    padding: '8px 0',
  },
  error: {
    color: '#d32f2f',
    fontSize: 12,
    padding: '8px 0',
  },
}
