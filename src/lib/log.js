// Live session log: one campaign-level collection, campaigns/{cid}/log,
// each entry tagged with its sessionId. Queried by sessionId alone and
// sorted client-side by clientAt, so no composite index and offline
// entries keep the order they were typed in.
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export const LOG_MARKS = ['note', 'important', 'quote', 'npc', 'mystery', 'loot', 'auto', 'milestone']

const logRef = (userId, campaignId) =>
  collection(db, 'users', userId, 'campaigns', campaignId, 'log')

/**
 * A new log entry's ref and data, for callers that write it in a batch.
 */
export function newLogEntry(userId, campaignId, { sessionId, text, mark = 'note', auto = null, entityId = null }) {
  const ref = doc(logRef(userId, campaignId))
  return {
    ref,
    data: {
      sessionId,
      text: String(text ?? '').trim(),
      mark,
      auto,
      entityId,
      clientAt: Date.now(),
      createdAt: serverTimestamp(),
      inked: false,
      inkedAs: null,
    },
  }
}

/**
 * Add an entry. The id is known straight away; the write itself is queued
 * by Firestore when offline, so callers at the table shouldn't await it —
 * `done` is there for those that want to know.
 */
export function addLogEntry(userId, campaignId, entry) {
  const { ref, data } = newLogEntry(userId, campaignId, entry)
  return { id: ref.id, done: setDoc(ref, data) }
}

export function updateLogEntry(userId, campaignId, entryId, patch) {
  return updateDoc(doc(logRef(userId, campaignId), entryId), patch)
}

export function deleteLogEntry(userId, campaignId, entryId) {
  return deleteDoc(doc(logRef(userId, campaignId), entryId))
}

const byClientAt = (a, b) => (a.clientAt ?? 0) - (b.clientAt ?? 0)

/** onSnapshot on one session's entries, oldest first. Returns the unsubscribe. */
export function subscribeSessionLog(userId, campaignId, sessionId, cb, onError) {
  const q = query(logRef(userId, campaignId), where('sessionId', '==', sessionId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byClientAt)), onError)
}

/** onSnapshot on a whole campaign's log (for counts on the campaign home). */
export function subscribeCampaignLog(userId, campaignId, cb, onError) {
  return onSnapshot(logRef(userId, campaignId), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export async function listSessionLog(userId, campaignId, sessionId) {
  const snap = await getDocs(query(logRef(userId, campaignId), where('sessionId', '==', sessionId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byClientAt)
}

export async function deleteSessionLog(userId, campaignId, sessionId) {
  const snap = await getDocs(query(logRef(userId, campaignId), where('sessionId', '==', sessionId)))
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}
