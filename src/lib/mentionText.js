// Mentions inside plain text (log lines, Inking cards). Pure.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// "@Brother Anselm", "@Vell" — a capitalised word, optionally one more.
const BARE_MENTION = /@\p{Lu}[\p{L}’'-]*(?: \p{Lu}[\p{L}’'-]*)?/u

/**
 * "Anselm: “The bells of @Vell don’t ring”" → parts for display:
 * [{ text: 'Anselm: “The bells of ' }, { text: 'Vell', mention: true, entity }, …].
 * An @-name that matches an entity (name or alias, longest first) carries
 * it; an unknown one is still highlighted, just not linked.
 */
export function splitMentions(text, entities = []) {
  const s = String(text ?? '')
  const names = []
  for (const e of entities) {
    for (const n of [e.name, ...(e.aliases ?? [])]) if (n?.trim()) names.push({ n: n.trim(), e })
  }
  names.sort((a, b) => b.n.length - a.n.length)
  const known = names.length ? new RegExp(`@(${names.map((x) => escapeRe(x.n)).join('|')})(?![\\p{L}\\p{N}])`, 'iu') : null

  const parts = []
  let rest = s
  while (rest) {
    const k = known?.exec(rest)
    const b = BARE_MENTION.exec(rest)
    const m = k && (!b || k.index <= b.index) ? k : b
    if (!m) {
      parts.push({ text: rest })
      break
    }
    if (m.index > 0) parts.push({ text: rest.slice(0, m.index) })
    const name = m === k ? k[1] : m[0].slice(1)
    const entity = m === k ? names.find((x) => x.n.toLowerCase() === k[1].toLowerCase())?.e ?? null : null
    parts.push({ text: name, mention: true, entity })
    rest = rest.slice(m.index + m[0].length)
  }
  return parts
}

/** The line without its @ signs, for places that show plain text. */
export function stripAt(text) {
  return splitMentions(text).map((p) => p.text).join('')
}

/**
 * Entities a line talks about: @-mentions first, then names or aliases
 * that appear as whole words. Used to suggest "Link to an existing page".
 */
export function mentionedEntities(text, entities = [], limit = 4) {
  const s = String(text ?? '')
  const found = []
  const add = (e) => {
    if (e && !found.includes(e)) found.push(e)
  }
  for (const p of splitMentions(s, entities)) if (p.entity) add(p.entity)
  const lower = s.toLowerCase()
  for (const e of entities) {
    for (const n of [e.name, ...(e.aliases ?? [])]) {
      const name = n?.trim().toLowerCase()
      if (!name || name.length < 3) continue
      if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, 'u').test(lower)) add(e)
    }
  }
  return found.slice(0, limit)
}
