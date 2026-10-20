// Low-level helpers for D&D Beyond sheet fields. Pure, no pdf.js or Firebase.

/**
 * D&D Beyond field names carry stray and doubled spaces ("DEXmod ",
 * "CLASS  LEVEL", "Wpn3 AtkBonus  "). Trim and collapse before any lookup.
 */
export function normalizeFieldName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ')
}

/**
 * [{ fieldName, value }] → { normalizedName: value }. Later duplicates win,
 * which never matters in practice: repeated names only occur for the page
 * headers on pages 2–5, and those carry a numeric suffix.
 */
export function buildFieldMap(fields) {
  const map = {}
  for (const f of fields ?? []) {
    map[normalizeFieldName(f.fieldName)] = f.value
  }
  return map
}

/**
 * Case-insensitive view over a field map, for the names D&D Beyond spells
 * inconsistently ("SleightofHand" vs "SleightOfHandProf", "CHamod").
 */
export function caseInsensitiveLookup(map) {
  const lower = {}
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v
  return (name) => lower[normalizeFieldName(name).toLowerCase()]
}

/**
 * Sheet text → trimmed string, with D&D Beyond's "--" placeholder as empty.
 */
export function cleanValue(value) {
  if (value == null) return ''
  const s = String(value).trim()
  return s === '--' ? '' : s
}

/**
 * "+5" → 5, "-1" → -1, "38" → 38, "--" / "" → null. Leading number only, so
 * "30 ft. (Walking)" → 30.
 */
export function parseNumber(value) {
  const s = cleanValue(value).replace(/[−–]/g, '-')
  const m = s.match(/^([+-]?\d+)/)
  return m ? Number(m[1]) : null
}

/**
 * Stable key for a spell name, safe as a Firestore map key / field path
 * segment: "Tasha's Hideous Laughter" → "tashas-hideous-laughter",
 * "Séance" → "seance".
 */
export function spellKey(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Join text that D&D Beyond flowed across several fixed-size boxes. A box
 * that stops mid-sentence continues with a space ("don’t count" + "against
 * the number…"); one that stops at the end of a sentence starts a new
 * paragraph.
 */
export function joinBoxes(parts) {
  let out = ''
  for (const raw of parts) {
    const part = String(raw ?? '').replace(/\s+$/, '')
    if (!part.trim()) continue
    if (!out) {
      out = part
      continue
    }
    const midSentence = !/[.!?:)"”]$/.test(out) && !/^\s*(\*|===)/.test(part)
    out += midSentence ? ' ' + part.replace(/^\s+/, '') : '\n\n' + part.replace(/^\n+/, '')
  }
  return out
}

/**
 * Fields whose normalized name is `${prefix}${n}`, in numeric order.
 * numberedValues(map, 'FeaturesTraits') → [FeaturesTraits1, FeaturesTraits2, …]
 */
export function numberedValues(map, prefix) {
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$')
  return Object.entries(map)
    .map(([k, v]) => {
      const m = k.match(re)
      return m ? [Number(m[1]), v] : null
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
}
