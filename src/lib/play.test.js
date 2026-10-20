import { describe, it, expect } from 'vitest'
import fixture from './sheet/__fixtures__/ddb-nenise.fixture.json'
import { parseDdbSheet } from './sheet/parseDdbSheet'
import * as play from './play'

const sheet = parseDdbSheet(fixture.fields)
const resources = [
  { id: 'bardic-inspiration', name: 'Bardic Inspiration', max: 4, reset: 'short' },
  { id: 'familiar-distraction', name: 'Familiar Distraction', max: 3, reset: 'long' },
]
const derive = (p = {}) => play.derivePlayState(sheet, { resources, ...p })

// Run an action and apply its patch, the way the hook does.
function step(p, action, ...args) {
  const result = action(derive(p), ...args)
  return result ? play.applyPatch({ resources, ...p }, result.patch) : p
}

describe('derivePlayState', () => {
  it('treats a missing play doc as fresh: full HP, nothing spent', () => {
    const s = play.derivePlayState(sheet, null)
    expect(s.hp).toEqual({ current: 38, max: 38, temp: 0 })
    expect(s.slots).toEqual([
      { level: 1, max: 4, used: 0, left: 4 },
      { level: 2, max: 3, used: 0, left: 3 },
      { level: 3, max: 2, used: 0, left: 2 },
    ])
    expect(s.hitDice).toMatchObject({ max: 5, used: 0, left: 5 })
    expect(s.resources).toEqual([])
  })

  it('clamps stored values to the sheet’s maxima (e.g. after a re-import)', () => {
    const s = derive({ hpCurrent: 99, slotsUsed: { 3: 7 }, resourcesUsed: { 'bardic-inspiration': 9 }, hitDiceUsed: 8 })
    expect(s.hp.current).toBe(38)
    expect(s.slots[2]).toMatchObject({ used: 2, left: 0 })
    expect(s.resources[0]).toMatchObject({ used: 4, left: 0 })
    expect(s.hitDice.left).toBe(0)
  })
})

describe('HP', () => {
  it('takes damage from temp HP first, never below 0', () => {
    const r = play.damage(derive({ hpTemp: 5 }), 9)
    expect(r.patch).toEqual({ hpCurrent: 34, hpTemp: 0 })
    expect(play.describeLog(r.log)).toBe('took 9 damage (5 to temp HP) · 38 → 34')
    expect(play.damage(derive({ hpCurrent: 3 }), 10).patch.hpCurrent).toBe(0)
    expect(play.damage(derive(), 0)).toBeNull()
  })

  it('heals up to max, storing full as null', () => {
    expect(play.heal(derive({ hpCurrent: 30 }), 5).patch).toEqual({ hpCurrent: 35 })
    expect(play.heal(derive({ hpCurrent: 30 }), 50).patch).toEqual({ hpCurrent: null })
    expect(play.heal(derive(), 5)).toBeNull()
  })

  it('clears death saves when healed from 0', () => {
    const r = play.heal(derive({ hpCurrent: 0, deathSaves: { successes: 1, failures: 2 } }), 4)
    expect(r.patch).toEqual({ hpCurrent: 4, deathSaves: { successes: 0, failures: 0 } })
  })

  it('sets temp HP', () => {
    expect(play.setTemp(derive(), 8).patch).toEqual({ hpTemp: 8 })
    expect(play.setTemp(derive({ hpTemp: 8 }), 8)).toBeNull()
  })
})

describe('slots and resources', () => {
  it('spends and restores slots within bounds', () => {
    let p = step({}, play.spendSlot, 3)
    p = step(p, play.spendSlot, 3)
    expect(p.slotsUsed).toEqual({ 3: 2 })
    expect(play.spendSlot(derive(p), 3)).toBeNull()
    expect(play.spendSlot(derive(p), 9)).toBeNull()
    p = step(p, play.restoreSlot, 3)
    expect(p.slotsUsed).toEqual({ 3: 1 })
    expect(play.restoreSlot(derive(), 1)).toBeNull()
  })

  it('logs slot use with what is left', () => {
    expect(play.describeLog(play.spendSlot(derive(), 2).log)).toBe('spent a 2nd-level slot (2/3 left)')
  })

  it('spends and restores resources within bounds', () => {
    const r = play.spendResource(derive(), 'bardic-inspiration')
    expect(r.patch).toEqual({ 'resourcesUsed.bardic-inspiration': 1 })
    expect(play.describeLog(r.log)).toBe('used Bardic Inspiration (3/4 left)')
    expect(play.spendResource(derive({ resourcesUsed: { 'familiar-distraction': 3 } }), 'familiar-distraction')).toBeNull()
    expect(play.restoreResource(derive(), 'bardic-inspiration')).toBeNull()
    expect(play.spendResource(derive(), 'nope')).toBeNull()
  })
})

