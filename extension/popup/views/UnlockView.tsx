import React from 'react'

interface Props {
  userId: string
  email: string
}

export function UnlockView({ userId, email }: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Unlock Vault</h1>
        <p style={styles.email}>Signed in as {email}</p>
        <p style={styles.hint}>Unlock flow coming in Phase 5</p>
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
    margin: '0 0 12px',
    color: '#2d6a4f',
  },
  email: {
    fontSize: 13,
    color: '#555',
    margin: '0 0 8px',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
}
