// Firestore helpers for the imported character sheet and live play state.
// All three docs sit in the campaign's `character` subcollection next to the
// dossier (`character/main`), so the campaign delete cascade covers them:
//   character/sheet — the last import (parsed data + raw fields)
//   character/play  — HP, slots, resources… kept apart so re-imports never clobber it
//   character/notes — my own notes per spell, keyed by spellKey()
import { doc, getDoc, setDoc, updateDoc, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { newEntity } from './entities'
import { newLogEntry } from './log'

const characterDoc = (userId, campaignId, id) =>
  doc(db, 'users', userId, 'campaigns', campaignId, 'character', id)

export async function getSheetDoc(userId, campaignId) {
  const snap = await getDoc(characterDoc(userId, campaignId, 'sheet'))
  return snap.exists() ? snap.data() : null
}

export async function getPlay(userId, campaignId) {
  const snap = await getDoc(characterDoc(userId, campaignId, 'play'))
  return snap.exists() ? snap.data() : null
}

/** onSnapshot on character/sheet; `cb(data | null)`. Returns the unsubscribe. */
export function subscribeSheet(userId, campaignId, cb, onError) {
  return onSnapshot(characterDoc(userId, campaignId, 'sheet'), (s) => cb(s.exists() ? s.data() : null), onError)
}

/** onSnapshot on character/play; `cb(data | null)`. Returns the unsubscribe. */
export function subscribePlay(userId, campaignId, cb, onError) {
  return onSnapshot(characterDoc(userId, campaignId, 'play'), (s) => cb(s.exists() ? s.data() : null), onError)
}

/** Field-path patch onto character/play (see src/lib/play.js). */
export function updatePlay(userId, campaignId, patch) {
  return updateDoc(characterDoc(userId, campaignId, 'play'), { ...patch, updatedAt: serverTimestamp() })
}

/** Create character/play if it is missing, without touching existing fields. */
export function ensurePlay(userId, campaignId) {
  return setDoc(characterDoc(userId, campaignId, 'play'), { updatedAt: serverTimestamp() }, { merge: true })
}

export async function getSpellNotes(userId, campaignId) {
  const snap = await getDoc(characterDoc(userId, campaignId, 'notes'))
  return snap.exists() ? snap.data().spells ?? {} : {}
}

export function setSpellNote(userId, campaignId, spellKey, text) {
  return setDoc(
    characterDoc(userId, campaignId, 'notes'),
    { spells: { [spellKey]: text }, updatedAt: serverTimestamp() },
    { merge: true }
  )
}

/**
 * Apply an import plan (src/lib/sheet/importPlan.js) in one batch: the
 * sheet doc, the confirmed resources, the empty dossier fields, the new Item
 * entities and — on a re-import with changes — the milestone log entry.
 * Play state other than the resource list is left as it is.
 */
export async function saveSheetImport(userId, campaignId, plan, resources) {
  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.set(characterDoc(userId, campaignId, 'sheet'), { ...plan.doc, importedAt: now })
  batch.set(characterDoc(userId, campaignId, 'play'), { resources, updatedAt: now }, { merge: true })

  if (Object.keys(plan.dossier.patch).length) {
    batch.set(characterDoc(userId, campaignId, 'main'), { ...plan.dossier.patch, updatedAt: now }, { merge: true })
  }

  for (const name of plan.items.create) {
    const { ref, data } = newEntity(userId, campaignId, { name, type: 'item', source: 'sheet' })
    batch.set(ref, data)
  }

  const milestoneSession = plan.milestone?.session
  if (milestoneSession) {
    const { ref, data } = newLogEntry(userId, campaignId, {
      sessionId: milestoneSession.id,
      text: plan.milestone.text,
      mark: 'milestone',
    })
    batch.set(ref, data)
  }

  await batch.commit()
}
