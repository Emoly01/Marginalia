// The marginal marks medieval readers drew beside a line, as one small
// pen-and-ink set: manicule, dagger, pilcrow, a bust, a coin, a quill
// stroke, a dot for tracker taps and a seal for milestones.
import { MARK_LABELS } from '../../lib/marks'

const PATHS = {
  important: (
    <>
      <path d="M2.5 8.5h3.5v8H2.5z" />
      <path d="M6 9.5c1.5-1.3 3.5-1.8 5.5-1.5l10 .2a1.4 1.4 0 0 1 0 2.8H13" />
      <path d="M13 11h1.6a1.3 1.3 0 0 1 0 2.6h-2.1" />
      <path d="M12.5 13.6h1.4a1.2 1.2 0 0 1 0 2.4H12" />
      <path d="M12 16h.8a1.1 1.1 0 0 1 0 2.2H8.2C7 18.2 6 17.5 6 16.3" />
    </>
  ),
  mystery: <path d="M12 2.5v19M7.5 7.5h9M10.5 21.5h3" />,
  quote: <path d="M13 4v16M17 4v16M19 4h-8.5a4 4 0 0 0 0 8H13" />,
  npc: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 19.5c.4-3.6 3-5.8 6.5-5.8s6.1 2.2 6.5 5.8" />
      <path d="M4 21h16" />
    </>
  ),
  loot: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5.2" />
      <path d="M12 9.5v5M9.5 12h5" />
    </>
  ),
  note: (
    <>
      <path d="M6.5 18c3-.8 6.5-5 10.5-12" />
      <path d="M6 18.2l2 1" />
    </>
  ),
  auto: <circle cx="12" cy="12" r="2.4" />,
  milestone: (
    <>
      <circle cx="12" cy="10" r="6.5" />
      <path d="M12 6.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" />
      <path d="M8.6 15.4 7.2 21.5l2.4-1 1.4 2 .9-5.2M15.4 15.4l1.4 6.1-2.4-1-1.4 2" />
    </>
  ),
  // A loose leaf with a folded corner, for Margins-inbox notes.
  margin: (
    <>
      <path d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
      <path d="M14.5 3.5V7H18M9 11h6M9 14h6M9 17h3.5" />
    </>
  ),
}

export default function Mark({ type = 'note', size = 22, title, className = '' }) {
  const kind = PATHS[type] ? type : 'note'
  const label = title ?? MARK_LABELS[kind]
  return (
    <svg
      className={`mark mark--${kind} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {PATHS[kind]}
    </svg>
  )
}
