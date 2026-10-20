// Session CRUD helpers
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { extractMentionIds } from './mentions'
import { deleteSessionLog } from './log'
import { findLiveSession } from './sessionStatus'
import { toast } from './toast'

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

/**
 * Create a session and return its id as soon as the write is queued.
 * Firestore only settles a write once the server acknowledges it, which
 * never happens offline, so waiting would hang "Start session" at a table
 * with no wifi. A write the server later rejects surfaces as a toast.
 *
 * Lifecycle fields (status, startedAt, intention) are only written when
 * given, so ordinary sessions look exactly as they always have.
 */
export async function createSession(userId, campaignId, data = {}) {
  const now = serverTimestamp()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const sessionNumber = data.sessionNumber ?? (await getNextSessionNumber(userId, campaignId))

  const ref = doc(sessionsRef(userId, campaignId))
  const lifecycle = {}
  if (data.status) lifecycle.status = data.status
  if (data.startedAt) lifecycle.startedAt = data.startedAt
  if (data.intention) lifecycle.intention = data.intention

  setDoc(ref, {
    title: data.title || `Session ${sessionNumber}`,
    sessionNumber,
    date: data.date || today,
    content: data.content || '',
    mentionIds: extractMentionIds(data.content || ''),
    ...lifecycle,
    createdAt: now,
    updatedAt: now,
  }).catch((err) => {
    console.error('Session write failed:', err)
    toast('A new session could not be saved.')
  })
  return ref.id
}

/**
 * Start playing: a new live session with tonight's intention. There is only
 * ever one live session per campaign, so an existing one is returned instead.
 */
export async function startSession(userId, campaignId, { intention = '' } = {}) {
  const live = findLiveSession(await listSessions(userId, campaignId))
  if (live) return live.id
  return createSession(userId, campaignId, {
    status: 'live',
    startedAt: serverTimestamp(),
    intention: intention.trim(),
  })
}

/** Stop playing; Inking comes next. Not awaited by the table, for the same reason. */
export function endSession(userId, campaignId, sessionId) {
  return updateSession(userId, campaignId, sessionId, { status: 'ended', endedAt: serverTimestamp() })
}

/** onSnapshot on a campaign's sessions, most recent first. Returns the unsubscribe. */
export function subscribeSessions(userId, campaignId, cb, onError) {
  const q = query(sessionsRef(userId, campaignId), orderBy('date', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      sessions.sort((a, b) => (a.date !== b.date ? 0 : (b.sessionNumber || 0) - (a.sessionNumber || 0)))
      cb(sessions)
    },
    onError
  )
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
  // Log entries first: if this fails the session is still there to retry.
  await deleteSessionLog(userId, campaignId, sessionId)
  await deleteDoc(ref)
}
