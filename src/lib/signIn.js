// Google sign-in: a popup first, a full-page redirect when the popup can't
// open (some installed-app / in-app-browser setups block it).
//
// Redirect sign-in only works on browsers that partition third-party
// storage (Chrome, Safari, Firefox) when Firebase's auth pages are served
// from the app's own domain. vercel.json proxies /__/auth/* to
// firebaseapp.com; setting VITE_FIREBASE_AUTH_DOMAIN to the app's domain
// switches to it (see README → "Sign-in inside the installed app").
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'

// Errors that mean "a popup can't work here", as opposed to "you closed it".
export const POPUP_UNAVAILABLE = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]

export async function signInWithGoogle(auth, provider) {
  try {
    return await signInWithPopup(auth, provider)
  } catch (err) {
    if (!POPUP_UNAVAILABLE.includes(err?.code)) throw err
    console.warn('Popup sign-in unavailable, redirecting:', err.code)
    await signInWithRedirect(auth, provider)
    return null // the page navigates away
  }
}

/** Surface a failed redirect sign-in on the way back; resolves null otherwise. */
export function finishRedirectSignIn(auth) {
  return getRedirectResult(auth)
}
