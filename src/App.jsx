import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import Layout from './components/Layout'
import SignIn from './components/SignIn'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Sign-in error:', err)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--ink-muted)',
        fontStyle: 'italic'
      }}>
        opening the archive…
      </div>
    )
  }

  if (!user) {
    return <SignIn onSignIn={handleSignIn} />
  }

  return <Layout user={user} onSignOut={handleSignOut} />
}
