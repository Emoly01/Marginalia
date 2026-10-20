import { describe, it, expect } from 'vitest'
import fixture from './__fixtures__/ddb-nenise.fixture.json'
import { parseDdbSheet } from './parseDdbSheet'
import { detectResources, parseUsesTag, findUsesInProse } from './resources'

const resources = detectResources(parseDdbSheet(fixture.fields))
const byId = (id) => resources.find((r) => r.id === id)

describe('parseUsesTag', () => {
  it('reads D&D Beyond usage tags', () => {
    expect(parseUsesTag('4 / Short Rest')).toEqual({ max: 4, reset: 'short' })
    expect(parseUsesTag('Familiar Distraction: 3 / Long Rest • 1 Reaction')).toEqual({ max: 3, reset: 'long' })
    expect(parseUsesTag('1 Bonus Action')).toBeNull()
  })
})

describe('findUsesInProse', () => {
  it('reads numbers and number words', () => {
    expect(findUsesInProse('You can confer your die 4 times per Long Rest.')).toMatchObject([{ max: 4, reset: 'long' }])
    expect(findUsesInProse('up to 3 times per Long Rest')).toMatchObject([{ max: 3, reset: 'long' }])
    expect(findUsesInProse('once per Long Rest, you can')).toMatchObject([{ max: 1, reset: 'long' }])
    expect(findUsesInProse('twice per Short or Long Rest')).toMatchObject([{ max: 2, reset: 'short' }])
    expect(findUsesInProse('when you finish a Long Rest')).toEqual([])
  })
})

describe('detectResources', () => {
  it('finds the fixture’s limited-use resources', () => {
    expect(resources.map((r) => [r.name, r.max, r.reset])).toEqual([
      ['Bardic Inspiration', 4, 'short'],
      ['Familiar Distraction', 3, 'long'],
      ['Find Familiar (free cast)', 1, 'long'],
      ['Speak with Animals (free cast)', 1, 'short'],
      ['Ray of Sickness (free cast)', 1, 'long'],
      ['Hold Person (free cast)', 1, 'long'],
    ])
  })

  it('prefers the usage tag over stale rules text, and flags the disagreement', () => {
    const bi = byId('bardic-inspiration')
    expect(bi).toMatchObject({ max: 4, reset: 'short', origin: 'action', conflict: true })
    expect(bi.evidence.map((e) => e.origin)).toEqual(['action', 'feature', 'action-text', 'feature-text'])
    expect(bi.evidence.some((e) => /4 times per Long Rest/.test(e.text))).toBe(true)
  })

  it('does not flag a resource whose evidence agrees', () => {
    expect(byId('familiar-distraction').conflict).toBe(false)
  })

  it('does not invent resources from loose feature prose', () => {
    expect(byId('familiar-keeper')).toBeUndefined()
    expect(byId('cult-initiate')).toBeUndefined()
  })

  it('uses action prose when there is no tag', () => {
    const r = detectResources({
      actions: [{ section: 'special', name: 'Lucky', uses: '', text: 'You can do this 3 times per Long Rest.' }],
    })
    expect(r).toMatchObject([{ id: 'lucky', name: 'Lucky', max: 3, reset: 'long', origin: 'action-text' }])
  })

  it('names a bare feature tag after its feature', () => {
    const r = detectResources({
      features: [{ name: 'Second Wind', group: 'Fighter Features', text: '', notes: ['2 / Short Rest • 1 Bonus Action'] }],
    })
    expect(r).toMatchObject([{ id: 'second-wind', max: 2, reset: 'short', origin: 'feature' }])
  })

  it('handles an empty sheet', () => {
    expect(detectResources({})).toEqual([])
  })
})
