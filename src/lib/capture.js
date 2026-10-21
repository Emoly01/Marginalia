// The live log's one-line capture: prefix shortcuts and marks. Pure.
import { parseLine } from './npcLine'

// What I can tag a typed line as. `auto` (tracker taps) is written by the
// app only; `milestone` is also written by a level-up re-import.
export const CAPTURE_MARKS = [
  { value: 'note', label: 'note' },
  { value: 'important', label: 'important', prefix: '!:' },
  { value: 'quote', label: 'quote', prefix: 'q:' },
  { value: 'npc', label: 'NPC', prefix: 'npc:' },
  { value: 'mystery', label: 'mystery', prefix: '?:' },
  { value: 'loot', label: 'loot', prefix: '$:' },
  { value: 'milestone', label: 'milestone' },
]

export function markLabel(mark) {
  if (mark === 'auto') return 'sheet'
  return CAPTURE_MARKS.find((m) => m.value === mark)?.label ?? mark
}

/**
 * Typed line + the mark toggled in the row → { mark, text, npc }.
 * A prefix ("npc: Gnarl — grumpy bartender", "q: …", "?: …", "!: …",
 * "$: …") wins over the toggle. For an NPC line, `npc` is the parsed
 * { name, notes }; for anything else it is null. Empty input → null.
 */
export function parseCapture(input, toggledMark = 'note') {
  let text = String(input ?? '').trim()
  let mark = CAPTURE_MARKS.some((m) => m.value === toggledMark) ? toggledMark : 'note'
  const lower = text.toLowerCase()
  for (const m of CAPTURE_MARKS) {
    if (m.prefix && lower.startsWith(m.prefix)) {
      mark = m.value
      text = text.slice(m.prefix.length).trim()
      break
    }
  }
  if (!text) return null
  if (mark !== 'npc') return { mark, text, npc: null }
  const npc = parseLine(text)
  return npc.name ? { mark, text, npc } : null
}

/** Case-insensitive name match against existing entities (any type). */
export function findEntityByName(entities, name) {
  const key = String(name ?? '').trim().toLowerCase()
  return (entities ?? []).find((e) => String(e.name).trim().toLowerCase() === key) ?? null
}
