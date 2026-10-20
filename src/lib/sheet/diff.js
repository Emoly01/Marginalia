// Compare two parsed sheets — a re-import is usually a level-up — and say
// what changed in one line for the session log.
import { ABILITY_KEYS } from './parseDdbSheet'
import { spellKey } from './normalize'

function setDiff(oldList, newList, keyOf, labelOf) {
  const oldKeys = new Map(oldList.map((x) => [keyOf(x), labelOf(x)]))
  const newKeys = new Map(newList.map((x) => [keyOf(x), labelOf(x)]))
  return {
    added: [...newKeys].filter(([k]) => !oldKeys.has(k)).map(([, l]) => l),
    removed: [...oldKeys].filter(([k]) => !newKeys.has(k)).map(([, l]) => l),
  }
}

const change = (from, to) => (from === to ? null : { from, to })

function itemCounts(sheet) {
  const counts = new Map()
  for (const item of sheet?.inventory?.items ?? []) {
    const key = item.name.toLowerCase()
    const prev = counts.get(key)
    counts.set(key, { name: item.name, qty: (prev?.qty ?? 0) + (item.qty ?? 1) })
  }
  return counts
}

/**
 * Old parsed sheet, new parsed sheet → what changed. Every list is empty and
 * every scalar change is null when nothing moved; `hasChanges` says whether
 * anything did.
 */
export function diffSheets(oldSheet, newSheet) {
  const o = oldSheet ?? {}
  const n = newSheet ?? {}

  const slotLevels = new Set([...Object.keys(o.slots ?? {}), ...Object.keys(n.slots ?? {})])
  const slots = [...slotLevels]
    .sort((a, b) => Number(a) - Number(b))
    .map((level) => ({ level: Number(level), from: o.slots?.[level] ?? 0, to: n.slots?.[level] ?? 0 }))
    .filter((s) => s.from !== s.to)

  const abilities = ABILITY_KEYS.map((key) => ({
    key,
    from: o.abilities?.[key]?.score ?? null,
    to: n.abilities?.[key]?.score ?? null,
  })).filter((a) => a.from !== a.to)

  const oldItems = itemCounts(o)
  const newItems = itemCounts(n)
  const items = { added: [], removed: [], changed: [] }
  for (const [key, it] of newItems) {
    const prev = oldItems.get(key)
    if (!prev) items.added.push(it.name)
    else if (prev.qty !== it.qty) items.changed.push({ name: it.name, from: prev.qty, to: it.qty })
  }
  for (const [key, it] of oldItems) if (!newItems.has(key)) items.removed.push(it.name)

  const diff = {
    classLevel: change(o.identity?.classLevel ?? '', n.identity?.classLevel ?? ''),
    level: change(o.identity?.level ?? null, n.identity?.level ?? null),
    maxHp: change(o.combat?.maxHp ?? null, n.combat?.maxHp ?? null),
    profBonus: change(o.combat?.profBonus ?? null, n.combat?.profBonus ?? null),
    slots,
    abilities,
    spells: setDiff(o.spells ?? [], n.spells ?? [], (s) => s.key ?? spellKey(s.name), (s) => s.name),
    features: setDiff(
      o.features ?? [],
      n.features ?? [],
      (f) => `${f.group}::${f.name}`.toLowerCase(),
      (f) => f.name
    ),
    items,
  }
  diff.hasChanges = Boolean(
    diff.classLevel ||
      diff.level ||
      diff.maxHp ||
      diff.profBonus ||
      slots.length ||
      abilities.length ||
      diff.spells.added.length ||
      diff.spells.removed.length ||
      diff.features.added.length ||
      diff.features.removed.length ||
      items.added.length ||
      items.removed.length ||
      items.changed.length
  )
  return diff
}

// "Bard 5" → "Bard 6" reads as "Bard 5 → 6"; anything else in full.
function formatClassChange(from, to) {
  const a = String(from).match(/^(\D+?)\s+(\d+)$/)
  const b = String(to).match(/^(\D+?)\s+(\d+)$/)
  if (a && b && a[1] === b[1]) return `${a[1]} ${a[2]} → ${b[2]}`
  return `${from || '?'} → ${to || '?'}`
}

const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')

/**
 * diff → "Bard 5 → 6 · Max HP 38 → 45 · new: Hypnotic Pattern". Items and
 * features are left out of the one-liner unless nothing else changed; the
 * full diff is shown before saving.
 */
export function summarizeDiff(diff) {
  if (!diff?.hasChanges) return 'Sheet re-imported · no changes'
  const parts = []
  if (diff.classLevel) parts.push(formatClassChange(diff.classLevel.from, diff.classLevel.to))
  if (diff.maxHp) parts.push(`Max HP ${diff.maxHp.from ?? '?'} → ${diff.maxHp.to ?? '?'}`)
  for (const s of diff.slots) parts.push(`${ordinal(s.level)}-level slots ${s.from} → ${s.to}`)
  for (const a of diff.abilities) parts.push(`${a.key.toUpperCase()} ${a.from ?? '?'} → ${a.to ?? '?'}`)
  if (diff.spells.added.length) parts.push(`new: ${diff.spells.added.join(', ')}`)
  if (diff.spells.removed.length) parts.push(`dropped: ${diff.spells.removed.join(', ')}`)
  if (diff.features.added.length) parts.push(`features: ${diff.features.added.join(', ')}`)
  if (!parts.length) {
    const { added, removed, changed } = diff.items
    if (added.length) parts.push(`items: +${added.join(', +')}`)
    if (removed.length) parts.push(`items: −${removed.join(', −')}`)
    if (changed.length) parts.push(changed.map((c) => `${c.name} ${c.from} → ${c.to}`).join(', '))
    if (diff.features.removed.length) parts.push(`features dropped: ${diff.features.removed.join(', ')}`)
  }
  return parts.join(' · ')
}
