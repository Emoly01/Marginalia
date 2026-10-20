import { describe, it, expect } from 'vitest'
import fixture from './__fixtures__/ddb-nenise.fixture.json'
import {
  parseDdbSheet,
  parseClassLevel,
  parseHitDice,
  parseSpellLevelHeader,
  parseSlotHeader,
  parseSpells,
  parseFeatures,
  parseFreeUse,
} from './parseDdbSheet'

const sheet = parseDdbSheet(fixture.fields)
const skill = (key) => sheet.skills.find((s) => s.key === key)
const spell = (name) => sheet.spells.find((s) => s.name === name)
const feature = (name) => sheet.features.find((f) => f.name === name)

describe('identity', () => {
  it('reads name, class, species and background', () => {
    expect(sheet.identity).toMatchObject({
      name: 'Nenise',
      classLevel: 'Bard 5',
      classes: [{ class: 'Bard', level: 5 }],
      level: 5,
      species: 'Tiefling',
      background: 'Cultist',
      xp: '(Milestone)',
      alignment: 'Chaotic Good',
      faith: "Graz'zt",
      height: '1,80',
    })
  })

  it('parses multiclass levels', () => {
    expect(parseClassLevel('Bard 3 / Warlock 2')).toEqual([
      { class: 'Bard', level: 3 },
      { class: 'Warlock', level: 2 },
    ])
    expect(parseClassLevel('Blood Hunter 4')).toEqual([{ class: 'Blood Hunter', level: 4 }])
    expect(parseClassLevel('')).toEqual([])
  })

  it('accepts the readPdfFields() result as well as a bare list', () => {
    expect(parseDdbSheet({ fields: fixture.fields }).identity.name).toBe('Nenise')
  })
})

describe('abilities and saves', () => {
  it('reads scores, modifiers (incl. the "CHamod" spelling) and saves', () => {
    expect(sheet.abilities.str).toEqual({ score: 8, mod: -1, save: -1, saveProficient: false })
    expect(sheet.abilities.dex).toEqual({ score: 14, mod: 2, save: 5, saveProficient: true })
    expect(sheet.abilities.cha).toEqual({ score: 18, mod: 4, save: 7, saveProficient: true })
  })
})

describe('skills', () => {
  it('lists all eighteen', () => {
    expect(sheet.skills).toHaveLength(18)
  })

  it('reads P / E / H proficiency marks', () => {
    expect(skill('arcana')).toMatchObject({ bonus: 2, proficiency: 'proficient', ability: 'int' })
    expect(skill('performance')).toMatchObject({ bonus: 10, proficiency: 'expertise', ability: 'cha' })
    expect(skill('acrobatics')).toMatchObject({ bonus: 3, proficiency: 'half', ability: 'dex' })
  })

  it('handles the irregular Animal Handling and Sleight of Hand fields', () => {
    expect(skill('animalHandling')).toMatchObject({ bonus: 2, proficiency: 'half', ability: 'wis' })
    expect(skill('sleightOfHand')).toMatchObject({ bonus: 5, proficiency: 'proficient', ability: 'dex' })
  })

  it('reads a value field with a trailing space ("Stealth ")', () => {
    expect(skill('stealth').bonus).toBe(3)
  })
})

describe('combat block', () => {
  it('reads the core numbers', () => {
    expect(sheet.combat).toMatchObject({
      ac: 15,
      initiative: 2,
      speed: '30 ft. (Walking)',
      profBonus: 3,
      maxHp: 38,
      tempHp: 0,
      hitDice: { total: '5d8', dice: [{ count: 5, die: 8 }] },
      passives: { perception: 14, insight: 14, investigation: 10 },
      senses: 'Darkvision 60 ft.',
      defenses: 'Resistances - Poison, Fire',
    })
  })

  it('parses multiclass hit dice', () => {
    expect(parseHitDice('3d8 + 2d10')).toEqual([
      { count: 3, die: 8 },
      { count: 2, die: 10 },
    ])
  })
})

describe('proficiencies', () => {
  it('splits the sectioned block', () => {
    expect(sheet.proficiencies).toEqual({
      armor: ['Light Armor'],
      weapons: ['Simple Weapons'],
      tools: ["Calligrapher's Supplies", 'Flute', 'Harp', 'Lyre'],
      languages: ['Abyssal', 'Common', 'Draconic', 'Elvish'],
    })
  })
})

describe('attacks', () => {
  it('matches the irregular Wpn field names', () => {
    expect(sheet.attacks).toEqual([
      { name: 'Dagger', bonus: '+5', damage: '1d4+2 Piercing', notes: 'Simple, Finesse, Light, Thrown, Nick, Range (20/60)' },
      { name: 'Eldritch Blast', bonus: '+7', damage: '1d10 Force', notes: 'Count: 2, V/S' },
      { name: 'Poison Spray', bonus: '+7', damage: '2d12 Poison', notes: 'V/S' },
      { name: 'Unarmed Strike', bonus: '+2', damage: '0 Bludgeoning', notes: '' },
    ])
  })
})

