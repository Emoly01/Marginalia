// Character (PC dossier) Firestore helpers
// One character per campaign — stored as a singleton doc at /campaigns/{id}/character/main
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const characterRef = (userId, campaignId) =>
  doc(db, 'users', userId, 'campaigns', campaignId, 'character', 'main')

export async function getCharacter(userId, campaignId) {
  const snap = await getDoc(characterRef(userId, campaignId))
  if (!snap.exists()) return null
  return snap.data()
}

export async function saveCharacter(userId, campaignId, data) {
  await setDoc(
    characterRef(userId, campaignId),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

// Default empty character shape
export function emptyCharacter() {
  return {
    name: '',
    pronouns: '',
    class: '',
    ancestry: '',
    level: 1,
    background: '',
    status: 'alive',
    personality: '',
    backstory: '',
    knowledge: '',
    knowledgeOOC: '',
    vibes: '',
    goals: '',
    items: '',
    relationships: [], // array of { id, name, type, status, notes }
  }
}

// Relationship constants
export const RELATIONSHIP_TYPES = [
  'friend',
  'family',
  'mentor',
  'rival',
  'lover',
  'enemy',
  'acquaintance',
  'complicated',
]

export const RELATIONSHIP_STATUSES = [
  { value: 'trusts-deeply', label: 'trusts deeply', color: '#8a9a7b' },
  { value: 'trusts', label: 'trusts', color: '#a4b894' },
  { value: 'neutral', label: 'neutral', color: '#a39d8f' },
  { value: 'wary', label: 'wary', color: '#c9a961' },
  { value: 'hostile', label: 'hostile', color: '#b85450' },
]

export const CHARACTER_STATUSES = ['alive', 'dead', 'retired', 'missing', 'other']