describe('rests', () => {
  const tired = {
    hpCurrent: 12,
    hpTemp: 3,
    slotsUsed: { 1: 2, 2: 1 },
    resourcesUsed: { 'bardic-inspiration': 4, 'familiar-distraction': 2 },
    hitDiceUsed: 1,
  }

  it('short rest restores short-rest resources only', () => {
    const r = play.shortRest(derive(tired))
    expect(r.patch).toEqual({ 'resourcesUsed.bardic-inspiration': 0 })
    expect(play.describeLog(r.log)).toBe('short rest · regained Bardic Inspiration')
  })

  it('short rest can spend hit dice for the healing rolled at the table', () => {
    const r = play.shortRest(derive(tired), { hitDiceSpent: 2, healed: 11 })
    expect(r.patch).toMatchObject({ hitDiceUsed: 3, hpCurrent: 23 })
    expect(play.describeLog(r.log)).toBe('short rest · regained Bardic Inspiration · spent 2 hit dice · 12 → 23')
    expect(play.shortRest(derive(tired), { hitDiceSpent: 9, healed: 1 }).patch.hitDiceUsed).toBe(5)
  })

  it('long rest restores everything (2024)', () => {
    const p = step(tired, play.longRest)
    const s = derive(p)
    expect(s.hp).toEqual({ current: 38, max: 38, temp: 0 })
    expect(s.slots.every((x) => x.used === 0)).toBe(true)
    expect(s.resources.every((x) => x.used === 0)).toBe(true)
    expect(s.hitDice.used).toBe(0)
  })
})

describe('conditions, concentration, death saves', () => {
  it('toggles conditions', () => {
    let p = step({}, play.toggleCondition, 'Poisoned')
    expect(p.conditions).toEqual(['Poisoned'])
    p = step(p, play.toggleCondition, 'Poisoned')
    expect(p.conditions).toEqual([])
    expect(play.describeLog(play.toggleCondition(derive(), 'Prone').log)).toBe('now Prone')
  })

  it('sets and drops concentration', () => {
    const r = play.setConcentration(derive(), 'Hold Person')
    expect(r.patch).toEqual({ concentration: 'Hold Person' })
    expect(play.describeLog(r.log)).toBe('concentrating on Hold Person')
    const drop = play.setConcentration(derive({ concentration: 'Hold Person' }), null)
    expect(play.describeLog(drop.log)).toBe('dropped concentration on Hold Person')
    expect(play.setConcentration(derive(), null)).toBeNull()
  })

  it('counts death saves up to three each', () => {
    let p = step({}, play.deathSave, 'failure')
    p = step(p, play.deathSave, 'success')
    expect(p.deathSaves).toEqual({ successes: 1, failures: 1 })
    expect(play.deathSave(derive({ deathSaves: { successes: 3, failures: 0 } }), 'success')).toBeNull()
    expect(step(p, play.deathSave, 'reset').deathSaves).toEqual({ successes: 0, failures: 0 })
  })
})

describe('applyPatch', () => {
  it('applies field paths without mutating the input', () => {
    const before = { slotsUsed: { 1: 1 } }
    const after = play.applyPatch(before, { 'slotsUsed.2': 1, hpTemp: 4 })
    expect(after).toEqual({ slotsUsed: { 1: 1, 2: 1 }, hpTemp: 4 })
    expect(before).toEqual({ slotsUsed: { 1: 1 } })
    expect(play.applyPatch(null, { 'resourcesUsed.x': 2 })).toEqual({ resourcesUsed: { x: 2 } })
  })
})
