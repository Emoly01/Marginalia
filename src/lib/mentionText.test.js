import { describe, it, expect } from 'vitest'
import { splitMentions, stripAt, mentionedEntities } from './mentionText'

const anselm = { id: 'e1', name: 'Brother Anselm', aliases: ['Anselm'] }
const vell = { id: 'e2', name: 'Vell' }
const kael = { id: 'e3', name: 'Kael' }

describe('splitMentions', () => {
  it('links @-names that match an entity, longest name first', () => {
    expect(splitMentions('@Brother Anselm keeps the bell-loft.', [anselm, vell])).toEqual([
      { text: 'Brother Anselm', mention: true, entity: anselm },
      { text: ' keeps the bell-loft.' },
    ])
  })

  it('matches aliases and is case-insensitive', () => {
    const parts = splitMentions('Ask @anselm about @Vell.', [anselm, vell])
    expect(parts.filter((p) => p.mention).map((p) => [p.text, p.entity?.id])).toEqual([
      ['anselm', 'e1'],
      ['Vell', 'e2'],
    ])
  })

  it('still highlights an unknown @Name, without a link', () => {
    expect(splitMentions('Met @Ysolde Marrow today', [])).toEqual([
      { text: 'Met ' },
      { text: 'Ysolde Marrow', mention: true, entity: null },
      { text: ' today' },
    ])
  })

  it('leaves e-mail-ish and lower-case @ alone, and plain text intact', () => {
    expect(splitMentions('no mention here')).toEqual([{ text: 'no mention here' }])
    expect(splitMentions('cost @ 5 gp')).toEqual([{ text: 'cost @ 5 gp' }])
    expect(stripAt('The bells of @Vell')).toBe('The bells of Vell')
  })
})

describe('mentionedEntities', () => {
  it('finds @-mentions and plain names as whole words', () => {
    expect(mentionedEntities('Anselm: “The bells of @Vell don’t ring.”', [anselm, vell, kael])).toEqual([vell, anselm])
    expect(mentionedEntities('Kaelith is someone else', [kael])).toEqual([])
    expect(mentionedEntities('nothing', [anselm])).toEqual([])
  })
})
