// Marginalia theme palettes
// Each palette overrides a subset of CSS variables when applied to the root element
// Default theme is "parchment" — defined in global.css as fallback

export const THEMES = {
  parchment: {
    name: 'Parchment',
    description: 'warm gold on cream',
    swatch: ['#1a1715', '#c9a961', '#e8e2d5'],
    vars: {
      // uses defaults in global.css
    },
  },
  forest: {
    name: 'Forest',
    description: 'sage on deep moss',
    swatch: ['#161a16', '#8a9a7b', '#d8dccd'],
    vars: {
      '--bg': '#161a16',
      '--bg-elevated': '#1f231e',
      '--bg-input': '#252a23',
      '--ink': '#d8dccd',
      '--ink-muted': '#9aa590',
      '--ink-faint': '#5e665a',
      '--accent': '#8a9a7b',
      '--accent-hover': '#a4b894',
      '--border': '#33392f',
      '--border-subtle': '#262a23',
    },
  },
  noir: {
    name: 'Noir',
    description: 'silver-blue on slate',
    swatch: ['#13171c', '#7a8fa4', '#dde1e6'],
    vars: {
      '--bg': '#13171c',
      '--bg-elevated': '#1c2229',
      '--bg-input': '#22282f',
      '--ink': '#dde1e6',
      '--ink-muted': '#9ba6b3',
      '--ink-faint': '#5e6773',
      '--accent': '#7a8fa4',
      '--accent-hover': '#94a8bd',
      '--border': '#2e3540',
      '--border-subtle': '#1f242b',
    },
  },
  ember: {
    name: 'Ember',
    description: 'burnt sienna on warm dark',
    swatch: ['#1c1612', '#b88654', '#ecdcc8'],
    vars: {
      '--bg': '#1c1612',
      '--bg-elevated': '#251d18',
      '--bg-input': '#2c241e',
      '--ink': '#ecdcc8',
      '--ink-muted': '#b09a85',
      '--ink-faint': '#6e6052',
      '--accent': '#b88654',
      '--accent-hover': '#cd9d6c',
      '--border': '#3d322a',
      '--border-subtle': '#2a221c',
    },
  },
  twilight: {
    name: 'Twilight',
    description: 'dusty purple on indigo',
    swatch: ['#16151c', '#9b8aa4', '#dfd9e6'],
    vars: {
      '--bg': '#16151c',
      '--bg-elevated': '#1f1d28',
      '--bg-input': '#26232f',
      '--ink': '#dfd9e6',
      '--ink-muted': '#a59baf',
      '--ink-faint': '#65607a',
      '--accent': '#9b8aa4',
      '--accent-hover': '#b6a4c0',
      '--border': '#34303d',
      '--border-subtle': '#241f2c',
    },
  },
  bone: {
    name: 'Bone',
    description: 'cool ivory on cold dark',
    swatch: ['#15161a', '#cdc6b8', '#ebe7dc'],
    vars: {
      '--bg': '#15161a',
      '--bg-elevated': '#1d1e23',
      '--bg-input': '#23252b',
      '--ink': '#ebe7dc',
      '--ink-muted': '#a8a59a',
      '--ink-faint': '#605e58',
      '--accent': '#cdc6b8',
      '--accent-hover': '#dcd5c5',
      '--border': '#34353c',
      '--border-subtle': '#22232a',
    },
  },
  rose: {
    name: 'Rose',
    description: 'dusty rose on sepia',
    swatch: ['#1c1614', '#a4787a', '#ecdcd6'],
    vars: {
      '--bg': '#1c1614',
      '--bg-elevated': '#251d1c',
      '--bg-input': '#2c2422',
      '--ink': '#ecdcd6',
      '--ink-muted': '#b3958f',
      '--ink-faint': '#6b5b56',
      '--accent': '#a4787a',
      '--accent-hover': '#bf8e90',
      '--border': '#3d2f2c',
      '--border-subtle': '#2a221f',
    },
  },
}

export const THEME_LIST = Object.entries(THEMES).map(([id, t]) => ({ id, ...t }))

/**
 * Apply a theme by writing CSS variables onto the document root.
 * Pass null/undefined or 'parchment' to clear (use defaults).
 */
export function applyTheme(themeId) {
  const root = document.documentElement
  const theme = THEMES[themeId]

  // First, remove any previously-applied theme vars
  Object.values(THEMES).forEach((t) => {
    Object.keys(t.vars).forEach((key) => root.style.removeProperty(key))
  })

  if (!theme || themeId === 'parchment') return

  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}
