import { describe, it, expect } from 'vitest'
import fixture from './__fixtures__/ddb-nenise.fixture.json'
import { parseDdbSheet, PARSER_VERSION } from './parseDdbSheet'
import {
  isEmptyDossierValue,
  planDossierFill,
  planItemEntities,
  planResources,
  cleanResources,
  buildSheetDoc,
  sheetData,
  estimateDocBytes,
  pickMilestoneSession,
  buildImportPlan,
  SHEET_DOC_BUDGET,
} from './importPlan'

const parsed = parseDdbSheet(fixture.fields)

function findUndefined(value, path = '') {
  if (value === undefined) return [path]
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => findUndefined(v, `${path}.${k}`))
  }
  return []
}

function findNestedArrays(value, path = '', inArray = false) {
  if (Array.isArray(value)) {
    if (inArray) return [path]
    return value.flatMap((v, i) => findNestedArrays(v, `${path}[${i}]`, true))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => findNestedArrays(v, `${path}.${k}`, false))
  }
  return []
}

describe('isEmptyDossierValue', () => {
  it('treats form defaults and blank rich text as empty', () => {
    expect(isEmptyDossierValue('name', '')).toBe(true)
    expect(isEmptyDossierValue('personality', '<p></p>')).toBe(true)
    expect(isEmptyDossierValue('level', 1)).toBe(true)
    expect(isEmptyDossierValue('abilities', { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })).toBe(true)
    expect(isEmptyDossierValue('abilities', undefined)).toBe(true)
  })

  it('treats anything written as filled', () => {
    expect(isEmptyDossierValue('name', 'Nenise')).toBe(false)
    expect(isEmptyDossierValue('personality', '<p>flirt</p>')).toBe(false)
    expect(isEmptyDossierValue('level', 3)).toBe(false)
    expect(isEmptyDossierValue('abilities', { str: 8 })).toBe(false)
  })
})

describe('planDossierFill', () => {
  it('fills every field of an empty dossier', () => {
    const { patch, kept } = planDossierFill(parsed, null)
    expect(patch).toMatchObject({
      name: 'Nenise',
      class: 'Bard',
      level: 5,
      ancestry: 'Tiefling',
      background: 'Cultist',
      abilities: { str: 8, dex: 14, con: 15, int: 8, wis: 12, cha: 18 },
    })
    expect(patch.personality).toBe(
      '<p>Ich bin ein hoffungloser Flirt und ich lenke gerne von mir selber ab und fokkusiere mich auf mein gegenüber.</p>' +
        '<p><strong>Ideals.</strong> Die Kunst steht über allem selbst über mein Leben.</p>'
    )
    expect(patch).not.toHaveProperty('backstory') // empty on the sheet
    expect(kept).toEqual([])
  })

  it('never overwrites what is already written', () => {
    const character = {
      name: 'Nen',
      class: '',
      level: 1,
      ancestry: 'tiefling, abyssal',
      personality: '<p>my own words</p>',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }
    const { patch, kept } = planDossierFill(parsed, character)
    expect(Object.keys(patch).sort()).toEqual(['abilities', 'background', 'class', 'level'])
    expect(kept.map((k) => k.key)).toEqual(['name', 'ancestry', 'personality'])
  })

  it('escapes sheet text as HTML', () => {
    const s = structuredClone(parsed)
    s.personality.traits = 'I <3 "trouble" & mischief'
    expect(planDossierFill(s, null).patch.personality).toMatch('<p>I &lt;3 &quot;trouble&quot; &amp; mischief</p>')
  })
})

describe('planItemEntities', () => {
  it('creates one entity per distinct item name', () => {
    const { create, existing } = planItemEntities(parsed, [])
    expect(create).toHaveLength(16)
    expect(create.filter((n) => n === 'Dagger')).toHaveLength(1)
    expect(existing).toEqual([])
  })

  it('skips names any entity already has, case-insensitively', () => {
    const { create, existing } = planItemEntities(parsed, [
      { name: 'dagger', type: 'item' },
      { name: 'Lute ', type: 'npc' },
    ])
    expect(create).not.toContain('Dagger')
    expect(existing).toEqual(['Dagger', 'Lute'])
  })
})

