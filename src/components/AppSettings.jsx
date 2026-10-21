// The top bar's settings menu: which vellum this device uses, and the account.
import { useState, useEffect, useRef } from 'react'
import { GROUND_PREFS, useGroundPref } from '../lib/ground'
import { initials } from '../lib/text'

export default function AppSettings({ user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const [pref, setPref] = useGroundPref()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="btn-icon app-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Settings and account"
      >
        {initials(user?.displayName)}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-section">
            <span className="field-label" id="ground-label">Ground on this device</span>
            <div role="radiogroup" aria-labelledby="ground-label" className="menu-options">
              {GROUND_PREFS.map((g) => (
                <button
                  key={g.value}
                  role="radio"
                  aria-checked={pref === g.value}
                  className="menu-option"
                  onClick={() => setPref(g.value)}
                >
                  <span className="tick" aria-hidden="true">{pref === g.value ? '✓' : ''}</span>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="menu-section menu-section--foot">
            <span className="menu-user">{user?.displayName || 'you'}</span>
            <button className="btn btn--sm" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}
