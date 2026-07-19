import { describe, it, expect } from 'vitest'
import { contentMentions, extractMentionIds } from './mentions'

const mention = (id) =>
  `<span data-type="mention" data-id="${id}" data-label="Someone">@Someone</span>`

describe('contentMentions', () => {
  it('finds a mention by entity id', () => {
    const html = `<p>We met ${mention('abc123')} at the bridge.</p>`
    expect(contentMentions(html, 'abc123')).toBe(true)
  })

  it('returns false when the id is absent', () => {
    const html = `<p>We met ${mention('abc123')} at the bridge.</p>`
    expect(contentMentions(html, 'zzz999')).toBe(false)
  })

  it('handles empty content and missing ids', () => {
    expect(contentMentions('', 'abc')).toBe(false)
    expect(contentMentions(null, 'abc')).toBe(false)
    expect(contentMentions('<p>hi</p>', '')).toBe(false)
  })
})

describe('extractMentionIds', () => {
  it('extracts all mentioned ids in order', () => {
    const html = `<p>${mention('one')} and ${mention('two')}</p>`
    expect(extractMentionIds(html)).toEqual(['one', 'two'])
  })

  it('dedupes repeated mentions of the same entity', () => {
    const html = `<p>${mention('one')} again ${mention('one')} and ${mention('two')}</p>`
    expect(extractMentionIds(html)).toEqual(['one', 'two'])
  })

  it('returns an empty array for content without mentions', () => {
    expect(extractMentionIds('<p>plain prose</p>')).toEqual([])
    expect(extractMentionIds('')).toEqual([])
    expect(extractMentionIds(null)).toEqual([])
  })
})