describe('planResources / cleanResources', () => {
  it('offers everything detected on a first import', () => {
    const rows = planResources(parsed, null)
    expect(rows.map((r) => r.id)).toContain('bardic-inspiration')
    expect(rows.every((r) => r.isNew)).toBe(true)
  })

  it('keeps my corrections on a re-import and only adds new detections', () => {
    const rows = planResources(parsed, [
      { id: 'bardic-inspiration', name: 'Inspiration', max: 4, reset: 'short' },
      { id: 'lucky', name: 'Lucky', max: 3, reset: 'long' },
    ])
    expect(rows[0]).toMatchObject({ id: 'bardic-inspiration', name: 'Inspiration', isNew: false, conflict: true })
    expect(rows[1]).toMatchObject({ id: 'lucky', isNew: false, origin: 'confirmed' })
    expect(rows.slice(2).every((r) => r.isNew)).toBe(true)
    expect(rows.filter((r) => r.id === 'bardic-inspiration')).toHaveLength(1)
  })

  it('cleans confirm-step rows for storage', () => {
    expect(
      cleanResources([
        { id: 'a', name: ' Rage ', max: '3', reset: 'long', evidence: [] },
        { name: 'Second Wind', max: 1.7, reset: 'short' },
        { name: '', max: 2, reset: 'long' },
        { name: 'Zero', max: 0, reset: 'long' },
        { id: 'a', name: 'Rage again', max: 1, reset: 'whatever' },
      ])
    ).toEqual([
      { id: 'a', name: 'Rage', max: 3, reset: 'long' },
      { id: 'second-wind', name: 'Second Wind', max: 1, reset: 'short' },
      { id: 'a-2', name: 'Rage again', max: 1, reset: 'long' },
    ])
  })
})

describe('buildSheetDoc / sheetData', () => {
  const doc = buildSheetDoc({ parsed, fields: fixture.fields, fileName: 'nenise.pdf' })

  it('keeps raw as the field list, with page and rect', () => {
    expect(doc.raw).toHaveLength(462)
    expect(doc.raw[0]).toEqual({ page: 1, fieldName: 'CharacterName', value: 'Nenise', rect: [47, 710, 221, 731] })
  })

  it('is storable in Firestore: no undefined, no nested arrays, well under 1 MiB', () => {
    expect(findUndefined(doc)).toEqual([])
    expect(findNestedArrays(doc)).toEqual([])
    expect(estimateDocBytes(doc)).toBeLessThan(SHEET_DOC_BUDGET)
    expect(estimateDocBytes(doc)).toBeLessThan(150 * 1024)
  })

  it('re-parses from raw when the stored parser version is old', () => {
    expect(sheetData({ ...doc, parserVersion: PARSER_VERSION })).toBe(parsed)
    const stale = { ...doc, parserVersion: 0, data: { stale: true } }
    expect(sheetData(stale)).toEqual(parsed)
    expect(sheetData(null)).toBeNull()
  })
})

describe('pickMilestoneSession', () => {
  it('prefers the live session, else the most recent', () => {
    expect(pickMilestoneSession([{ id: 'b' }, { id: 'a', status: 'live' }]).id).toBe('a')
    expect(pickMilestoneSession([{ id: 'b', status: 'ended' }, { id: 'a' }]).id).toBe('b')
    expect(pickMilestoneSession([])).toBeNull()
  })
})

describe('buildImportPlan', () => {
  it('plans a first import with no milestone', () => {
    const plan = buildImportPlan({ parsed, fields: fixture.fields, fileName: 'x.pdf', previousDoc: null, entities: [], sessions: [{ id: 's1' }] })
    expect(plan.isReimport).toBe(false)
    expect(plan.diff).toBeNull()
    expect(plan.milestone).toBeNull()
  })

  it('plans a level-up re-import with a milestone in the latest session', () => {
    const previousDoc = buildSheetDoc({ parsed, fields: fixture.fields })
    const next = structuredClone(parsed)
    next.identity.classLevel = 'Bard 6'
    next.identity.level = 6
    next.combat.maxHp = 45
    const plan = buildImportPlan({ parsed: next, fields: fixture.fields, previousDoc, entities: [], sessions: [{ id: 's2' }, { id: 's1' }] })
    expect(plan.isReimport).toBe(true)
    expect(plan.milestone).toEqual({ text: 'Bard 5 → 6 · Max HP 38 → 45', session: { id: 's2' } })
  })

  it('writes no milestone when a re-import changes nothing', () => {
    const previousDoc = buildSheetDoc({ parsed, fields: fixture.fields })
    const plan = buildImportPlan({ parsed, fields: fixture.fields, previousDoc, entities: [], sessions: [{ id: 's1' }] })
    expect(plan.milestone).toBeNull()
  })
})
