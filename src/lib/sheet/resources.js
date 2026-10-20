// Limited-use resources (Bardic Inspiration, free spell casts, …) guessed
// from a parsed sheet. The guess is fuzzy by nature, so the import flow
// always shows the result for confirmation before anything is saved.
import { spellKey } from './normalize'

const WORD_NUMBERS = { once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6 }

const toReset = (word) => (/short/i.test(word) ? 'short' : 'long')

/** "4 / Short Rest" → { max: 4, reset: 'short' }; else null. */
export function parseUsesTag(text) {
  const m = String(text ?? '').match(/(\d+)\s*\/\s*(Short|Long)\s+Rest/i)
  return m ? { max: Number(m[1]), reset: toReset(m[2]) } : null
}

/**
 * Prose like "4 times per Long Rest", "up to 3 times per Long Rest",
 * "once per Short or Long Rest" → [{ max, reset, text }]. A resource that
 * recharges on a short *or* long rest counts as short.
 */
export function findUsesInProse(text) {
  const re =
    /(?:up to\s+)?\b(\d+|once|twice|one|two|three|four|five|six)\b(?:\s+times?)?\s+(?:per|each)\s+(Short|Long)(?:\s+or\s+Long)?\s+Rest/gi
  return [...String(text ?? '').matchAll(re)].map((m) => ({
    max: /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1].toLowerCase()],
    reset: toReset(m[2]),
    text: m[0],
  }))
}

/**
 * Parsed sheet → [{ id, name, max, reset: 'short'|'long', origin, evidence,
 * conflict }].
 *
 * Strongest signal first: D&D Beyond's usage tags on actions ("Bardic
 * Inspiration • 4 / Short Rest") and feature option lines ("Familiar
 * Distraction: 3 / Long Rest • 1 Reaction"), then free casts on spell rows
 * ("1/LR"), then prose in action text. Prose in feature text never creates a
 * resource — it is too loose ("once per Long Rest, you can cast it…") — but
 * it is kept as evidence, and `conflict` flags a resource whose evidence
 * disagrees with the chosen value. Example: the sheet tags Bardic
 * Inspiration "4 / Short Rest" while its rules text still says "4 times per
 * Long Rest".
 */
export function detectResources(parsed) {
  const byId = new Map()
  const add = (name, uses, origin, text, { create = true } = {}) => {
    const id = spellKey(name)
    if (!id || !uses?.max) return
    let r = byId.get(id)
    if (!r) {
      if (!create) return
      r = { id, name, max: uses.max, reset: uses.reset, origin, evidence: [], conflict: false }
      byId.set(id, r)
    }
    r.evidence.push({ origin, text: text.trim() })
    if (uses.max !== r.max || uses.reset !== r.reset) r.conflict = true
  }

  for (const a of parsed.actions ?? []) {
    const uses = parseUsesTag(a.uses)
    if (uses) add(a.name, uses, 'action', `${a.name} • ${a.uses}`)
  }

  for (const f of parsed.features ?? []) {
    for (const note of f.notes ?? []) {
      const uses = parseUsesTag(note)
      if (!uses) continue
      // "Familiar Distraction: 3 / Long Rest • 1 Reaction" names the
      // resource; a bare "4 / Short Rest • …" belongs to the feature itself.
      const named = note.match(/^(.+?):\s*\d+\s*\//)
      add(named ? named[1].trim() : f.name, uses, 'feature', note)
    }
  }

  for (const s of parsed.spells ?? []) {
    if (!s.freeUse) continue
    const note = s.notes.find((n) => /\d+\s*\/\s*(LR|SR)\b/i.test(n)) ?? ''
    add(`${s.name} (free cast)`, s.freeUse, 'spell', `${s.name}: ${note}`)
  }

  for (const a of parsed.actions ?? []) {
    for (const p of findUsesInProse(a.text)) add(a.name, p, 'action-text', p.text)
  }

  for (const f of parsed.features ?? []) {
    for (const p of findUsesInProse(f.text)) add(f.name, p, 'feature-text', p.text, { create: false })
  }

  return [...byId.values()]
}
