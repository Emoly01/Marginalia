// Marginalia palettes — the illuminator's ink.
//
// A campaign picks one of ten accents. That accent becomes the rubric: the
// ink of headings, initials, rules, active states and the margin ruling.
// The grounds (night vellum, day vellum) lean slightly toward its hue; gold
// leaf and the warm-neutral text ramp never change, so body contrast holds
// for every campaign. All of it is derived in OKLCH from the accent's hue
// and chroma by the rule in the design handoff — nothing is hand-picked.

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
export const GROUNDS = ['night', 'day']

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

// ---------------------------------------------------------------- OKLCH

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** "#rrggbb" → { L, C, H } (OKLCH, H in degrees). */
export function hexToOklch(hex) {
  const [r, g, b] = (hexToRgb(hex) ?? [0, 0, 0]).map((v) => toLinear(v / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B), H: (((Math.atan2(B, A) * 180) / Math.PI) + 360) % 360 }
}

/** OKLCH → [r, g, b] in 0–1 sRGB, clipped to gamut. */
export function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return rgb.map((v) => Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))))
}

/** Parse the "oklch(L C H)" strings this module writes. */
export function parseOklch(value) {
  const m = String(value).match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/)
  return m ? { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) } : null
}

/** WCAG 2 contrast ratio of two colours given as hex or "oklch(…)" strings. */
export function contrastRatio(a, b) {
  const lum = (v) => {
    const o = parseOklch(v)
    const rgb = o ? oklchToRgb(o.L, o.C, o.H) : (hexToRgb(v) ?? [0, 0, 0]).map((x) => x / 255)
    const [r, g, bl] = rgb.map(toLinear)
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ------------------------------------------------------------- ink rule

const o = (l, c, h) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// Move hue a toward hue b by t, the short way round.
const mixHue = (a, b, t) => {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

// Gold leaf on the night ground is the same for every campaign.
const NIGHT_GOLD = { '--gold': '#d8bc7e', '--gold-hi': '#f3e3b4', '--gold-lo': '#9a7838' }

/**
 * The full token set for a palette on a ground, as { '--token': value }.
 *
 * Night: ground hue = vellum 78° moved 25% toward the ink; bg L .165, panel
 * .195, card .228, line .36; accent L .76 with C capped at .10.
 * Day: ground hue = vellum 82° moved 20% toward the ink; bg L .935, panel
 * .955, card .975, line .78; iron-gall text L .24 → .56; accent L .49 with
 * C clamp(1.5·C, .07, .15).
 *
 * Beyond the handoff: `--m-text-4` sits at L .63 (night) / .51 (day) instead
 * of .58 / .56, the smallest change that lets it clear WCAG AA (4.5:1) on
 * every ground surface for every ink; `--m-card-hi` (hover) is added; and the
 * phase-1 names `--m-line-3`, `--m-input` and `--m-accent-ink` stay as aliases.
 */
export function inkTokens(palette, ground = 'night') {
  const p = palette ?? paletteById(DEFAULT_PALETTE_ID)
  const { C, H } = hexToOklch(p.hex)
  let t
  if (ground === 'day') {
    const g = mixHue(82, H, 0.2)
    const accentC = clamp(C * 1.5, 0.07, 0.15)
    t = {
      '--m-bg': o(0.935, 0.03, g),
      '--m-panel': o(0.955, 0.022, g),
      '--m-card': o(0.975, 0.014, g),
      '--m-card-hi': o(0.915, 0.03, g),
      '--m-line': o(0.78, 0.035, g),
      '--m-line-2': o(0.87, 0.028, g),
      '--m-text': o(0.24, 0.025, 50),
      '--m-text-2': o(0.34, 0.03, 50),
      '--m-text-3': o(0.45, 0.03, 55),
      '--m-text-4': o(0.51, 0.03, 60),
      '--m-accent': o(0.49, accentC, H),
      '--m-accent-strong': o(0.42, accentC, H),
      '--m-accent-wash': o(0.91, Math.min(C * 0.5, 0.04), H),
      '--m-on-accent': o(0.97, 0.01, H),
      '--m-ink-on-gold': o(0.34, clamp(C * 1.2, 0.05, 0.12), H),
      '--m-danger': o(0.5, 0.16, 28),
      '--gold': o(0.78, 0.11, 82),
      '--gold-hi': o(0.9, 0.07, 92),
      '--gold-lo': o(0.56, 0.09, 70),
      '--gold-line': o(0.62, 0.09, 78),
      '--bg-image':
        'radial-gradient(ellipse at 15% 0%, oklch(1 0 0 / .55), transparent 55%), radial-gradient(ellipse at 92% 100%, oklch(.7 .06 70 / .2), transparent 60%)',
    }
  } else {
    const g = mixHue(78, H, 0.25)
    t = {
      '--m-bg': o(0.165, 0.012, g),
      '--m-panel': o(0.195, 0.014, g),
      '--m-card': o(0.228, 0.016, g),
      '--m-card-hi': o(0.255, 0.018, g),
      '--m-line': o(0.36, 0.022, g),
      '--m-line-2': o(0.27, 0.016, g),
      '--m-text': o(0.93, 0.018, 85),
      '--m-text-2': o(0.83, 0.02, 80),
      '--m-text-3': o(0.71, 0.02, 78),
      '--m-text-4': o(0.63, 0.018, 75),
      '--m-accent': o(0.76, Math.min(C, 0.1), H),
      '--m-accent-strong': o(0.85, Math.min(C, 0.08), H),
      '--m-accent-wash': o(0.25, Math.min(C * 0.5, 0.04), H),
      '--m-on-accent': o(0.17, 0.02, H),
      '--m-ink-on-gold': o(0.34, clamp(C * 1.2, 0.05, 0.12), H),
      '--m-danger': o(0.72, 0.13, 28),
      ...NIGHT_GOLD,
      '--gold-line': o(0.64, 0.075, 85),
      '--bg-image':
        'radial-gradient(ellipse at 18% 8%, oklch(1 0 0 / .04), transparent 60%), radial-gradient(ellipse at 88% 95%, oklch(0 0 0 / .28), transparent 55%)',
    }
  }
  // Aliases for the names the phase-1 code used.
  t['--m-line-3'] = t['--m-line']
  t['--m-input'] = t['--m-bg']
  t['--m-accent-ink'] = t['--m-on-accent']
  return t
}

/** The installed-app icon field: the ink at L .26 (design handoff). */
export function iconField(palette) {
  const { C, H } = hexToOklch((palette ?? paletteById(DEFAULT_PALETTE_ID)).hex)
  return o(0.26, clamp(C * 0.9, 0.04, 0.08), H)
}

/**
 * Write a palette's tokens for a ground onto the document root and mark the
 * ground on <html data-ground>. Pass a null palette for the default (gold).
 */
export function applyPalette(palette, ground = 'night') {
  const root = document.documentElement
  for (const [token, value] of Object.entries(inkTokens(palette, ground))) {
    root.style.setProperty(token, value)
  }
  root.dataset.ground = ground
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', inkTokens(palette, ground)['--m-bg'])
}
