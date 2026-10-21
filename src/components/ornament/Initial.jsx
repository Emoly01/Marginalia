// Illuminated initials. Coloured entirely through CSS variables, so the
// campaign ink and the gold leaf apply on either ground.
//   gilt  — gold leaf square, letter in the campaign's ink (headings)
//   grand — ink field, gold border, gold letter (session titles)
//   plain — a ruled square with the letter in ink (quiet places)
import { firstLetter } from '../../lib/text'

export default function Initial({ letter, size = 46, variant = 'gilt', className = '' }) {
  const cls = `ornament-initial ornament-initial--${variant} ${className}`.trim()
  if (variant === 'grand') {
    return (
      <svg className={cls} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <rect width="120" height="120" className="fill-gold" />
        <rect x="5" y="5" width="110" height="110" className="fill-ink-on-gold" />
        <rect x="9" y="9" width="102" height="102" fill="none" strokeWidth="1" className="stroke-gold-lo" />
        <path d="M14 104c12-3 15-13 12-25-3-12 5-21 16-19M106 16c-12 3-15 13-12 25 2 9-2 16-9 18" fill="none" strokeWidth="1.4" className="stroke-gold" />
        <path d="M26 79c-5-1-8 2-7 6M94 41c5 1 8-2 7-6" fill="none" strokeWidth="1.2" className="stroke-gold" />
        <circle cx="17" cy="17" r="3" className="fill-gold" />
        <circle cx="103" cy="17" r="3" className="fill-gold" />
        <circle cx="17" cy="103" r="3" className="fill-gold" />
        <circle cx="103" cy="103" r="3" className="fill-gold" />
        <text x="61" y="94" textAnchor="middle" className="ornament-initial-letter fill-gold-hi" fontSize="94">{letter}</text>
      </svg>
    )
  }
  if (variant === 'plain') {
    return (
      <svg className={cls} width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <rect x=".5" y=".5" width="43" height="43" fill="none" className="stroke-gold-line" />
        <text x="22" y="35" textAnchor="middle" className="ornament-initial-plain fill-accent" fontSize="36">{letter}</text>
      </svg>
    )
  }
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 46 46" aria-hidden="true" focusable="false">
      <rect width="46" height="46" className="fill-gold" />
      <rect x="2.5" y="2.5" width="41" height="41" fill="none" strokeWidth="1" className="stroke-ink-on-gold" />
      <path d="M2.5 13c4.5 0 7-3 7-7.5M43.5 33c-4.5 0-7 3-7 7.5" fill="none" strokeWidth="1" className="stroke-ink-on-gold" />
      <circle cx="8" cy="38" r="1.6" className="fill-ink-on-gold" />
      <circle cx="38" cy="8" r="1.6" className="fill-ink-on-gold" />
      <text x="23" y="34.5" textAnchor="middle" className="ornament-initial-letter fill-ink-on-gold" fontSize="32">{letter}</text>
    </svg>
  )
}

/**
 * A title with its first letter illuminated: "The Drowned Bells" →
 * [T] + "he Drowned Bells". Screen readers get the plain title once.
 */
export function IlluminatedTitle({ text, as: Tag = 'h1', size = 46, variant = 'gilt', className = '' }) {
  const { letter, lead = '', rest } = firstLetter(text)
  return (
    <Tag className={`illuminated ${className}`.trim()}>
      <span className="sr-only">{text}</span>
      <span className="illuminated-visual" aria-hidden="true">
        {lead && <span className="illuminated-rest">{lead}</span>}
        {letter && <Initial letter={letter} size={size} variant={variant} />}
        <span className="illuminated-rest">{rest}</span>
      </span>
    </Tag>
  )
}
