// A gilded roundel for one spell slot or one use of a feature. Available is
// gold leaf; spent is the bare ink ring. Spending flakes the leaf off and a
// rest re-gilds it — the motion is CSS (.roundel-leaf) and is switched off
// under prefers-reduced-motion. Always paired with a written count.

export default function Roundel({ available, onSpend, onRestore, label }) {
  return (
    <button
      type="button"
      className={`roundel${available ? '' : ' is-spent'}`}
      onClick={available ? onSpend : onRestore}
      aria-label={`${label}: ${available ? 'available, tap to spend' : 'spent, tap to re-gild'}`}
    >
      <span className="roundel-ring" aria-hidden="true" />
      <span className="roundel-leaf" aria-hidden="true" />
    </button>
  )
}

/** A static gilded dot, for previews where nothing is tappable. */
export function Leaf({ size = 20 }) {
  return <span className="leaf-dot" style={{ '--leaf-size': `${size}px` }} aria-hidden="true" />
}
