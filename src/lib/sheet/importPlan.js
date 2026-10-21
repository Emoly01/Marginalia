// What an import will write, worked out before anything is written, so the
// import screen can show it and the save can apply exactly that. Pure.
import { ABILITY_KEYS, PARSER_VERSION, parseDdbSheet } from './parseDdbSheet'
import { detectResources } from './resources'
import { diffSheets, summarizeDiff } from './diff'

// Firestore's hard cap is 1 MiB per document; leave room for field names
// and index overhead the JSON estimate below doesn't see.
export const SHEET_DOC_BUDGET = 900 * 1024

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Plain sheet text → paragraphs of Tiptap-compatible HTML.
function toHtml(text, label) {
  const paras = String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => escapeHtml(p).replace(/\n/g, '<br>'))
  if (!paras.length) return ''
  if (label) paras[0] = `<strong>${escapeHtml(label)}.</strong> ${paras[0]}`
  return paras.map((p) => `<p>${p}</p>`).join('')
}

/** A dossier value counts as empty when it holds nothing a person wrote. */
export function isEmptyDossierValue(key, value) {
  if (value == null) return true
  if (key === 'level') return !value || Number(value) === 1 // 1 is the form's default
  if (key === 'abilities') {
    return ABILITY_KEYS.every((k) => value[k] == null || Number(value[k]) === 10) // all 10s = untouched
  }
  if (typeof value === 'string') return !value.replace(/<[^>]*>/g, '').trim()
  return false
}

const DOSSIER_FIELDS = [
  { key: 'name', label: 'Name', from: (s) => s.identity.name },
  { key: 'class', label: 'Class', from: (s) => s.identity.classes.map((c) => c.class).join(' / ') },
  { key: 'level', label: 'Level', from: (s) => s.identity.level },
  { key: 'ancestry', label: 'Ancestry', from: (s) => s.identity.species },
  { key: 'background', label: 'Background', from: (s) => s.identity.background },
  {
    key: 'abilities',
    label: 'Ability scores',
    from: (s) =>
      ABILITY_KEYS.every((k) => s.abilities[k].score != null)
        ? Object.fromEntries(ABILITY_KEYS.map((k) => [k, s.abilities[k].score]))
        : null,
  },
  {
    key: 'personality',
    label: 'Personality',
    from: (s) =>
      [
        toHtml(s.personality.traits),
        toHtml(s.personality.ideals, 'Ideals'),
        toHtml(s.personality.bonds, 'Bonds'),
        toHtml(s.personality.flaws, 'Flaws'),
      ].join(''),
  },
  { key: 'backstory', label: 'Backstory', from: (s) => toHtml(s.personality.backstory) },
]

/**
 * Which dossier (`character/main`) fields the sheet can fill. Only empty
 * fields are filled; anything already written is reported as kept.
 * → { patch, filled: [{ key, label, value }], kept: [{ key, label }] }
 */
export function planDossierFill(parsed, character) {
  const patch = {}
  const filled = []
  const kept = []
  for (const f of DOSSIER_FIELDS) {
    const value = f.from(parsed)
    if (isEmptyDossierValue(f.key, value)) continue
    if (isEmptyDossierValue(f.key, character?.[f.key])) {
      patch[f.key] = value
      filled.push({ key: f.key, label: f.label, value })
    } else {
      kept.push({ key: f.key, label: f.label })
    }
  }
  return { patch, filled, kept }
}

/** Keep only the dossier fills I left ticked. */
export function selectDossierFill(dossier, keys) {
  const keep = new Set(keys)
  return {
    ...dossier,
    patch: Object.fromEntries(Object.entries(dossier.patch).filter(([k]) => keep.has(k))),
    filled: dossier.filled.filter((f) => keep.has(f.key)),
  }
}

/**
 * Sheet items that should become Item entities: one per distinct name, and
 * none for names any entity already uses (case-insensitive, any type).
 * → { create: [name], existing: [name] }
 */
