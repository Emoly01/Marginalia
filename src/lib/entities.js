// Entity CRUD helpers
// Entities = NPCs, Locations, Threads, Items, Factions — per campaign
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
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'

const entitiesRef = (userId, campaignId) =>
  collection(db, 'users', userId, 'campaigns', campaignId, 'entities')

const entityDoc = (userId, campaignId, entityId) =>
  doc(db, 'users', userId, 'campaigns', campaignId, 'entities', entityId)

export const ENTITY_TYPES = [
  { value: 'npc', label: 'NPC', color: '#8a9a7b' },
  { value: 'location', label: 'Location', color: '#9b8aa4' },
  { value: 'thread', label: 'Thread', color: '#b88654' },
  { value: 'item', label: 'Item', color: '#c9a961' },
  { value: 'faction', label: 'Faction', color: '#7a8fa4' },
]

export function entityTypeInfo(type) {
  return ENTITY_TYPES.find((t) => t.value === type) || ENTITY_TYPES[0]
}

export async function listEntities(userId, campaignId) {
  const q = query(entitiesRef(userId, campaignId), orderBy('name'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getEntity(userId, campaignId, entityId) {
  const snap = await getDoc(entityDoc(userId, campaignId, entityId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function createEntity(userId, campaignId, data) {
  const now = serverTimestamp()
  const docRef = await addDoc(entitiesRef(userId, campaignId), {
    name: (data.name || 'Unnamed').trim(),
    type: data.type || 'npc',
    notes: data.notes || '',
    aliases: data.aliases || [],
    connections: data.connections || [], // array of entity IDs
    createdAt: now,
    updatedAt: now,
  })
  return docRef.id
}

export async function updateEntity(userId, campaignId, entityId, data) {
  await updateDoc(entityDoc(userId, campaignId, entityId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteEntity(userId, campaignId, entityId) {
  // Clean up: remove this entity from all other entities' connections
  const all = await listEntities(userId, campaignId)
  const connectedTo = all.filter(
    (e) => e.id !== entityId && (e.connections || []).includes(entityId)
  )
  await Promise.all(
    connectedTo.map((e) =>
      updateDoc(entityDoc(userId, campaignId, e.id), {
        connections: arrayRemove(entityId),
      })
    )
  )
  await deleteDoc(entityDoc(userId, campaignId, entityId))
}

/**
 * Link two entities bidirectionally.
 */
export async function connectEntities(userId, campaignId, idA, idB) {
  await Promise.all([
    updateDoc(entityDoc(userId, campaignId, idA), {
      connections: arrayUnion(idB),
    }),
    updateDoc(entityDoc(userId, campaignId, idB), {
      connections: arrayUnion(idA),
    }),
  ])
}

/**
 * Unlink two entities bidirectionally.
 */
export async function disconnectEntities(userId, campaignId, idA, idB) {
  await Promise.all([
    updateDoc(entityDoc(userId, campaignId, idA), {
      connections: arrayRemove(idB),
    }),
    updateDoc(entityDoc(userId, campaignId, idB), {
      connections: arrayRemove(idA),
    }),
  ])
}
