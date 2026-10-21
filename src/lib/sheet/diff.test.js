import { describe, it, expect } from 'vitest'
import fixture from './__fixtures__/ddb-nenise.fixture.json'
import { parseDdbSheet } from './parseDdbSheet'
import { diffSheets, summarizeDiff, diffRows, proclamation } from './diff'

const level5 = parseDdbSheet(fixture.fields)

// The same character at level 6, built from the fixture rather than typed
// out, so the test only depends on what changed.
function levelUp() {
  const s = structuredClone(level5)
  s.identity.classLevel = 'Bard 6'
  s.identity.classes = [{ class: 'Bard', level: 6 }]
  s.identity.level = 6
  s.combat.maxHp = 45
  s.slots = { ...s.slots, 3: 3 }
  s.abilities.cha.score = 20
  s.spells.push({ key: 'hypnotic-pattern', name: 'Hypnotic Pattern', level: 3 })
  s.spells = s.spells.filter((x) => x.name !== 'Sending')
  s.features.push({ name: 'Mantle of Whispers', group: 'Bard Features', source: '', text: '', notes: [] })
  s.inventory.items.push({ name: 'Potion of Healing', qty: 2, weight: '1 lb.' })
  s.inventory.items = s.inventory.items.map((i) => (i.name === 'Oil' ? { ...i, qty: 8 } : i))
  return s
}

describe('diffSheets', () => {
  it('reports no changes for an identical re-import', () => {
    const diff = diffSheets(level5, parseDdbSheet(fixture.fields))
    expect(diff.hasChanges).toBe(false)
    expect(summarizeDiff(diff)).toBe('Sheet re-imported · no changes')
  })

  it('reports a level-up', () => {
    const diff = diffSheets(level5, levelUp())
    expect(diff.hasChanges).toBe(true)
    expect(diff.classLevel).toEqual({ from: 'Bard 5', to: 'Bard 6' })
    expect(diff.level).toEqual({ from: 5, to: 6 })
    expect(diff.maxHp).toEqual({ from: 38, to: 45 })
    expect(diff.slots).toEqual([{ level: 3, from: 2, to: 3 }])
    expect(diff.abilities).toEqual([{ key: 'cha', from: 18, to: 20 }])
    expect(diff.spells).toEqual({ added: ['Hypnotic Pattern'], removed: ['Sending'] })
    expect(diff.features).toEqual({ added: ['Mantle of Whispers'], removed: [] })
    expect(diff.items).toEqual({
      added: ['Potion of Healing'],
      removed: [],
      changed: [{ name: 'Oil', from: 10, to: 8 }],
    })
  })

  it('counts repeated item rows together', () => {
    const s = structuredClone(level5)
    s.inventory.items = s.inventory.items.filter((i, n, all) => !(i.name === 'Dagger' && all.findIndex((j) => j.name === 'Dagger') !== n))
    const diff = diffSheets(level5, s)
    expect(diff.items.changed).toEqual([{ name: 'Dagger', from: 2, to: 1 }])
  })

  it('treats a missing old sheet as everything new', () => {
    const diff = diffSheets(null, level5)
    expect(diff.spells.added).toHaveLength(22)
    expect(diff.level).toEqual({ from: null, to: 5 })
  })
})

describe('summarizeDiff', () => {
  it('writes the milestone line', () => {
    expect(summarizeDiff(diffSheets(level5, levelUp()))).toBe(
      'Bard 5 → 6 · Max HP 38 → 45 · 3rd-level slots 2 → 3 · CHA 18 → 20 · new: Hypnotic Pattern · dropped: Sending · features: Mantle of Whispers'
    )
  })

  it('spells out a multiclass change', () => {
    const s = structuredClone(level5)
    s.identity.classLevel = 'Bard 5 / Warlock 1'
    expect(summarizeDiff(diffSheets(level5, s))).toBe('Bard 5 → Bard 5 / Warlock 1')
  })

  it('falls back to item changes when nothing else moved', () => {
    const s = structuredClone(level5)
    s.inventory.items.push({ name: 'Rope', qty: 1, weight: '5 lb.' })
    expect(summarizeDiff(diffSheets(level5, s))).toBe('items: +Rope')
  })
})

describe('diffRows and proclamation', () => {
  const base = {
    classLevel: { from: 'Bard 5', to: 'Bard 6' },
    level: { from: 5, to: 6 },
    maxHp: { from: 38, to: 45 },
    profBonus: null,
    slots: [{ level: 3, from: 2, to: 3 }],
    abilities: [],
    spells: { added: ['Hypnotic Pattern'], removed: [] },
    features: { added: [], removed: ['Old Trick'] },
    items: { added: [], removed: [], changed: [] },
    hasChanges: true,
  }

  it('lists what moved, old beside new', () => {
    expect(diffRows(base)).toEqual([
      { label: 'Class', from: 'Bard 5', to: 'Bard 6' },
      { label: 'Hit points', from: '38', to: '45' },
      { label: '3rd-level slots', from: '2', to: '3' },
      { label: 'New spell', from: '—', to: 'Hypnotic Pattern' },
      { label: 'Features gone', from: 'Old Trick', to: '—' },
    ])
    expect(diffRows(null)).toEqual([])
  })

  it('announces a level gained, and otherwise an amendment', () => {
    const identity = { name: 'Nenise', classes: [{ class: 'Bard', level: 6 }] }
    expect(proclamation(base, identity)).toEqual({ lead: 'that Nenise, Bard, is risen to the', title: 'Sixth Level' })
    expect(proclamation({ ...base, level: null }, identity).title).toBeNull()
    expect(proclamation({ ...base, level: null }, identity).lead).toMatch(/amended/)
    expect(proclamation({ hasChanges: false }, identity).lead).toMatch(/stands as it was/)
  })
})
