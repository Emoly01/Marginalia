// Margins (inbox) CRUD helpers
// Avoid composite indexes by filtering archived state client-side
import {
  collection,
  doc,
  addDoc,
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
