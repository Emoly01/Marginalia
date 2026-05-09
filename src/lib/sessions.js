// Session CRUD helpers
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const sessionsRef = (userId, campaignId) =>
  collection(db, 'users', userId, 'campaigns', campaignId, 'sessions')

export async function listSessions(userId, campaignId) {
  // Sort by date desc, then session number desc as tiebreak
  // (so multiple sessions on the same date order predictably)
  const q = query(
    sessionsRef(userId, campaignId),
    orderBy('date', 'desc'),
    orderBy('sessionNumber', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getSession(userId, campaignId, sessionId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'sessions', sessionId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// Find the next session number for this campaign (max + 1)
export async function getNextSessionNumber(userId, campaignId) {
  const q = query(
    sessionsRef(userId, campaignId),
    orderBy('sessionNumber', 'desc'),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return 1
  const top = snap.docs[0].data().sessionNumber || 0
  return top + 1
}

export async function createSession(userId, campaignId, data = {}) {
  const now = serverTimestamp()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const sessionNumber = data.sessionNumber ?? (await getNextSessionNumber(userId, campaignId))

  const docRef = await addDoc(sessionsRef(userId, campaignId), {
    title: data.title || `Session ${sessionNumber}`,
    sessionNumber,
    date: data.date || today,
    content: data.content || '',
    createdAt: now,
    updatedAt: now,
  })
  return docRef.id
}

export async function updateSession(userId, campaignId, sessionId, data) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'sessions', sessionId)
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteSession(userId, campaignId, sessionId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'sessions', sessionId)
  await deleteDoc(ref)
}
