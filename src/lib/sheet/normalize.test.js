import { describe, it, expect } from 'vitest'
import {
  normalizeFieldName,
  buildFieldMap,
  caseInsensitiveLookup,
  cleanValue,
  parseNumber,
  spellKey,
  joinBoxes,
  numberedValues,
} from './normalize'

describe('normalizeFieldName', () => {
  it('trims and collapses the stray spaces D&D Beyond leaves in names', () => {
    expect(normalizeFieldName('DEXmod ')).toBe('DEXmod')
    expect(normalizeFieldName('Stealth ')).toBe('Stealth')
    expect(normalizeFieldName('Wpn2 AtkBonus  ')).toBe('Wpn2 AtkBonus')
    expect(normalizeFieldName('CLASS  LEVEL')).toBe('CLASS LEVEL')
    expect(normalizeFieldName('PersonalityTraits ')).toBe('PersonalityTraits')
  })

  it('handles missing names', () => {
    expect(normalizeFieldName(undefined)).toBe('')
    expect(normalizeFieldName(null)).toBe('')
  })
})

describe('buildFieldMap / caseInsensitiveLookup', () => {
  const map = buildFieldMap([
    { fieldName: 'CHamod', value: '+4' },
    { fieldName: 'SleightofHand', value: '+5' },
    { fieldName: 'Stealth ', value: '+3' },
  ])

  it('keys the map by normalized name', () => {
    expect(map).toEqual({ CHamod: '+4', SleightofHand: '+5', Stealth: '+3' })
  })

  it('looks names up regardless of case and spacing', () => {
    const get = caseInsensitiveLookup(map)
    expect(get('CHAmod')).toBe('+4')
    expect(get('SleightOfHand')).toBe('+5')
    expect(get(' Stealth')).toBe('+3')
    expect(get('Nope')).toBeUndefined()
  })
})

describe('cleanValue / parseNumber', () => {
  it('treats "--" as empty', () => {
    expect(cleanValue('--')).toBe('')
    expect(cleanValue('  Bard ')).toBe('Bard')
    expect(parseNumber('--')).toBeNull()
  })

  it('reads signed and leading numbers', () => {
    expect(parseNumber('+5')).toBe(5)
    expect(parseNumber('-1')).toBe(-1)
    expect(parseNumber('−2')).toBe(-2)
    expect(parseNumber('38')).toBe(38)
    expect(parseNumber('30 ft. (Walking)')).toBe(30)
    expect(parseNumber('(Milestone)')).toBeNull()
  })
})

describe('spellKey', () => {
  it('makes a stable, Firestore-safe key', () => {
    expect(spellKey("Tasha's Hideous Laughter")).toBe('tashas-hideous-laughter')
    expect(spellKey('Séance')).toBe('seance')
    expect(spellKey('  Find   Familiar ')).toBe('find-familiar')
    expect(spellKey('Find Familiar')).toBe(spellKey('find familiar'))
  })
})

describe('joinBoxes', () => {
  it('continues a sentence split across boxes with a space', () => {
    expect(joinBoxes(['These count but don’t count', 'against the number.'])).toBe(
      'These count but don’t count against the number.'
    )
  })

  it('starts a new paragraph after a finished sentence or before a feature', () => {
    expect(joinBoxes(['Ends here. ', 'Next paragraph.'])).toBe('Ends here.\n\nNext paragraph.')
    expect(joinBoxes(['mid sentence', '* Speed • PHB-2024 197'])).toBe('mid sentence\n\n* Speed • PHB-2024 197')
  })

  it('skips empty boxes', () => {
    expect(joinBoxes(['a.', '', '  ', 'b.'])).toBe('a.\n\nb.')
  })
})

describe('numberedValues', () => {
  it('returns numbered fields in numeric, not lexical, order', () => {
    const map = { FeaturesTraits10: 'j', FeaturesTraits2: 'b', FeaturesTraits1: 'a', FeaturesTraitsX: 'x' }
    expect(numberedValues(map, 'FeaturesTraits')).toEqual(['a', 'b', 'j'])
  })
})
