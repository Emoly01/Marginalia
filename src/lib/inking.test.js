import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  mentionHtml,
  isEmptyHtml,
  appendHtml,
  buildQueue,
  autoTimeline,
  suggestEntity,
  recapFragment,
  entityNotesFragment,
  recallPrompts,
  recallFragment,
  recallChips,
  suggestLinks,
  recapBlocks,
} from './inking'
import { extractMentionIds } from './mentions'

const gnarl = { id: 'e1', name: 'Gnarl' }

describe('html helpers', () => {
  it('escapes everything typed', () => {
    expect(escapeHtml(`<b>"Vex" & Tav's</b>`)).toBe('&lt;b&gt;&quot;Vex&quot; &amp; Tav&#39;s&lt;/b&gt;')
  })

  it('renders mentions exactly like the editor, so backlinks find them', () => {
    const html = mentionHtml(gnarl)
    expect(html).toBe('<span data-type="mention" data-id="e1" data-label="Gnarl" class="marginalia-mention">@Gnarl</span>')
    expect(extractMentionIds(`<p>${html}</p>`)).toEqual(['e1'])
    expect(mentionHtml({ id: 'x', name: 'The "Choir"' })).toContain('data-label="The &quot;Choir&quot;"')
  })

  it('appends to content, replacing an empty document', () => {
    expect(isEmptyHtml('<p></p>')).toBe(true)
    expect(isEmptyHtml('')).toBe(true)
    expect(isEmptyHtml('<p>x</p>')).toBe(false)
    expect(appendHtml('<p></p>', '<p>a</p>')).toBe('<p>a</p>')
    expect(appendHtml('<p>x</p>', '<p>a</p>')).toBe('<p>x</p><p>a</p>')
  })
})

describe('buildQueue / autoTimeline', () => {
  const entries = [
    { id: 'b', text: 'second', mark: 'note', auto: null, clientAt: 2, inked: false },
    { id: 'a', text: 'first', mark: 'mystery', auto: null, clientAt: 1, inked: false },
    { id: 'c', text: 'took 9 damage', mark: 'auto', auto: { type: 'hp' }, clientAt: 3, inked: false },
    { id: 'd', text: 'done already', mark: 'note', auto: null, clientAt: 4, inked: true },
    { id: 'e', text: 'Bard 5 → 6', mark: 'milestone', auto: null, clientAt: 5, inked: false },
  ]
  const margins = [
    { id: 'm1', text: 'ask the DM about the bell', archived: false },
    { id: 'm2', text: 'old', archived: true },
  ]

  it('queues un-inked typed lines in order, then active margins', () => {
    expect(buildQueue(entries, margins).map((q) => q.key)).toEqual(['log:a', 'log:b', 'log:e', 'margin:m1'])
  })

  it('puts tracker entries on the timeline instead', () => {
    expect(autoTimeline(entries).map((e) => e.id)).toEqual(['c'])
  })
})

describe('suggestEntity', () => {
  it('keeps NPC names and maps marks to types', () => {
    expect(suggestEntity({ text: 'Gnarl — grumpy bartender', mark: 'npc' })).toEqual({ type: 'npc', name: 'Gnarl', notes: 'grumpy bartender' })
    expect(suggestEntity({ text: 'Silver key: opens the crypt', mark: 'loot' })).toEqual({ type: 'item', name: 'Silver key', notes: 'opens the crypt' })
    expect(suggestEntity({ text: 'who rang the bell', mark: 'mystery' })).toEqual({ type: 'thread', name: '', notes: 'who rang the bell' })
  })
})

describe('recapFragment', () => {
  it('adds a line as a paragraph, and a quote as a blockquote', () => {
    expect(recapFragment('We <ran>.', { action: 'recap', mark: 'note' })).toBe('<p>We &lt;ran&gt;.</p>')
    expect(recapFragment('"Bells do not ring themselves."', { action: 'recap', mark: 'quote' })).toBe(
      '<blockquote><p>&quot;Bells do not ring themselves.&quot;</p></blockquote>'
    )
  })

  it('leads with a mention for entity actions, without repeating the name', () => {
    const html = recapFragment('Gnarl — grumpy bartender, knows the cult', { action: 'link', mark: 'npc', entity: gnarl })
    expect(html).toBe(`<p>${mentionHtml(gnarl)} — grumpy bartender, knows the cult</p>`)
    expect(recapFragment('owes us a favour', { action: 'entity', entity: gnarl })).toBe(`<p>${mentionHtml(gnarl)} — owes us a favour</p>`)
    expect(recapFragment('Gnarl', { action: 'entity', entity: gnarl })).toBe(`<p>${mentionHtml(gnarl)}</p>`)
  })
})