describe('actions', () => {
  it('splits sections and keeps the usage tag', () => {
    const names = sheet.actions.map((a) => [a.section, a.name, a.uses])
    expect(names).toEqual([
      ['action', 'Standard Actions', ''],
      ['bonus', 'Bardic Inspiration', '4 / Short Rest'],
      ['reaction', 'Familiar Distraction', '3 / Long Rest'],
      ['special', 'Pluck the Heartstrings: Defense', ''],
    ])
  })

  it('keeps a sentence that lost its indent at a box break as description', () => {
    const bi = sheet.actions.find((a) => a.name === 'Bardic Inspiration')
    expect(bi.text).toMatch(/^As a Bonus Action/)
    expect(bi.text).toMatch(/4 times per Long Rest\.$/)
  })
})

describe('features', () => {
  it('splits the joined boxes into features under their group headers', () => {
    expect(sheet.features).toHaveLength(23)
    const groups = [...new Set(sheet.features.map((f) => f.group))]
    expect(groups).toEqual(['Bard Features', 'Tiefling Species Traits', 'Feats'])
  })

  it('rejoins a sentence split across boxes 1 and 2', () => {
    expect(feature('Chilling Melody').text).toBe(
      'You learn two Necromancy cantrips of your choice. These count as Bard spells for you but don’t count against the number of cantrips you know.'
    )
  })

  it('carries a feature across pages (box 3 → 4 → 5)', () => {
    const fk = feature('Familiar Keeper')
    expect(fk.text).toMatch(/^You gain the following benefits\./)
    expect(fk.text).toMatch(/Find Familiar\. You always have the Find Familiar spell prepared\./)
    expect(fk.notes).toContain('Familiar Distraction: 3 / Long Rest • 1 Reaction')
    expect(feature('Cult Initiate').text).toMatch(/using any spell slots you have\./)
  })

  it('reads source and page, including features without a page', () => {
    expect(feature('Bardic Inspiration')).toMatchObject({ group: 'Bard Features', source: 'PHB-2024 59' })
    expect(feature('Size').source).toBe('PHB-2024')
    expect(feature('Infernal Pact').source).toBe('DDBD')
  })

  it('keeps "|" option lines as notes, out of the text', () => {
    expect(feature('Bard Subclass')).toMatchObject({ text: '', notes: ['College of Requiems'] })
    expect(feature('Bardic Inspiration').text).not.toMatch(/\|/)
  })

  it('does not split on "•" bullets inside a feature', () => {
    expect(feature('Infernal Pact').text).toMatch(/• You gain proficiency in the Deception skill\.$/)
  })

  it('works on text without a group header', () => {
    expect(parseFeatures('* Lucky • PHB 1\nYou are lucky.')).toEqual([
      { name: 'Lucky', group: '', source: 'PHB 1', text: 'You are lucky.', notes: [] },
    ])
  })
})

describe('inventory', () => {
  it('reads currency, items with qty and weight, and carrying', () => {
    const inv = sheet.inventory
    expect(inv.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 263, pp: 0 })
    expect(inv.items).toHaveLength(18)
    expect(inv.items[0]).toEqual({ name: 'Glamoured Studded Leather', qty: 1, weight: '13 lb.' })
    expect(inv.items.find((i) => i.name === 'Oil')).toEqual({ name: 'Oil', qty: 10, weight: '10 lb.' })
    expect(inv.items.find((i) => i.name === 'Ink Pen').weight).toBe('')
    expect(inv.attuned).toEqual([])
    expect(inv.carried.weight).toBe('63 lb.')
  })
})

describe('personality', () => {
  it('reads page 4, including the "PersonalityTraits " name', () => {
    expect(sheet.personality.traits).toMatch(/^Ich bin ein hoffungloser Flirt/)
    expect(sheet.personality.ideals).toBe('Die Kunst steht über allem selbst über mein Leben.')
    expect(sheet.personality.bonds).toBe('')
  })
})

describe('spellcasting and slots', () => {
  it('reads the casting block', () => {
    expect(sheet.spellcasting).toEqual([{ class: 'Bard', ability: 'CHA', saveDC: 15, attackBonus: 7 }])
  })

  it('reads slot headers', () => {
    expect(parseSlotHeader('4 Slots OOOO')).toBe(4)
    expect(parseSlotHeader('(At Will)')).toBeNull()
    expect(parseSpellLevelHeader('=== CANTRIPS ===')).toBe(0)
    expect(parseSpellLevelHeader('=== 1st LEVEL ===')).toBe(1)
    expect(parseSpellLevelHeader('=== 3rd LEVEL ===')).toBe(3)
    expect(sheet.slots).toEqual({ 1: 4, 2: 3, 3: 2 })
  })
})

