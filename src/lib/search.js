// Client-side search over a campaign's sessions, entities, margins, log,
// dossier and imported sheet, with MiniSearch (prefix + fuzzy). Pure: the
// data comes in as plain objects, and each result says where it lives.
import MiniSearch from 'minisearch'
import { stripHtml } from './text'
import { sheetData } from './sheet/importPlan'

// Result groups, in the order they're shown.
export const RESULT_TYPES = [
  { type: 'session', label: 'Sessions' },
  { type: 'entity', label: 'Codex' },
  { type: 'log', label: 'Session log' },
  { type: 'margin', label: 'Margins' },
  { type: 'dossier', label: 'Dossier' },
  { type: 'spell', label: 'Spells' },
  { type: 'feature', label: 'Features' },
  { type: 'item', label: 'Items' },
  { type: 'attack', label: 'Attacks' },
]

const DOSSIER_SECTIONS = [
  ['personality', 'Personality'],
  ['backstory', 'Backstory'],
  ['goals', 'Goals'],
  ['knowledge', 'What my character knows'],
  ['knowledgeOOC', 'What I know (OOC)'],
  ['items', 'Items of meaning'],
  ['vibes', 'Vibes'],
]

const join = (...parts) => parts.flat().filter(Boolean).join(' · ')

/**
 * One campaign's data → search documents:
 * { id, type, mark?, campaignId, title, text, subtitle, target }.
 * `target` is what targetPath() turns into a route.
 */
export function buildDocuments({ campaign, sessions = [], entities = [], margins = [], log = [], character = null, sheetDoc = null, spellNotes = {} }) {
  const cid = campaign.id
  const docs = []
  const add = (d) => docs.push({ campaignId: cid, campaignName: campaign.shortName || campaign.name || '', subtitle: '', ...d })
  const sessionTitle = Object.fromEntries(sessions.map((s) => [s.id, s.title]))

  for (const s of sessions) {
    add({ id: `${cid}:session:${s.id}`, type: 'session', title: s.title || 'Untitled session', text: stripHtml(s.content), subtitle: s.date || '', target: { kind: 'session', sessionId: s.id } })
  }
  for (const e of entities) {
    add({
      id: `${cid}:entity:${e.id}`,
      type: 'entity',
      title: e.name,
      text: join(e.aliases, stripHtml(e.notes)),
      subtitle: e.type,
      target: { kind: 'entity', entityId: e.id },
    })
  }
  for (const m of margins) {
    add({ id: `${cid}:margin:${m.id}`, type: 'margin', mark: 'margin', title: m.text, text: '', subtitle: m.archived ? 'archived' : '', target: { kind: 'campaign' } })
  }
  for (const l of log) {
    if (l.auto) continue // tracker taps are noise in search
    add({
      id: `${cid}:log:${l.id}`,
      type: 'log',
      mark: l.mark || 'note',
      title: l.text,
      text: '',
      subtitle: join(l.mark !== 'note' && l.mark, sessionTitle[l.sessionId]),
      target: { kind: 'session', sessionId: l.sessionId },
    })
  }
  if (character) {
    for (const [key, label] of DOSSIER_SECTIONS) {
      const text = stripHtml(character[key])
      if (text) add({ id: `${cid}:dossier:${key}`, type: 'dossier', title: label, text, target: { kind: 'dossier' } })
    }
    for (const r of character.relationships ?? []) {
      if (r.name) add({ id: `${cid}:dossier:rel:${r.id}`, type: 'dossier', title: r.name, text: r.notes ?? '', subtitle: join('relationship', r.type), target: { kind: 'dossier' } })
    }
  }

  const sheet = sheetData(sheetDoc)
  if (sheet) {
    for (const s of sheet.spells) {
      add({
        id: `${cid}:spell:${s.key}`,
        type: 'spell',
        title: s.name,
        text: join(s.sources, s.notes, spellNotes[s.key]),
        subtitle: s.level === 0 ? 'cantrip' : `level ${s.level}`,
        target: { kind: 'table', tab: 'spells', spell: s.key },
      })
    }
    sheet.features.forEach((f, i) => {
      add({ id: `${cid}:feature:${i}`, type: 'feature', title: f.name, text: join(f.notes, f.text), subtitle: f.group, target: { kind: 'table', tab: 'features' } })
    })
    // Sheet items that are already entities are found as entities.
    const entityNames = new Set(entities.map((e) => String(e.name).trim().toLowerCase()))
    const seen = new Set()
    for (const it of sheet.inventory.items) {
      const key = it.name.trim().toLowerCase()
      if (entityNames.has(key) || seen.has(key)) continue
      seen.add(key)
      add({ id: `${cid}:item:${key}`, type: 'item', title: it.name, text: '', subtitle: 'on the sheet', target: { kind: 'table', tab: 'items' } })
    }
    sheet.attacks.forEach((a, i) => {
      add({ id: `${cid}:attack:${i}`, type: 'attack', title: a.name, text: join(a.damage, a.notes), subtitle: a.bonus, target: { kind: 'table', tab: 'attacks' } })
    })
  }
  return docs
}

