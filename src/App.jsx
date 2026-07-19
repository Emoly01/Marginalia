import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import Layout from './components/Layout'
import SignIn from './components/SignIn'
import Toasts from './components/Toasts'
import { toast } from './lib/toast'

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
      toast('Sign-in failed — try again.')
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

  const layout = <Layout user={user} onSignOut={handleSignOut} />

  return (
    <>
      <Toasts />
      {!user ? (
        <SignIn onSignIn={handleSignIn} />
      ) : (
        <Routes>
          <Route path="/" element={layout} />
          <Route path="/campaigns/:campaignId" element={layout} />
          <Route path="/campaigns/:campaignId/sessions/:sessionId" element={layout} />
          <Route path="/campaigns/:campaignId/entities/:entityId" element={layout} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  )
}
