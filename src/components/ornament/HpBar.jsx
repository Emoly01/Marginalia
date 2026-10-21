// The rubricated HP bar under the numerals. Decorative: the numbers carry
// the meaning, so the bar is hidden from assistive tech.
export default function HpBar({ current, max }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0
  return (
    <div className="hp-bar" aria-hidden="true">
      <div className="hp-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
