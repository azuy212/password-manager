import React, { useState } from 'react'
import { sendMessage } from '../messaging'
import { unlockVault } from '../../src/platform/unlock'

interface Props {
  userId: string
  email: string
  onUnlocked: () => void
  onSignOut: () => void
}

export function UnlockView({ userId, email, onUnlocked, onSignOut }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError('Master password is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await unlockVault(userId, password)
      if ('success' in result) {
        onUnlocked()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to unlock vault')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await sendMessage({ type: 'SIGN_OUT' })
    onSignOut()
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Unlock Vault</h1>
        <p style={styles.email}>Signed in as {email}</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Master Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter master password"
              disabled={loading}
              autoFocus
            />
          </label>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
        <button onClick={handleSignOut} style={styles.signOut}>
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: '#555',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 4,
    border: '1px solid #ddd',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '10px 16px',
    borderRadius: 4,
    border: 'none',
    background: '#2d6a4f',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
  error: {
    color: '#d32f2f',
    fontSize: 12,
    padding: '4px 0',
  },
  signOut: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 12,
    cursor: 'pointer',
    marginTop: 16,
    display: 'block',
    width: '100%',
    textAlign: 'center',
  },
}
