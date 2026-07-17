// Firebase configuration for Marginalia
// Project: marginalia-696c6

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyC92ZZvnXtrPs--bAKy_wOAcOP_Lj6zLGk",
  authDomain: "marginalia-696c6.firebaseapp.com",
  projectId: "marginalia-696c6",
  storageBucket: "marginalia-696c6.firebasestorage.app",
  messagingSenderId: "423222422415",
  appId: "1:423222422415:web:202c5eb53755e6088ab9fa"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Offline persistence: reads served from IndexedDB when the network is
// down, writes queued and synced when it returns — spotty table wifi safe.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
