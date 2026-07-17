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
import { extractMentionIds } from './mentions'

const sessionsRef = (userId, campaignId) =>
  collection(db, 'users', userId, 'campaigns', campaignId, 'sessions')

export async function listSessions(userId, campaignId) {
  // Use a simple single-field query (no composite index needed),
  // then tiebreak by session number client-side.
  const q = query(sessionsRef(userId, campaignId), orderBy('date', 'desc'))
  const snap = await getDocs(q)
  const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  // Stable secondary sort: same date → higher session number first
  sessions.sort((a, b) => {
    if (a.date !== b.date) return 0 // already sorted by Firestore
    return (b.sessionNumber || 0) - (a.sessionNumber || 0)
  })
  return sessions
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
    mentionIds: extractMentionIds(data.content || ''),
    createdAt: now,
    updatedAt: now,
  })
  return docRef.id
}

export async function updateSession(userId, campaignId, sessionId, data) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'sessions', sessionId)
  const patch = { ...data, updatedAt: serverTimestamp() }
  // Keep the denormalized mention index in sync whenever content changes
  if (data.content !== undefined) {
    patch.mentionIds = extractMentionIds(data.content)
  }
  await updateDoc(ref, patch)
}

export async function deleteSession(userId, campaignId, sessionId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'sessions', sessionId)
  await deleteDoc(ref)
}
