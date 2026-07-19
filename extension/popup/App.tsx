import React, { useEffect, useReducer } from 'react'
import { sendGetSession } from './messaging'
import { SignInView } from './views/SignInView'
import { UnlockView } from './views/UnlockView'
import { VaultView } from './views/VaultView'

type View =
  | { type: 'loading' }
  | { type: 'sign-in' }
  | { type: 'unlock'; userId: string; email: string }
  | { type: 'vault'; userId: string; email: string }

type Action =
  | { type: 'SESSION_FOUND'; userId: string; email: string }
  | { type: 'NO_SESSION' }
  | { type: 'SIGNED_IN'; userId: string; email: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'LOCKED'; userId: string; email: string }

function reducer(_state: View, action: Action): View {
  switch (action.type) {
    case 'SESSION_FOUND':
    case 'SIGNED_IN':
      return { type: 'unlock', userId: action.userId, email: action.email }
    case 'NO_SESSION':
    case 'SIGNED_OUT':
      return { type: 'sign-in' }
    case 'LOCKED':
      return { type: 'unlock', userId: action.userId, email: action.email }
  }
}

export function App() {
  const [view, dispatch] = useReducer(reducer, { type: 'loading' } satisfies View)

  useEffect(() => {
    sendGetSession()
      .then((res) => {
        if (res.session) {
          dispatch({ type: 'SESSION_FOUND', userId: res.session.userId, email: res.session.email })
        } else {
          dispatch({ type: 'NO_SESSION' })
        }
      })
      .catch(() => dispatch({ type: 'NO_SESSION' }))
  }, [])

  switch (view.type) {
    case 'loading':
      return <div style={styles.container}>Loading...</div>

    case 'sign-in':
      return (
        <SignInView
          onSuccess={(userId, email) => dispatch({ type: 'SIGNED_IN', userId, email })}
        />
      )

    case 'unlock':
      return (
        <UnlockView
          userId={view.userId}
          email={view.email}
          onUnlocked={() => dispatch({ type: 'SIGNED_IN', userId: view.userId, email: view.email })}
          onSignOut={() => dispatch({ type: 'SIGNED_OUT' })}
        />
      )

    case 'vault':
      return (
        <VaultView
          email={view.email}
          userId={view.userId}
          onSignOut={() => dispatch({ type: 'SIGNED_OUT' })}
          onLock={() => dispatch({ type: 'LOCKED', userId: view.userId, email: view.email })}
        />
      )
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
