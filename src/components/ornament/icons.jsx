// Small UI glyphs drawn in the same pen as the marks.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
}

export function SearchIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </svg>
  )
}

export function MenuIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4 7h16M4 12h16M4 17h11" />
    </svg>
  )
}

export function LeafIcon({ size = 22 }) {
  // A loose margin leaf, for the Margins drawer button.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
      <path d="M14.5 3.5V7H18M9 11h6M9 14h6M9 17h3.5" />
    </svg>
  )
}

export function SunMoonIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M15.5 4.5a7.5 7.5 0 1 0 4 12.6 6 6 0 0 1-4-12.6z" />
    </svg>
  )
}