describe('entityNotesFragment', () => {
  it('cites the session', () => {
    expect(entityNotesFragment('lied about the bell', { title: 'Session 5' })).toBe('<p>lied about the bell <em>(Session 5)</em></p>')
  })
})

describe('recall', () => {
  it('names the character in the prompts', () => {
    expect(recallPrompts('Nenise')[2]).toBe('What does Nenise want now?')
    expect(recallPrompts('')[2]).toBe('What does my character want now?')
  })

  it('writes one heading per answered prompt', () => {
    const prompts = recallPrompts('Nenise')
    expect(recallFragment(prompts, ['Gnarl', '', '', '', 'In the crypt.\n\nAt midnight.'])).toBe(
      '<h3>Who did we meet?</h3><p>Gnarl</p><h3>Where did it end?</h3><p>In the crypt.</p><p>At midnight.</p>'
    )
    expect(recallFragment(prompts, [])).toBe('')
  })
})

describe('recapBlocks', () => {
  it('reads the recap back as text blocks, mentions as plain names', () => {
    const html = `<p>We met ${mentionHtml(gnarl)} &amp; ran.</p><blockquote><p>"Run."</p></blockquote><h3>Where did it end?</h3><p>crypt<br>at night</p>`
    expect(recapBlocks(html)).toEqual([
      { kind: 'text', text: 'We met Gnarl & ran.' },
      { kind: 'text', text: '"Run."' },
      { kind: 'heading', text: 'Where did it end?' },
      { kind: 'text', text: 'crypt\nat night' },
    ])
  })
})

describe('recallChips', () => {
  const entries = [
    { id: '1', text: 'Gnarl — grumpy bartender', mark: 'npc', clientAt: 1 },
    { id: '2', text: 'Why does the choir sing at low tide?', mark: 'mystery', clientAt: 2 },
    { id: '3', text: 'took 7 damage', mark: 'auto', auto: { type: 'hp' }, clientAt: 3 },
    { id: '4', text: 'met @Brother Anselm', mark: 'note', entityId: 'e9', clientAt: 4 },
    { id: '5', text: 'Silver tuning fork from the reliquary', mark: 'loot', clientAt: 5 },
    { id: '6', text: 'Kneeling under the altar', mark: 'important', clientAt: 6 },
  ]
  const ctx = { entries, session: { intention: 'Find out who sold my name.' }, entities: [{ id: 'e9', name: 'Brother Anselm', type: 'npc' }] }

  it('borrows only what was written at the table', () => {
    expect(recallChips(0, ctx)).toEqual(['Gnarl', 'Brother Anselm'])
    expect(recallChips(1, ctx)).toEqual(['Why does the choir sing at low tide?', 'Kneeling under the altar'])
    expect(recallChips(2, ctx)).toEqual(['Find out who sold my name.'])
    expect(recallChips(3, ctx)).toEqual(['Silver tuning fork from the reliquary'])
    expect(recallChips(4, ctx)).toEqual(['Kneeling under the altar'])
    expect(recallChips(2, { entries })).toEqual([])
  })
})

describe('suggestLinks', () => {
  const anselm = { id: 'e1', name: 'Brother Anselm', aliases: ['Anselm'] }
  const vell = { id: 'e2', name: 'Vell' }
  it('puts the captured entity first, then what the line names', () => {
    expect(suggestLinks({ text: 'Anselm: “The bells of @Vell”', entityId: null }, [anselm, vell])).toEqual([vell, anselm])
    expect(suggestLinks({ text: 'the bells of Vell', entityId: 'e1' }, [anselm, vell])).toEqual([anselm, vell])
  })
})

describe('mentions inside appended lines', () => {
  const vell = { id: 'e2', name: 'Vell' }
  it('turns @Names that match an entity into editor mentions', () => {
    const html = recapFragment('The bells of @Vell ring for @Nobody', { action: 'recap', mark: 'note', entities: [vell] })
    expect(html).toBe(`<p>The bells of ${mentionHtml(vell)} ring for Nobody</p>`)
    expect(extractMentionIds(html)).toEqual(['e2'])
  })

  it('does not repeat an @-mentioned name after its own mention', () => {
    expect(recapFragment('@Gnarl lied about the bell', { action: 'link', entity: gnarl, entities: [gnarl] })).toBe(
      `<p>${mentionHtml(gnarl)} — lied about the bell</p>`
    )
  })
})
