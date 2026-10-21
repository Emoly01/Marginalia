import { describe, it, expect } from 'vitest'
import { parseCapture, findEntityByName, markLabel } from './capture'
import { sessionStatus, findLiveSession, findPreviousSession, sessionBadge } from './sessionStatus'

describe('parseCapture', () => {
  it('uses the toggled mark when there is no prefix', () => {
    expect(parseCapture('the bell rang twice', 'mystery')).toEqual({ mark: 'mystery', text: 'the bell rang twice', npc: null })
    expect(parseCapture('plain')).toEqual({ mark: 'note', text: 'plain', npc: null })
  })

  it('lets a prefix override the toggle', () => {
    expect(parseCapture('q: "Nothing is free, little bard."', 'loot')).toMatchObject({ mark: 'quote', text: '"Nothing is free, little bard."' })
    expect(parseCapture('?: who sent the letter')).toMatchObject({ mark: 'mystery', text: 'who sent the letter' })
    expect(parseCapture('!: Vex is lying')).toMatchObject({ mark: 'important' })
    expect(parseCapture('$: 40 gp and a silver key')).toMatchObject({ mark: 'loot', text: '40 gp and a silver key' })
    expect(parseCapture('NPC: Gnarl')).toMatchObject({ mark: 'npc' })
  })

  it('parses NPC lines with the roster’s "Name — descriptor" rules', () => {
    expect(parseCapture('npc: Gnarl — grumpy bartender, knows the cult')).toEqual({
      mark: 'npc',
      text: 'Gnarl — grumpy bartender, knows the cult',
      npc: { name: 'Gnarl', notes: 'grumpy bartender, knows the cult' },
    })
    expect(parseCapture('Jean-Luc', 'npc').npc).toEqual({ name: 'Jean-Luc', notes: '' })
  })

  it('ignores empty input and a bare prefix', () => {
    expect(parseCapture('   ')).toBeNull()
    expect(parseCapture('q:')).toBeNull()
    expect(parseCapture('npc: — just a descriptor')).toEqual({ mark: 'npc', text: '— just a descriptor', npc: { name: '— just a descriptor', notes: '' } })
  })

  it('falls back to note for an unknown or app-only mark', () => {
    expect(parseCapture('x', 'auto').mark).toBe('note')
  })

  it('lets me tag a typed line as a milestone', () => {
    expect(parseCapture('Fifth level at last', 'milestone')).toEqual({ mark: 'milestone', text: 'Fifth level at last', npc: null })
  })
})

describe('findEntityByName / markLabel', () => {
  it('matches names case-insensitively', () => {
    expect(findEntityByName([{ id: 'a', name: 'Gnarl ' }], 'gnarl')?.id).toBe('a')
    expect(findEntityByName([], 'gnarl')).toBeNull()
  })

  it('labels marks in words', () => {
    expect(markLabel('npc')).toBe('NPC')
    expect(markLabel('auto')).toBe('sheet')
  })
})

describe('session lifecycle', () => {
  const sessions = [
    { id: 's3', status: 'live' },
    { id: 's2', status: 'ended' },
    { id: 's1' }, // legacy
  ]

  it('treats sessions without a status as inked', () => {
    expect(sessionStatus({})).toBe('inked')
    expect(sessionStatus({ status: 'weird' })).toBe('inked')
    expect(sessionBadge({})).toBeNull()
  })

  it('finds the live session and the one before it', () => {
    expect(findLiveSession(sessions).id).toBe('s3')
    expect(findPreviousSession(sessions).id).toBe('s2')
    expect(findLiveSession([{ id: 'x' }])).toBeNull()
    expect(findPreviousSession([])).toBeNull()
  })

  it('badges live and un-inked sessions', () => {
    expect(sessionBadge(sessions[0])).toBe('live')
    expect(sessionBadge(sessions[1])).toBe('to ink')
  })
})
