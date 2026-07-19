// Campaign CRUD helpers
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

const campaignsRef = (userId) =>
  collection(db, 'users', userId, 'campaigns')

export async function listCampaigns(userId) {
  const q = query(campaignsRef(userId), orderBy('lastActiveAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createCampaign(userId, data) {
  const now = serverTimestamp()
  const docRef = await addDoc(campaignsRef(userId), {
    name: data.name || 'Untitled Campaign',
    shortName: data.shortName || data.name || 'Untitled',
    system: data.system || '',
    dmName: data.dmName || '',
    characterName: data.characterName || '',
    characterClass: data.characterClass || '',
    color: data.color || '#c9a961',
    status: data.status || 'active',
    theme: data.theme || 'parchment',
    createdAt: now,
    lastActiveAt: now,
  })
  return docRef.id
}

export async function updateCampaign(userId, campaignId, data) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId)
  await updateDoc(ref, {
    ...data,
    lastActiveAt: serverTimestamp(),
  })
}

// Firestore doesn't cascade-delete subcollections, so gather every doc
// under the campaign and delete them along with the campaign itself.
const SUBCOLLECTIONS = ['sessions', 'entities', 'margins', 'character']

export async function deleteCampaign(userId, campaignId) {
  const campaignDoc = doc(db, 'users', userId, 'campaigns', campaignId)

  const refs = []
  for (const name of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(campaignDoc, name))
    snap.forEach((d) => refs.push(d.ref))
  }
  // Campaign doc goes last: if a batch fails midway, the campaign stays
  // visible instead of silently stranding its remaining subcollection docs.
  refs.push(campaignDoc)

  // Batches cap at 500 operations
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db)
    refs.slice(i, i + 500).forEach((r) => batch.delete(r))
    await batch.commit()
  }
}