export function planItemEntities(parsed, entities) {
  const taken = new Set((entities ?? []).map((e) => String(e.name).trim().toLowerCase()))
  const create = []
  const existing = []
  const seen = new Set()
  const names = [...(parsed.inventory?.items ?? []).map((i) => i.name), ...(parsed.inventory?.attuned ?? [])]
  for (const name of names) {
    const key = name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    ;(taken.has(key) ? existing : create).push(name.trim())
  }
  return { create, existing }
}

/**
 * Resources for the confirm step. On a first import that's what was
 * detected; on a re-import the confirmed list from last time wins (it holds
 * my corrections) and only newly detected resources are added.
 * → [{ id, name, max, reset, origin, evidence, conflict, isNew }]
 */
export function planResources(parsed, previous) {
  const detected = detectResources(parsed)
  if (!previous?.length) return detected.map((r) => ({ ...r, isNew: true }))
  const byId = new Map(detected.map((r) => [r.id, r]))
  const kept = previous.map((p) => ({
    ...(byId.get(p.id) ?? { origin: 'confirmed', evidence: [], conflict: false }),
    id: p.id,
    name: p.name,
    max: p.max,
    reset: p.reset,
    isNew: false,
  }))
  const prevIds = new Set(previous.map((p) => p.id))
  return [...kept, ...detected.filter((r) => !prevIds.has(r.id)).map((r) => ({ ...r, isNew: true }))]
}

/** Confirm-step rows → what `character/play.resources` stores. */
export function cleanResources(rows) {
  const seen = new Set()
  const out = []
  for (const r of rows) {
    const name = String(r.name ?? '').trim()
    const max = Math.max(0, Math.floor(Number(r.max) || 0))
    if (!name || !max) continue
    let id = r.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    while (seen.has(id)) id += '-2'
    seen.add(id)
    out.push({ id, name, max, reset: r.reset === 'short' ? 'short' : 'long' })
  }
  return out
}

/** Rough serialized size of a Firestore document, in bytes. */
export function estimateDocBytes(data) {
  return new TextEncoder().encode(JSON.stringify(data)).length
}

/**
 * The `character/sheet` document for this import, minus `importedAt`
 * (a server timestamp the store adds). `raw` keeps the field list with page
 * and rect, because spell levels are read from positions.
 */
export function buildSheetDoc({ parsed, fields, fileName }) {
  return {
    parserVersion: PARSER_VERSION,
    sourceFileName: fileName || '',
    data: parsed,
    raw: fields.map((f) => ({ page: f.page, fieldName: f.fieldName, value: f.value, rect: f.rect ?? [] })),
  }
}

/**
 * A stored sheet doc → parsed data, re-parsing from `raw` when it was
 * written by an older parser.
 */
export function sheetData(doc) {
  if (!doc) return null
  if (doc.parserVersion !== PARSER_VERSION && doc.raw?.length) return parseDdbSheet(doc.raw)
  return doc.data ?? null
}

/**
 * The session a level-up milestone goes into: the live one, else the most
 * recent. `sessions` arrive most-recent-first, as listSessions() returns them.
 */
export function pickMilestoneSession(sessions) {
  return sessions?.find((s) => s.status === 'live') ?? sessions?.[0] ?? null
}

/**
 * Everything the import screen shows and the save applies.
 */
export function buildImportPlan({ parsed, fields, fileName, previousDoc, character, entities, play, sessions }) {
  const previous = sheetData(previousDoc)
  const doc = buildSheetDoc({ parsed, fields, fileName })
  const diff = previous ? diffSheets(previous, parsed) : null
  return {
    doc,
    bytes: estimateDocBytes(doc),
    isReimport: Boolean(previous),
    dossier: planDossierFill(parsed, character),
    items: planItemEntities(parsed, entities),
    resources: planResources(parsed, play?.resources),
    diff,
    milestone: diff?.hasChanges
      ? { text: summarizeDiff(diff), session: pickMilestoneSession(sessions) }
      : null,
  }
}
