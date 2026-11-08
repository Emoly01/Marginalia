import { describe, it, expect } from 'vitest'
import { questionKey, questionId, questionSentences, findQuestions, questionsInHtml, collectQuestions, sortByStatus, sourceLabel } from './questions'

describe('questionSentences', () => {
  it('picks out the sentences ending in a question mark', () => {
    expect(questionSentences('We reached the bridge. Who rang the bell? Nobody knows. Was it @Gnarl?!')).toEqual([
      'Who rang the bell?',
      'Was it @Gnarl?!',
    ])
  })

  it('takes a ?: line whole, question mark or not', () => {
    expect(questionSentences('?: the bell tower — who has the key')).toEqual(['the bell tower — who has the key'])
  })

  it('skips one-word questions and plain statements', () => {
    expect(questionSentences('Why? Because.')).toEqual([])
    expect(questionSentences('Nothing to ask here.')).toEqual([])
    expect(questionSentences('')).toEqual([])
  })

  it('keeps closing quotes with the question', () => {
    expect(questionSentences('She asked “where is the key?” and left.')).toEqual(['She asked “where is the key?”'])
  })
})

describe('findQuestions', () => {
  it('keeps the sentence before a question as its context', () => {
    expect(findQuestions('Gnarl paid in old crowns. Where would he get those? And why now?')).toEqual([
      { text: 'Where would he get those?', context: 'Gnarl paid in old crowns.' },
      { text: 'And why now?', context: '' },
    ])
  })

  it('clips long context from the front', () => {
    const long = `${'word '.repeat(60)}end.`
    const [q] = findQuestions(`${long} What then?`)
    expect(q.context.startsWith('…')).toBe(true)
    expect(q.context.length).toBeLessThanOrEqual(142)
    expect(q.context.endsWith('end.')).toBe(true)
  })
})

describe('questionsInHtml', () => {
  it('reads paragraphs and list items, not headings or quotes', () => {
    const html =
      '<h3>Who did we meet?</h3><p>Met <span data-type="mention" data-id="e1" class="marginalia-mention">@Gnarl</span>. Is he lying to us?</p>' +
      '<blockquote><p>Do you know who I am?</p></blockquote><ul><li><p>Where did the map go?</p></li></ul>'
    expect(questionsInHtml(html)).toEqual(['Is he lying to us?', 'Where did the map go?'])
  })

  it('handles plain text and empty bodies', () => {
    expect(questionsInHtml('Who is the masked lady?')).toEqual(['Who is the masked lady?'])
    expect(questionsInHtml('<p></p>')).toEqual([])
    expect(questionsInHtml(null)).toEqual([])
  })

  it('decodes entities and line breaks', () => {
    expect(questionsInHtml('<p>Fish &amp; chips<br>or the &quot;bell&quot; tower?</p>')).toEqual(['Fish & chips or the "bell" tower?'])
  })
})

describe('questionKey / questionId', () => {
  it('ignores case, spacing, @, prefix and trailing punctuation', () => {
    expect(questionKey('?:  Who rang   the bell?!')).toBe('who rang the bell')
    expect(questionKey('Is @Gnarl lying?')).toBe(questionKey('is gnarl lying'))
  })

  it('gives a stable id that is safe as a doc id', () => {
    const id = questionId(questionKey('Who rang the bell?'))
    expect(id).toBe(questionId('who rang the bell'))
    expect(id).toMatch(/^q[0-9a-z]+$/)
    expect(id).not.toBe(questionId('who rang the other bell'))
  })
})

