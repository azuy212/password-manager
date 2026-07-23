import React, { useState } from 'react'
import { sendSignIn } from '../messaging'

interface Props {
  onSuccess: (userId: string, email: string) => void
}

export function SignInView({ onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Email and password are required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await sendSignIn(email.trim(), password)
      if (res.success && res.userId) {
        onSuccess(res.userId, res.email ?? email.trim())
      } else {
        setError(res.error ?? 'Sign in failed')
      }
    } catch {
      setError('Failed to connect to extension')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Clave</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="your@email.com"
              disabled={loading}
              autoFocus
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Master password"
              disabled={loading}
            />
          </label>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
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
    fontSize: 20,
    fontWeight: 600,
    margin: '0 0 20px',
    textAlign: 'center' as const,
    color: '#2d6a4f',
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
}
