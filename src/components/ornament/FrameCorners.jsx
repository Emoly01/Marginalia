// The quatrefoil bosses pinned to the corners of a gilded frame.
function Boss({ corner }) {
  return (
    <svg className={`frame-boss frame-boss--${corner}`} width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <circle cx="11" cy="6" r="4" className="fill-accent stroke-gold-lo" />
      <circle cx="11" cy="16" r="4" className="fill-accent stroke-gold-lo" />
      <circle cx="6" cy="11" r="4" className="fill-accent stroke-gold-lo" />
      <circle cx="16" cy="11" r="4" className="fill-accent stroke-gold-lo" />
      <circle cx="11" cy="11" r="2.6" className="fill-gold-hi" />
    </svg>
  )
}

export default function FrameCorners() {
  return (
    <>
      <Boss corner="tl" />
      <Boss corner="tr" />
      <Boss corner="bl" />
      <Boss corner="br" />
    </>
  )
}
