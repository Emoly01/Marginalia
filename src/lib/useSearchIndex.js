// useSearchIndex — a MiniSearch index over the campaigns in scope, built
// the first time search opens and rebuilt whenever their data changes.
//
// Each campaign gets onSnapshot listeners on everything search covers.
// They only start once search has been opened, stay up afterwards (so the
// next open is instant), and after the first read only deltas arrive.
import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { buildDocuments, createIndex } from './search'

const REBUILD_MS = 250

const SOURCES = [
  { key: 'sessions', path: 'sessions' },
  { key: 'entities', path: 'entities' },
  { key: 'margins', path: 'margins' },
  { key: 'log', path: 'log' },
  { key: 'character', path: 'character/main', single: true },
  { key: 'sheetDoc', path: 'character/sheet', single: true },
  { key: 'notes', path: 'character/notes', single: true },
]

function subscribeCampaign(userId, campaignId, onData) {
  const base = ['users', userId, 'campaigns', campaignId]
  const unsubs = SOURCES.map((s) => {
    const parts = [...base, ...s.path.split('/')]
    const onError = (err) => console.error(`Search could not read ${s.path}:`, err)
    if (s.single) {
      return onSnapshot(doc(db, ...parts), (snap) => onData(s.key, snap.exists() ? snap.data() : null), onError)
    }
    return onSnapshot(
      collection(db, ...parts),
      (snap) => onData(s.key, snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    )
  })
  return () => unsubs.forEach((u) => u())
}

/**
 * campaigns: the campaign objects to index ([] until search is first used).
 * → { index, ready }
 */
export function useSearchIndex(userId, campaigns) {
  const dataRef = useRef({}) // campaignId → { sessions, entities, … }
  const [version, setVersion] = useState(0)
  const [index, setIndex] = useState(null)
  const idsKey = campaigns.map((c) => c.id).sort().join(',')

  useEffect(() => {
    const unsubs = campaigns.map((c) =>
      subscribeCampaign(userId, c.id, (key, value) => {
        dataRef.current[c.id] = { ...(dataRef.current[c.id] ?? {}), [key]: value }
        setVersion((v) => v + 1)
      })
    )
    return () => unsubs.forEach((u) => u())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, idsKey])

  const byId = useMemo(() => Object.fromEntries(campaigns.map((c) => [c.id, c])), [campaigns])

  // Debounced, so a burst of snapshots (first load, an Inking pass) is one rebuild.
  useEffect(() => {
    if (!version) return undefined
    const t = setTimeout(() => {
      const docs = Object.entries(dataRef.current)
        .filter(([cid]) => byId[cid])
        .flatMap(([cid, d]) =>
          buildDocuments({
            campaign: byId[cid],
            sessions: d.sessions ?? [],
            entities: d.entities ?? [],
            margins: d.margins ?? [],
            log: d.log ?? [],
            character: d.character ?? null,
            sheetDoc: d.sheetDoc ?? null,
            spellNotes: d.notes?.spells ?? {},
          })
        )
      setIndex(createIndex(docs))
    }, REBUILD_MS)
    return () => clearTimeout(t)
  }, [version, byId])

  return { index, ready: Boolean(index) }
}
