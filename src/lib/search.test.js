import { describe, it, expect } from 'vitest'
import fixture from './sheet/__fixtures__/ddb-nenise.fixture.json'
import { parseDdbSheet } from './sheet/parseDdbSheet'
import { buildSheetDoc } from './sheet/importPlan'
import { buildDocuments, createIndex, searchIndex, targetPath, snippet } from './search'

const parsed = parseDdbSheet(fixture.fields)
const league = buildDocuments({
  campaign: { id: 'c1', name: 'League of Ambivalence', shortName: 'League' },
  sessions: [
    { id: 's1', title: 'Session 4 — The Bell Tower', date: '2026-10-13', content: '<p>We climbed the <strong>bell tower</strong> and found the keeper dead.</p>' },
    { id: 's2', title: 'Session 5', date: '2026-10-20', content: '' },
  ],
  entities: [
    { id: 'e1', name: 'Gnarl', type: 'npc', aliases: ['the barkeep'], notes: '<p>grumpy bartender, knows the cult</p>' },
    { id: 'e2', name: 'Dagger', type: 'item', notes: '' },
  ],
  margins: [{ id: 'm1', text: 'ask the DM about the drowned choir', archived: false }],
  log: [
    { id: 'l1', sessionId: 's2', text: 'who rang the bell at midnight', mark: 'mystery', auto: null },
    { id: 'l2', sessionId: 's2', text: 'took 9 damage · 38 → 29', mark: 'auto', auto: { type: 'hp' } },
  ],
  character: { personality: '<p>A hopeless flirt.</p>', goals: '', relationships: [{ id: 'r1', name: 'Vex', type: 'rival', notes: 'never trust' }] },
  sheetDoc: buildSheetDoc({ parsed, fields: fixture.fields }),
  spellNotes: { 'hold-person': 'paralyses humanoids, ends on a save each turn' },
})
const other = buildDocuments({
  campaign: { id: 'c2', name: 'Curse of Strahd' },
  sessions: [{ id: 'x1', title: 'Death House', content: '<p>The bell in the attic.</p>' }],
})
const index = createIndex([...league, ...other])
const titles = (groups, type) => groups.find((g) => g.type === type)?.results.map((r) => r.title) ?? []

describe('buildDocuments', () => {
  it('indexes every source, minus tracker taps and duplicate sheet items', () => {
    const types = new Set(league.map((d) => d.type))
    expect([...types].sort()).toEqual(['attack', 'dossier', 'entity', 'feature', 'item', 'log', 'margin', 'session', 'spell'])
    expect(league.some((d) => d.title.startsWith('took 9 damage'))).toBe(false)
    expect(league.filter((d) => d.type === 'item').map((d) => d.title)).not.toContain('Dagger')
    expect(league.filter((d) => d.type === 'spell')).toHaveLength(22)
  })

  it('strips HTML from sessions, notes and the dossier', () => {
    expect(league.find((d) => d.id === 'c1:session:s1').text).toBe('We climbed the bell tower and found the keeper dead.')
    expect(league.find((d) => d.id === 'c1:dossier:personality').text).toBe('A hopeless flirt.')
  })
})

describe('searchIndex', () => {
  it('finds by prefix', () => {
    expect(titles(searchIndex(index, 'hold pers', { campaignId: 'c1' }), 'spell')).toEqual(['Hold Person'])
  })

  it('forgives typos', () => {
    expect(titles(searchIndex(index, 'gnral', { campaignId: 'c1' }), 'entity')).toEqual(['Gnarl'])
    expect(titles(searchIndex(index, 'tashas laughter', { campaignId: 'c1' }), 'spell')).toEqual(["Tasha's Hideous Laughter"])
  })

  it('only goes fuzzy when nothing matches exactly', () => {
    const groups = searchIndex(index, 'flirt', { campaignId: 'c1' })
    expect(groups.map((g) => g.type)).toEqual(['dossier'])
  })

  it('keeps short terms strict', () => {
    expect(titles(searchIndex(index, 'ball', { campaignId: 'c1' }), 'session')).toEqual([])
  })

  it('searches aliases, entity notes, margins, log lines and my spell notes', () => {
    expect(titles(searchIndex(index, 'barkeep', { campaignId: 'c1' }), 'entity')).toEqual(['Gnarl'])
    expect(titles(searchIndex(index, 'drowned choir', { campaignId: 'c1' }), 'margin')).toHaveLength(1)
    expect(titles(searchIndex(index, 'midnight', { campaignId: 'c1' }), 'log')).toEqual(['who rang the bell at midnight'])
    expect(titles(searchIndex(index, 'paralyses', { campaignId: 'c1' }), 'spell')).toEqual(['Hold Person'])
  })

  it('groups results in a fixed order', () => {
    const groups = searchIndex(index, 'bell', { campaignId: 'c1' })
    expect(groups.map((g) => g.type)).toEqual(['session', 'log'])
    expect(groups[0].label).toBe('Sessions')
  })

  it('stays in the current campaign unless asked for all', () => {
    expect(titles(searchIndex(index, 'bell', { campaignId: 'c1' }), 'session')).not.toContain('Death House')
    expect(titles(searchIndex(index, 'bell'), 'session')).toContain('Death House')
  })

  it('ignores one-letter queries', () => {
    expect(searchIndex(index, 'b')).toEqual([])
  })
})

describe('targetPath', () => {
  const find = (id) => league.find((d) => d.id === id)
  it('jumps to where each result lives', () => {
    expect(targetPath(find('c1:session:s1'))).toBe('/campaigns/c1/sessions/s1')
    expect(targetPath(find('c1:entity:e1'))).toBe('/campaigns/c1/entities/e1')
    expect(targetPath(find('c1:log:l1'))).toBe('/campaigns/c1/sessions/s2')
    expect(targetPath(find('c1:dossier:personality'))).toBe('/campaigns/c1?tab=character')
    expect(targetPath(find('c1:margin:m1'))).toBe('/campaigns/c1')
    expect(targetPath(find('c1:spell:hold-person'))).toBe('/campaigns/c1/table?tab=spells&spell=hold-person')
    expect(targetPath(find('c1:attack:0'))).toBe('/campaigns/c1/table?tab=attacks')
  })
})

describe('snippet', () => {
  const long = 'Lorem ipsum dolor sit amet. '.repeat(10) + 'The bell keeper was smiling when we found him. ' + 'Filler text. '.repeat(10)
  it('centres on the first matching term', () => {
    const s = snippet(long, 'keeper', 80)
    expect(s.startsWith('…')).toBe(true)
    expect(s).toContain('keeper')
  })

  it('falls back to the opening, and leaves short text alone', () => {
    expect(snippet(long, 'zzz', 40)).toBe('Lorem ipsum dolor sit amet. Lorem ipsum…')
    expect(snippet('short', 'x')).toBe('short')
  })
})
