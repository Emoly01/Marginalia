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
  getCountFromServer,
  limit,
} from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_PALETTE_ID } from './palette'
import { excerptFrom } from './text'

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
    palette: data.palette || DEFAULT_PALETTE_ID,
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

/**
 * Counts and a one-line excerpt for a campaign, for the home grid and the
 * sidebar. Excerpt comes from the most recent session's opening prose.
 *
 * Counting via the aggregation endpoint keeps this cheap, but that endpoint
 * needs the network — offline we fall back to counting whatever the local
 * cache holds rather than showing nothing.
 */
export async function getCampaignSummary(userId, campaignId) {
  const campaignDoc = doc(db, 'users', userId, 'campaigns', campaignId)
  const sessions = collection(campaignDoc, 'sessions')
  const entities = collection(campaignDoc, 'entities')

  const [sessionCount, entityCount, recent] = await Promise.all([
    countDocs(sessions),
    countDocs(entities),
    getDocs(query(sessions, orderBy('date', 'desc'), limit(RECENT_SESSIONS))).catch(() => null),
  ])

  return {
    sessions: sessionCount,
    entities: entityCount,
    excerpt: firstExcerpt(recent),
  }
}

// A freshly created session is usually still blank, so walk back until we
// find one with something written in it rather than showing an empty card.
const RECENT_SESSIONS = 5

function firstExcerpt(snap) {
  for (const d of snap?.docs || []) {
    const excerpt = excerptFrom(d.data().content)
    if (excerpt) return excerpt
  }
  return ''
}

async function countDocs(ref) {
  try {
    const snap = await getCountFromServer(ref)
    return snap.data().count
  } catch {
    try {
      return (await getDocs(ref)).size
    } catch {
      return 0
    }
  }
}
