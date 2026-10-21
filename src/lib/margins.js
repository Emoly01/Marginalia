// Margins (inbox) CRUD helpers
// Avoid composite indexes by filtering archived state client-side
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const marginsRef = (userId, campaignId) =>
  collection(db, 'users', userId, 'campaigns', campaignId, 'margins')

/**
 * Fetch all margins for a campaign, sorted newest first.
 * Caller filters by archived flag.
 */
export async function listAllMargins(userId, campaignId) {
  const q = query(marginsRef(userId, campaignId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createMargin(userId, campaignId, text) {
  const docRef = await addDoc(marginsRef(userId, campaignId), {
    text: text.trim(),
    archived: false,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

/**
 * Add a margin without waiting for the server: the id comes back at once
 * and the write is queued (offline-safe). Used by Inking's "Keep for later".
 */
export function addMargin(userId, campaignId, text, extra = {}) {
  const ref = doc(marginsRef(userId, campaignId))
  const done = setDoc(ref, { text: String(text).trim(), archived: false, createdAt: serverTimestamp(), ...extra })
  return { id: ref.id, done }
}

export async function archiveMargin(userId, campaignId, marginId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'margins', marginId)
  await updateDoc(ref, {
    archived: true,
    archivedAt: serverTimestamp(),
  })
}

export async function restoreMargin(userId, campaignId, marginId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'margins', marginId)
  await updateDoc(ref, {
    archived: false,
    archivedAt: null,
  })
}

export async function deleteMargin(userId, campaignId, marginId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId, 'margins', marginId)
  await deleteDoc(ref)
}
