// Marginalia palettes
//
// A campaign picks one of ten accent colours. Every surface, border and text
// tone in the app is then derived from that accent by walking a fixed
// lightness/chroma ramp in OKLCH, so the whole UI is tinted by the campaign
// you are inside without any per-theme colour being hand-authored.
//
// `chroma` scales the ramp's saturation per palette — bone is nearly neutral,
// rust leans hard into its hue.

export const PALETTE = [
  { id: 'gold', name: 'gold', hex: '#d8bc7e', hue: 85, chroma: 1 },
  { id: 'ochre', name: 'ochre', hex: '#c9a15c', hue: 76, chroma: 1.05 },
  { id: 'rust', name: 'rust', hex: '#c07a55', hue: 46, chroma: 1.1 },
  { id: 'rose', name: 'rose', hex: '#bd8f96', hue: 12, chroma: 0.95 },
  { id: 'plum', name: 'plum', hex: '#a98bb0', hue: 318, chroma: 0.9 },
  { id: 'indigo', name: 'indigo', hex: '#8b8fc4', hue: 285, chroma: 0.95 },
  { id: 'steel', name: 'steel', hex: '#8aa3bd', hue: 250, chroma: 0.9 },
  { id: 'teal', name: 'teal', hex: '#7fae9f', hue: 172, chroma: 0.9 },
  { id: 'sage', name: 'sage', hex: '#9aae8b', hue: 138, chroma: 0.9 },
  { id: 'bone', name: 'bone', hex: '#c2bbaa', hue: 90, chroma: 0.35 },
]

export const DEFAULT_PALETTE_ID = 'gold'

// [lightness, chroma] pairs; chroma is multiplied by the palette's factor.
const RAMP = {
  '--m-bg': [0.17, 0.01],
  '--m-panel': [0.185, 0.013],
  '--m-card': [0.215, 0.016],
  '--m-card-hi': [0.25, 0.022],
  '--m-line': [0.265, 0.014],
  '--m-line-2': [0.315, 0.018],
  '--m-line-3': [0.385, 0.022],
  '--m-text': [0.925, 0.02],
  '--m-text-2': [0.8, 0.024],
  '--m-text-3': [0.7, 0.026],
  '--m-text-4': [0.64, 0.024],
  '--m-input': [0.15, 0.01],
  '--m-accent-ink': [0.2, 0.03],
}

// Campaigns created before the palette system stored a named theme and a
// separate accent hex. Map the old themes onto their nearest new palette so
// existing campaigns keep looking like themselves.
const LEGACY_THEMES = {
  parchment: 'gold',
  forest: 'sage',
  noir: 'steel',
  ember: 'rust',
  twilight: 'plum',
  bone: 'bone',
  rose: 'rose',
}

export function paletteById(id) {
  return PALETTE.find((p) => p.id === id) || null
}

/**
 * Parse "#rgb" or "#rrggbb" into [r, g, b]. Returns null if unparseable.
 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null
  const raw = hex.trim().replace(/^#/, '')
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/**
 * The palette whose accent sits closest to an arbitrary hex colour.
 * Used to rescue campaigns that only ever stored a `color`.
 */
export function nearestPalette(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return paletteById(DEFAULT_PALETTE_ID)
  let best = PALETTE[0]
  let bestDist = Infinity
  for (const p of PALETTE) {
    const [r, g, b] = hexToRgb(p.hex)
    const dist = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  return best
}

/**
 * Resolve whichever colour information a campaign doc happens to carry into a
 * palette: the new `palette` field first, then the legacy `theme`, then the
 * legacy `color`, then the default.
 */
export function paletteFor(campaign) {
  if (!campaign) return paletteById(DEFAULT_PALETTE_ID)
  const direct = paletteById(campaign.palette)
  if (direct) return direct
  const legacy = paletteById(LEGACY_THEMES[campaign.theme])
  if (legacy) return legacy
  if (campaign.color) return nearestPalette(campaign.color)
  return paletteById(DEFAULT_PALETTE_ID)
}

/**
 * Write a palette's derived ramp onto the document root.
 * Pass null to clear the overrides and fall back to the gold defaults in CSS.
 */
export function applyPalette(palette) {
  const root = document.documentElement
  if (!palette) {
    Object.keys(RAMP).forEach((token) => root.style.removeProperty(token))
    root.style.removeProperty('--m-accent')
    return
  }
  Object.entries(RAMP).forEach(([token, [l, c]]) => {
    const chroma = (c * palette.chroma).toFixed(4)
    root.style.setProperty(token, `oklch(${l} ${chroma} ${palette.hue})`)
  })
  root.style.setProperty('--m-accent', palette.hex)
}
