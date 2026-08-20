import { describe, it, expect } from 'vitest'
import {
  PALETTE,
  DEFAULT_PALETTE_ID,
  paletteById,
  paletteFor,
  nearestPalette,
  hexToRgb,
} from './palette'

describe('hexToRgb', () => {
  it('parses six-digit hex', () => {
    expect(hexToRgb('#d8bc7e')).toEqual([216, 188, 126])
  })

  it('expands three-digit shorthand', () => {
    expect(hexToRgb('#abc')).toEqual([170, 187, 204])
  })

  it('tolerates a missing hash and stray whitespace', () => {
    expect(hexToRgb('  d8bc7e ')).toEqual([216, 188, 126])
  })

  it('returns null for junk', () => {
    expect(hexToRgb('not-a-colour')).toBeNull()
    expect(hexToRgb('')).toBeNull()
    expect(hexToRgb(undefined)).toBeNull()
  })
})

describe('nearestPalette', () => {
  it('matches an exact palette colour to itself', () => {
    for (const p of PALETTE) {
      expect(nearestPalette(p.hex).id).toBe(p.id)
    }
  })

  it('snaps a near-miss to the closest swatch', () => {
    // The old "forest" accent, a little greener than the new sage.
    expect(nearestPalette('#8a9a7b').id).toBe('sage')
  })

  it('falls back to the default for an unparseable colour', () => {
    expect(nearestPalette('rebeccapurple').id).toBe(DEFAULT_PALETTE_ID)
  })
})

describe('paletteFor', () => {
  it('prefers the stored palette id', () => {
    expect(paletteFor({ palette: 'teal', theme: 'ember', color: '#8a9a7b' }).id).toBe('teal')
  })

  it('migrates every legacy theme to a palette', () => {
    const legacy = {
      parchment: 'gold',
      forest: 'sage',
      noir: 'steel',
      ember: 'rust',
      twilight: 'plum',
      bone: 'bone',
      rose: 'rose',
    }
    for (const [theme, expected] of Object.entries(legacy)) {
      expect(paletteFor({ theme }).id).toBe(expected)
    }
  })

  it('falls back to the stored colour when there is no theme', () => {
    expect(paletteFor({ color: '#9b8aa4' }).id).toBe('plum')
  })

  it('defaults to gold for a campaign with no colour information at all', () => {
    expect(paletteFor({}).id).toBe(DEFAULT_PALETTE_ID)
    expect(paletteFor(null).id).toBe(DEFAULT_PALETTE_ID)
  })

  it('ignores a palette id that is not in the palette', () => {
    expect(paletteFor({ palette: 'chartreuse' }).id).toBe(DEFAULT_PALETTE_ID)
  })
})

describe('paletteById', () => {
  it('returns null rather than a default for unknown ids', () => {
    expect(paletteById('nope')).toBeNull()
  })

  it('gives every palette a hue, chroma factor and hex', () => {
    for (const p of PALETTE) {
      expect(hexToRgb(p.hex)).not.toBeNull()
      expect(p.hue).toBeGreaterThanOrEqual(0)
      expect(p.hue).toBeLessThan(360)
      expect(p.chroma).toBeGreaterThan(0)
    }
  })
})
