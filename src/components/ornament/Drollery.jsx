// Drolleries: the absurd little creatures monks drew in the margins. Line
// art in the text colour, for empty states and small moments.

const DRAWINGS = {
  snail: {
    viewBox: '0 0 66 30',
    label: 'A snail jousting with a lance',
    body: (
      <>
        <path d="M4 24h26c3 0 4.5-1.5 5.5-4" />
        <path d="M10 24c-2-2-3-5-2-8 1.5-5 7-7 11-5 4 2 4.5 7 1.5 9.5-2.5 2-6 1-6.5-1.5-.5-2 1-3.5 2.6-3.2" />
        <path d="M35.5 20c.5-3 .3-5-.5-7M35 13l-2-4M35 13l2.5-3.5" />
        <circle cx="33" cy="9" r=".8" fill="currentColor" />
        <circle cx="37.5" cy="9.5" r=".8" fill="currentColor" />
        <path d="M24 17.5l38-11" />
        <path d="M58 7.2l4.5-.9-3.2 3.1z" />
        <path d="M29 14.5l1.4 4.6" />
        <path d="M2 27.5h60" strokeDasharray="1 3" />
      </>
    ),
  },
  rabbit: {
    viewBox: '0 0 80 60',
    label: 'A rabbit brandishing a sword',
    body: (
      <>
        <path d="M24 53c-6 0-9-6-8-12 1-7 7-11 13-11 6 0 10 5 10 11 0 7-5 12-15 12z" />
        <path d="M31 30c1-4 3-6 7-6.5 4-.5 7 2 7 5.5 0 3-2.5 5-6 5" />
        <path d="M36 24c-2-8-1.5-14 1.5-16.5 2 3 2.2 9 .5 16" />
        <path d="M40 23.6c1-7.6 3.8-12.6 7.2-13.6.8 3.2-1 9-4.4 14.6" />
        <circle cx="41" cy="27.5" r=".9" fill="currentColor" />
        <path d="M45 29.5l1.2.4" />
        <path d="M34 38c4-1 7.5-2.5 11-5" />
        <path d="M45.5 33.5L64 7.5" />
        <path d="M42.6 30.6l6.4 4.6" />
        <path d="M45.5 33.5l-2.4 3.4" />
        <circle cx="42.8" cy="37.3" r="1" />
        <path d="M17 53h14M36 53h6" />
        <circle cx="15.5" cy="45" r="2.6" />
        <path d="M8 57h56" strokeDasharray="1 3" />
      </>
    ),
  },
  cat: {
    viewBox: '0 0 80 60',
    label: 'A cat reading a book',
    body: (
      <>
        <path d="M50 54c-12 0-16-8-14-18 2-8 8-12 14-12 8 0 12 8 12 16 0 8-4 14-12 14z" />
        <path d="M39 22.5c-1.5-3-1.5-7 .5-9.5l4.5 4" />
        <path d="M51 16.5l3-6.5c2 2.5 2.5 6 1.6 9.6" />
        <path d="M39 22.5c0 4.5 3.2 7.5 7.5 7.5s9-3 9-8c0-3-1.5-5-4.5-5.5-3-.5-6 0-8 1" />
        <path d="M42 23.2h2.6M48 23.2h2.6" />
        <path d="M46.4 26.4l.6.6.6-.6" />
        <path d="M39.5 26l-5-1M39.8 27.6l-4.6.6" />
        <path d="M62 50c8 0 10-6 8-12-1-3-4-3-4 0" />
        <path d="M20 42l10-4.5 10 4.5v9l-10-4.5L20 51z" />
        <path d="M30 37.5v9" />
        <path d="M23 42.6l4.5-1.8M23 45.4l4.5-1.8M33 40.8l4.5 1.8M33 43.6l4.5 1.8" />
        <path d="M38.5 41c1.8-1.4 3.6-1.4 5 .4" />
        <path d="M10 57h62" strokeDasharray="1 3" />
      </>
    ),
  },
  owl: {
    viewBox: '0 0 80 60',
    label: 'An owl writing with a quill',
    body: (
      <>
        <path d="M30 51c-8 0-12-8-12-18s6-16 12-16 12 6 12 16-4 18-12 18z" />
        <path d="M20.5 20l1.5-5 3.5 3.4M39.5 20L38 15l-3.5 3.4" />
        <circle cx="25.6" cy="27" r="4" />
        <circle cx="34.4" cy="27" r="4" />
        <circle cx="25.6" cy="27" r="1" fill="currentColor" />
        <circle cx="34.4" cy="27" r="1" fill="currentColor" />
        <path d="M30 30.5l-1.6 3h3.2z" />
        <path d="M24 38c2 1.2 4 1.6 6 1.6M24.5 42c2 1 3.6 1.3 5.5 1.3" />
        <path d="M40 36c4 2.5 7.5 4 11.5 4.2" />
        <path d="M50 46L64 25c1.8-2.4 4.4-2.4 4.4.2 0 2-1.4 3.6-3.6 4.6L51 47.5" />
        <path d="M58 33.5l3 2.4M55 38l3 2.4" />
        <path d="M26 51v3M34 51v3M24 54h4M32 54h4" />
        <path d="M44 54h24c2 0 2-4 0-4H44c-2 0-2 4 0 4z" />
        <path d="M48 52h12" strokeDasharray="2 2" />
      </>
    ),
  },
}

export default function Drollery({ type = 'snail', width = 200, height, className = '', decorative = false }) {
  const d = DRAWINGS[type] ?? DRAWINGS.snail
  const [, , vw, vh] = d.viewBox.split(' ').map(Number)
  return (
    <svg
      className={`drollery ${className}`.trim()}
      width={width}
      height={height ?? Math.round((width * vh) / vw)}
      viewBox={d.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : d.label}
      aria-hidden={decorative ? 'true' : undefined}
      focusable="false"
    >
      {d.body}
    </svg>
  )
}
