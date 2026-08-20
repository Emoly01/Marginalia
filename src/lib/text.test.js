import { describe, it, expect } from 'vitest'
import { stripHtml, excerptFrom, initials } from './text'

describe('stripHtml', () => {
  it('drops tags and collapses whitespace', () => {
    expect(stripHtml('<p>Greenest   in</p><p>Flames</p>')).toBe('Greenest in Flames')
  })

  it('decodes the entities Tiptap emits', () => {
    expect(stripHtml('<p>Tav &amp; Eya &lt;3 &quot;the mask&quot;</p>')).toBe('Tav & Eya <3 "the mask"')
  })

  it('handles empty input', () => {
    expect(stripHtml('')).toBe('')
    expect(stripHtml(null)).toBe('')
  })
})

describe('excerptFrom', () => {
  it('returns short text unchanged', () => {
    expect(excerptFrom('<p>Nesim kept the mask.</p>')).toBe('Nesim kept the mask.')
  })

  it('clips long text on a word boundary', () => {
    const words = 'lorem ipsum '.repeat(40)
    const out = excerptFrom(`<p>${words}</p>`, 40)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(41)
    expect(out).not.toMatch(/\s…$/)
  })

  it('clips mid-word only when there is no usable break', () => {
    const out = excerptFrom('<p>' + 'a'.repeat(200) + '</p>', 20)
    expect(out).toBe('a'.repeat(20) + '…')
  })
})

describe('initials', () => {
  it('takes the first and last initial', () => {
    expect(initials('Emily Wilisch')).toBe('EW')
    expect(initials('Ada Beatrice Lovelace')).toBe('AL')
  })

  it('handles a single name', () => {
    expect(initials('Tav')).toBe('T')
  })

  it('falls back for missing or blank names', () => {
    expect(initials('')).toBe('·')
    expect(initials(null)).toBe('·')
    expect(initials('   ')).toBe('·')
  })
})