// Edit distance allowed per query term. Swapped letters ("gnral" for
// "gnarl") are two edits and the commonest tablet typo, so 5+ letters get
// two. Shorter terms get none — even one edit lets "ball" match "bell" —
// and still match by prefix.
export const fuzziness = (term) => (term.length < 5 ? 0 : 2)

export function createIndex(docs) {
  const index = new MiniSearch({
    fields: ['title', 'text'],
    storeFields: ['type', 'mark', 'campaignId', 'campaignName', 'title', 'text', 'subtitle', 'target'],
    searchOptions: { prefix: true, fuzzy: fuzziness, boost: { title: 3 }, combineWith: 'AND' },
  })
  index.addAll(docs)
  return index
}

/**
 * query → [{ type, label, results: [...] }] in RESULT_TYPES order.
 * `campaignId` limits to one campaign; null searches all of them.
 */
export function searchIndex(index, query, { campaignId = null, perGroup = 6 } = {}) {
  const q = String(query ?? '').trim()
  if (!index || q.length < 2) return []
  const filter = campaignId ? (r) => r.campaignId === campaignId : undefined
  // Exact and prefix matches first; fuzzy only when they find nothing, so a
  // correctly typed word isn't buried under its look-alikes.
  let hits = index.search(q, { filter, fuzzy: false })
  if (hits.length === 0) hits = index.search(q, { filter })
  const groups = new Map()
  for (const h of hits) {
    if (!groups.has(h.type)) groups.set(h.type, [])
    const list = groups.get(h.type)
    if (list.length < perGroup) list.push(h)
  }
  return RESULT_TYPES.filter((t) => groups.has(t.type)).map((t) => ({ ...t, results: groups.get(t.type) }))
}

/** A result → the route that shows it. */
export function targetPath(result) {
  const base = `/campaigns/${result.campaignId}`
  const t = result.target ?? {}
  switch (t.kind) {
    case 'session':
      return `${base}/sessions/${t.sessionId}`
    case 'entity':
      return `${base}/entities/${t.entityId}`
    case 'dossier':
      return `${base}?tab=character`
    case 'table': {
      const qs = new URLSearchParams({ tab: t.tab })
      if (t.spell) qs.set('spell', t.spell)
      return `${base}/table?${qs}`
    }
    default:
      return base
  }
}

/**
 * A short piece of `text` around the first query term it contains, for the
 * result list. Falls back to the opening when no term appears verbatim
 * (a fuzzy match).
 */
export function snippet(text, query, length = 120) {
  const s = String(text ?? '')
  if (s.length <= length) return s
  const terms = String(query ?? '').toLowerCase().split(/\s+/).filter((t) => t.length > 1)
  const lower = s.toLowerCase()
  const at = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (at === undefined || at < length / 2) return s.slice(0, length).trimEnd() + '…'
  const start = Math.max(0, at - Math.floor(length / 3))
  return '…' + s.slice(start, start + length).trim() + '…'
}
