// Campaign CRUD helpers
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

export async function deleteCampaign(userId, campaignId) {
  const ref = doc(db, 'users', userId, 'campaigns', campaignId)
  await deleteDoc(ref)
}
