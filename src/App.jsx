import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import Layout from './components/Layout'
import SignIn from './components/SignIn'
import Toasts from './components/Toasts'
import TableView from './components/TableView'
import SearchPalette from './components/SearchPalette'
import UpdatePrompt from './components/UpdatePrompt'
import { signInWithGoogle, finishRedirectSignIn } from './lib/signIn'
import { useInk } from './lib/useInk'
import { toast } from './lib/toast'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Coming back from a redirect sign-in: report it if it failed.
  useEffect(() => {
    finishRedirectSignIn(auth).catch((err) => {
      console.error('Redirect sign-in error:', err)
      toast('Sign-in failed — try again.')
    })
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    try {
      await signInWithGoogle(auth, googleProvider)
    } catch (err) {
      console.error('Sign-in error:', err)
      toast('Sign-in failed — try again.')
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  if (loading) return <Opening />

  const layout = <Layout user={user} onSignOut={handleSignOut} />

  return (
    <>
      <Toasts />
      <UpdatePrompt />
      {user && <SearchPalette userId={user.uid} />}
      {!user ? (
        <SignIn onSignIn={handleSignIn} />
      ) : (
        <Routes>
          <Route path="/" element={layout} />
          <Route path="/campaigns/:campaignId" element={layout} />
          <Route path="/campaigns/:campaignId/table" element={<TableView user={user} />} />
          <Route path="/campaigns/:campaignId/sessions/:sessionId" element={layout} />
          <Route path="/campaigns/:campaignId/sessions/:sessionId/ink" element={layout} />
          <Route path="/campaigns/:campaignId/entities/:entityId" element={layout} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  )
}

// Before anything has loaded: the frame, in this device's ground.
function Opening() {
  useInk(null, 'desk')
  return (
    <div className="frame app">
      <div className="frame-surface">
        <div className="waiting">opening the archive…</div>
      </div>
    </div>
  )
}
