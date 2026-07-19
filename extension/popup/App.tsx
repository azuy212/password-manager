import React, { useCallback, useEffect, useState } from 'react'
import { sendMessage } from './messaging'
import { SignInView } from './views/SignInView'
import { UnlockView } from './views/UnlockView'
import { VaultView } from './views/VaultView'

type View =
  | { type: 'loading' }
  | { type: 'sign-in' }
  | { type: 'unlock'; userId: string; email: string }
  | { type: 'vault'; userId: string; email: string }

export function App() {
  const [view, setView] = useState<View>({ type: 'loading' })
  const [lastSession, setLastSession] = useState<{ userId: string; email: string } | null>(null)

  useEffect(() => {
    sendMessage<{ session: { userId: string; email: string } | null }>({ type: 'GET_SESSION' })
      .then((res) => {
        if (res.session) {
          setLastSession(res.session)
          setView({ type: 'unlock', userId: res.session.userId, email: res.session.email })
        } else {
          setView({ type: 'sign-in' })
        }
      })
      .catch(() => setView({ type: 'sign-in' }))
  }, [])

  const handleSignInSuccess = useCallback((userId: string, email: string) => {
    setLastSession({ userId, email })
    setView({ type: 'unlock', userId, email })
  }, [])

  const handleUnlocked = useCallback((userId: string, email: string) => {
    setLastSession({ userId, email })
    setView({ type: 'vault', userId, email })
  }, [])

  const handleSignOut = useCallback(() => {
    setView({ type: 'sign-in' })
  }, [])

  const handleLock = useCallback(() => {
    if (lastSession) {
      setView({ type: 'unlock', ...lastSession })
    } else {
      setView({ type: 'sign-in' })
    }
  }, [lastSession])

  switch (view.type) {
    case 'loading':
      return <div style={styles.container}>Loading...</div>

    case 'sign-in':
      return <SignInView onSuccess={handleSignInSuccess} />

    case 'unlock':
      return (
        <UnlockView
          userId={view.userId}
          email={view.email}
          onUnlocked={() => handleUnlocked(view.userId, view.email)}
          onSignOut={handleSignOut}
        />
      )

    case 'vault':
      return (
        <VaultView
          email={view.email}
          userId={view.userId}
          onSignOut={handleSignOut}
          onLock={handleLock}
        />
      )

    default:
      return <div style={styles.container}>Unknown state</div>
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: '#1a1a1a',
  },
}
