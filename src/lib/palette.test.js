import { describe, it, expect } from 'vitest'
import {
  PALETTE,
  DEFAULT_PALETTE_ID,
  paletteById,
  paletteFor,
  nearestPalette,
  hexToRgb,
  inkTokens,
  hexToOklch,
  contrastRatio,
  iconField,
} from './palette'
import { readGroundPref, resolveGround } from './ground'

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

describe('ink model', () => {

  it('keeps the accent hue as the rubric on both grounds', () => {
    for (const p of PALETTE) {
      const { H } = hexToOklch(p.hex)
      for (const ground of ['night', 'day']) {
        const accent = inkTokens(p, ground)['--m-accent']
        expect(Number(accent.match(/([\d.]+)\)$/)[1])).toBeCloseTo(H, 0)
      }
    }
  })

  it('keeps gold leaf the same for every campaign on the night ground', () => {
    const golds = PALETTE.map((p) => inkTokens(p, 'night')['--gold'])
    expect(new Set(golds).size).toBe(1)
  })

  it('never tints the text ramp with the ink', () => {
    const texts = PALETTE.map((p) => inkTokens(p, 'night')['--m-text'])
    expect(new Set(texts).size).toBe(1)
  })

  // WCAG AA: 4.5:1 for normal text. Checked for every ink, not just three.
  const pairs = [
    ['--m-text', ['--m-bg', '--m-panel', '--m-card', '--m-card-hi']],
    ['--m-text-2', ['--m-bg', '--m-panel', '--m-card', '--m-card-hi']],
    ['--m-text-3', ['--m-bg', '--m-panel', '--m-card']],
    ['--m-text-4', ['--m-bg', '--m-panel', '--m-card']],
    ['--m-accent', ['--m-bg', '--m-panel', '--m-card']],
    ['--m-accent-strong', ['--m-bg', '--m-panel', '--m-card', '--m-accent-wash']],
    ['--m-on-accent', ['--m-accent']],
    ['--m-danger', ['--m-bg', '--m-panel', '--m-card']],
  ]
  for (const ground of ['night', 'day']) {
    for (const p of PALETTE) {
      it(`meets AA on ${ground} vellum in ${p.name}`, () => {
        const t = inkTokens(p, ground)
        const failures = []
        for (const [fg, bgs] of pairs) {
          for (const bg of bgs) {
            const ratio = contrastRatio(t[fg], t[bg])
            if (ratio < 4.5) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`)
          }
        }
        // The ink on gold is drawn at display size (initials), so 3:1 (AA large).
        const initial = contrastRatio(t['--m-ink-on-gold'], t['--gold'])
        if (initial < 3) failures.push(`--m-ink-on-gold on --gold: ${initial.toFixed(2)}`)
        expect(failures).toEqual([])
      })
    }
  }

  it('computes contrast like WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('derives the icon field from the ink', () => {
    expect(iconField(paletteById('gold'))).toMatch(/^oklch\(0\.260 /)
  })

  it('reads the ground preference defensively', () => {
    expect(readGroundPref({ getItem: () => 'day' })).toBe('day')
    expect(readGroundPref({ getItem: () => 'chartreuse' })).toBe('night')
    expect(readGroundPref({ getItem: () => { throw new Error('blocked') } })).toBe('night')
    expect(readGroundPref(undefined)).toBe('night')
    expect(resolveGround('auto', 'table')).toBe('night')
    expect(resolveGround('auto', 'desk')).toBe('day')
    expect(resolveGround('day', 'table')).toBe('day')
  })
})
