import { describe, it, expect } from 'vitest'
import { uninkedCounts, lastSeen, codexFilters } from './campaignHome'
import { dossierSummary } from './dossier'
import { sessionDuration, formatDuration, formatClock } from './sessionStatus'
import { selectDossierFill } from './sheet/importPlan'
import { ENTITY_TYPES } from './entities'

describe('campaign home', () => {
  it('counts typed lines still waiting to be inked', () => {
    expect(
      uninkedCounts([
        { sessionId: 's1', mark: 'note', inked: false },
        { sessionId: 's1', mark: 'npc', inked: false },
        { sessionId: 's1', mark: 'auto', auto: { type: 'hp' } },
        { sessionId: 's1', mark: 'note', inked: true },
        { sessionId: 's2', mark: 'mystery' },
      ])
    ).toEqual({ s1: 2, s2: 1 })
  })

  it('finds the latest session mentioning each entity', () => {
    expect(lastSeen([{ sessionNumber: 13, mentionIds: ['a', 'b'] }, { sessionNumber: 14, mentionIds: ['a'] }, { sessionNumber: 2, mentionIds: ['b'] }])).toEqual({ a: 14, b: 13 })
  })

  it('builds codex filters with counts and plurals', () => {
    const f = codexFilters([{ type: 'npc' }, { type: 'npc' }, { type: 'location' }], ENTITY_TYPES)
    expect(f.slice(0, 3)).toEqual([
      { value: 'all', label: 'All', count: 3 },
      { value: 'npc', label: 'NPCs', count: 2 },
      { value: 'location', label: 'Places', count: 1 },
    ])
  })
})

describe('dossierSummary', () => {
  const sheet = {
    identity: { faith: "Graz'zt" },
    combat: { defenses: 'Resistances - Poison, Fire', senses: 'Darkvision 60 ft.' },
    proficiencies: { languages: ['Abyssal', 'Common'], tools: [] },
  }

  it('maps the design onto existing fields', () => {
    const d = dossierSummary(
      {
        goals: '<p>Become the choir’s voice.</p>',
        knowledgeOOC: '<p>The sigil is under the altar.</p>',
        relationships: [{ name: 'Ysolde', notes: 'trusted me with a letter', type: 'friend' }, { name: '' }],
      },
      sheet,
      [{ intention: '' }, { intention: 'Find out who sold my name.' }]
    )
    expect(d).toEqual({
      wants: 'Find out who sold my name.',
      wantsFrom: 'intention',
      bonds: [{ name: 'Ysolde', notes: 'trusted me with a letter', type: 'friend' }],
      secret: 'The sigil is under the altar.',
      facts: [
        { label: 'Faith', value: "Graz'zt" },
        { label: 'Defenses', value: 'Resistances - Poison, Fire' },
        { label: 'Senses', value: 'Darkvision 60 ft.' },
        { label: 'Languages', value: 'Abyssal, Common' },
      ],
    })
  })

  it('falls back to goals, and copes with nothing at all', () => {
    expect(dossierSummary({ goals: '<p>Rest.</p>' }, null, []).wants).toBe('Rest.')
    expect(dossierSummary(null, null)).toEqual({ wants: '', wantsFrom: null, bonds: [], secret: '', facts: [] })
  })
})

describe('session durations', () => {
  it('measures a finished session and a live one', () => {
    const s = { status: 'ended', startedAt: new Date('2026-10-20T18:00:00Z'), endedAt: new Date('2026-10-20T21:04:00Z') }
    expect(formatDuration(sessionDuration(s))).toBe('3 h 04 m')
    const live = { status: 'live', startedAt: new Date(1000) }
    expect(formatClock(sessionDuration(live, 1000 + 3852000))).toBe('1:04:12')
    expect(sessionDuration({})).toBeNull()
    expect(formatDuration(42 * 60000)).toBe('42 m')
  })
})

describe('selectDossierFill', () => {
  it('keeps only the ticked fields', () => {
    const d = { patch: { name: 'N', class: 'Bard' }, filled: [{ key: 'name' }, { key: 'class' }], kept: [] }
    expect(selectDossierFill(d, ['class'])).toEqual({ patch: { class: 'Bard' }, filled: [{ key: 'class' }], kept: [] })
  })
})