describe('collectQuestions', () => {
  const sessions = [
    { id: 's1', sessionNumber: 1, title: 'The Bridge', date: '2026-10-01', content: '<p>Who rang the bell? We ran.</p>' },
    { id: 's2', sessionNumber: 2, title: 'The Bell', date: '2026-10-08', content: '<p>Who rang the bell?</p><blockquote><p>Are you lost, traveller?</p></blockquote>' },
  ]

  it('gathers from log, prose, codex and margins, and merges repeats', () => {
    const log = [
      { id: 'l1', sessionId: 's2', mark: 'mystery', text: 'the locked chapel', clientAt: Date.parse('2026-10-08T21:00:00Z') },
      { id: 'l2', sessionId: 's2', mark: 'note', text: 'Who rang the bell?', clientAt: Date.parse('2026-10-08T20:00:00Z') },
      { id: 'l3', sessionId: 's2', mark: 'quote', text: 'Do you yield, knight?' },
      { id: 'l4', sessionId: 's2', mark: 'auto', auto: { type: 'hp' }, text: 'took 4 damage?' },
      { id: 'l5', sessionId: 's2', mark: 'mystery', text: 'tossed one', inked: true, inkedAs: { action: 'toss' } },
      { id: 'l6', sessionId: 's2', mark: 'mystery', text: 'moved one', inked: true, inkedAs: { action: 'later' } },
    ]
    const entities = [{ id: 'e1', name: 'Gnarl', notes: '<p>Grumpy. What is he hiding?</p>' }]
    const margins = [
      { id: 'm1', text: 'Does the moon matter here?' },
      { id: 'm2', text: 'Old question, already used?', archived: true },
    ]
    const qs = collectQuestions({ sessions, log, entities, margins })
    const texts = qs.map((q) => q.text)
    expect(texts).toContain('the locked chapel')
    expect(texts).toContain('What is he hiding?')
    expect(texts).toContain('Does the moon matter here?')
    expect(texts).not.toContain('Are you lost, traveller?')
    expect(texts).not.toContain('Do you yield, knight?')
    expect(texts).not.toContain('tossed one')
    expect(texts).not.toContain('moved one')
    expect(texts).not.toContain('Old question, already used?')

    const bell = qs.find((q) => q.key === 'who rang the bell')
    // asked in session 1's prose, and in session 2 (log + prose = one place)
    expect(bell.sources.map((s) => s.sessionNumber).sort()).toEqual([1, 2])
    expect(qs.filter((q) => q.key === 'who rang the bell')).toHaveLength(1)
  })

  it('keeps a log line whole, and drops its echo in the recap', () => {
    const qs = collectQuestions({
      sessions: [{ id: 's9', sessionNumber: 9, date: '2026-11-01', content: '<p>Gnarl paid in old crowns. Where would he get those?</p>' }],
      log: [{ id: 'l9', sessionId: 's9', mark: 'note', text: 'Gnarl paid in old crowns. Where would he get those?', inked: true, inkedAs: { action: 'recap' } }],
    })
    expect(qs.map((q) => q.text)).toEqual(['Gnarl paid in old crowns. Where would he get those?'])
    expect(qs[0].sources).toHaveLength(1)
  })

  it('carries prose context through', () => {
    const [q] = collectQuestions({ sessions: [{ id: 's', sessionNumber: 1, content: '<p>The door was warm. Is something behind it?</p>' }] })
    expect(q).toMatchObject({ text: 'Is something behind it?', context: 'The door was warm.' })
  })

  it('sorts newest first', () => {
    const qs = collectQuestions({ sessions })
    expect(qs).toHaveLength(1)
    expect(qs[0].sources[0].sessionId).toBe('s2')
  })

  it('copes with nothing at all', () => {
    expect(collectQuestions()).toEqual([])
  })
})

describe('sortByStatus / sourceLabel', () => {
  it('splits open, answered and set-aside questions', () => {
    const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const r = sortByStatus(qs, { b: { status: 'answered', answer: 'Mara did' }, c: { status: 'aside' }, d: { status: 'weird' } })
    expect(r.open.map((q) => q.id)).toEqual(['a', 'd'])
    expect(r.answered[0]).toMatchObject({ id: 'b', mark: { answer: 'Mara did' } })
    expect(r.aside.map((q) => q.id)).toEqual(['c'])
  })

  it('names where a question was written', () => {
    expect(sourceLabel({ kind: 'session', sessionNumber: 4 })).toBe('Session 4')
    expect(sourceLabel({ kind: 'log', sessionTitle: 'Untitled' })).toBe('Untitled')
    expect(sourceLabel({ kind: 'entity', entityName: 'Gnarl' })).toBe('Gnarl')
    expect(sourceLabel({ kind: 'margin' })).toBe('Margins')
  })
})