describe('spells', () => {
  it('assigns levels by the nearest header above, by rect', () => {
    const byLevel = {}
    for (const s of sheet.spells) (byLevel[s.level] ??= []).push(s.name)
    expect(byLevel[0]).toHaveLength(9)
    expect(byLevel[1]).toEqual([
      'Command',
      'Disguise Self',
      "Tasha's Hideous Laughter",
      'Find Familiar',
      'Speak with Animals',
      'Ray of Sickness',
    ])
    expect(byLevel[2]).toEqual(['Chorus of the Lost', 'Gift of Gab', 'Suggestion', 'Invisibility', 'Hold Person'])
    expect(byLevel[3]).toEqual(['Sending', 'Séance'])
  })

  it('dedupes repeated rows by name, keeping every distinct note', () => {
    expect(sheet.spells).toHaveLength(22)
    expect(sheet.spells.filter((s) => s.name === 'Find Familiar')).toHaveLength(1)
    expect(spell('Find Familiar')).toMatchObject({
      sources: ['Familiar Keeper (Always Prepared)'],
      notes: ['1/LR, V/S/M', 'V/S/M'],
      alwaysPrepared: true,
      freeUse: { max: 1, reset: 'long' },
    })
    expect(spell('Hold Person').notes).toEqual(['1/LR, D: 1m, V/S/M', 'D: 1m, V/S/M'])
  })

  it('keeps all sources when the same spell comes from several features', () => {
    const shift = (f, dy) => ({ ...f, rect: [f.rect[0], f.rect[1] + dy, f.rect[2], f.rect[3] + dy] })
    const extra = fixture.fields
      .filter((f) => /^spell[A-Za-z]+9$/.test(f.fieldName))
      .map((f) => shift({ ...f, fieldName: f.fieldName.replace(/9$/, '99'), value: f.fieldName === 'spellSource9' ? 'Cult Initiate' : f.value }, -0.5))
    const { spells } = parseSpells([...fixture.fields, ...extra])
    expect(spells.find((s) => s.name === 'Command').sources).toEqual(['Bard', 'Cult Initiate'])
  })

  it('keeps the row metadata, and no description text', () => {
    expect(spell('Tasha\'s Hideous Laughter')).toMatchObject({
      key: 'tashas-hideous-laughter',
      castingTime: '1A',
      range: '30 ft.',
      components: 'V,S,M',
      duration: 'Concentration, up to 1 minute',
      saveHit: 'WIS 15',
      reference: 'PHB-2024 331',
      concentration: true,
      alwaysPrepared: false,
    })
    expect(spell('Message').saveHit).toBe('')
    expect(Object.keys(spell('Message'))).not.toContain('description')
  })

  it('reads free casts from row notes', () => {
    expect(parseFreeUse('1/SR, D: 10m, V/S')).toEqual({ max: 1, reset: 'short' })
    expect(parseFreeUse('D: 1m, V/S/M')).toBeNull()
    expect(spell('Speak with Animals').freeUse).toEqual({ max: 1, reset: 'short' })
  })

  it('supports the unprefixed overflow scheme and carries the level into a new column', () => {
    const row = (n, x, y, name) => [
      { page: 6, fieldName: `SpellName${n}`, value: name, rect: [x, y, x + 106, y + 11] },
      { page: 6, fieldName: `CastingTime${n}`, value: '1A', rect: [x + 216, y, x + 235, y + 11] },
      { page: 6, fieldName: `Notes${n}`, value: 'V/S', rect: [x + 381, y, x + 537, y + 11] },
      { page: 6, fieldName: `Prepared${n}`, value: 'O', rect: [x - 13, y, x - 2, y + 11] },
    ]
    const fields = [
      { page: 6, fieldName: 'spellHeader7', value: '=== 4th LEVEL ===', rect: [42, 700, 148, 711] },
      { page: 6, fieldName: 'spellSlotHeader7', value: '2 Slots OO', rect: [149, 700, 231, 711] },
      ...row(0, 42, 688, 'Polymorph'),
      ...row(1, 42, 676, 'Greater Invisibility'),
      { page: 6, fieldName: 'spellHeader8', value: '=== 5th LEVEL ===', rect: [42, 100, 148, 111] },
      { page: 6, fieldName: 'spellSlotHeader8', value: '1 Slots O', rect: [149, 100, 231, 111] },
      // Right-hand column, no header above: still 5th level.
      ...row(2, 320, 700, 'Mislead'),
    ]
    const { spells, slots } = parseSpells(fields)
    expect(spells.map((s) => [s.name, s.level, s.castingTime])).toEqual([
      ['Polymorph', 4, '1A'],
      ['Greater Invisibility', 4, '1A'],
      ['Mislead', 5, '1A'],
    ])
    expect(slots).toEqual({ 4: 2, 5: 1 })
  })
})
