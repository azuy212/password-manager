import React from 'react'
import { sendMessage } from '../messaging'
import { destroyAll } from '../../src/platform/unlock'

interface Props {
  email: string
  onSignOut: () => void
}

export function VaultView({ email, onSignOut }: Props) {
  const handleLock = async () => {
    destroyAll()
    onSignOut()
    await sendMessage({ type: 'SIGN_OUT' })
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Vault Unlocked</h1>
        <p style={styles.email}>{email}</p>
        <div style={styles.placeholder}>
          <p>Password list coming in Phase 6-7</p>
        </div>
        <button onClick={handleLock} style={styles.lockButton}>
          Lock &amp; Sign Out
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: '#1a1a1a',
    background: '#f5f5f5',
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 4px',
    color: '#2d6a4f',
  },
  email: {
    fontSize: 13,
    color: '#555',
    margin: '0 0 16px',
  },
  placeholder: {
    padding: 24,
    background: '#f9f9f9',
    borderRadius: 4,
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
  },
  lockButton: {
    padding: '10px 16px',
    borderRadius: 4,
    border: 'none',
    background: '#d32f2f',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
    width: '100%',
  },
}
