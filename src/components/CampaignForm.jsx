import { useState, useEffect } from 'react'
import { PALETTE, paletteFor } from '../lib/palette'

const SYSTEMS = ['D&D 5e', 'Pathfinder 2e', 'Blades', 'other']

export default function CampaignForm({
  onSubmit,
  onCancel,
  onDelete,
  onPreviewPalette,
  initial = {},
  isEdit = false,
}) {
  const [name, setName] = useState(initial.name || '')
  const [system, setSystem] = useState(initial.system || SYSTEMS[0])
  const [palette, setPalette] = useState(() => paletteFor(initial).id)
  const [shortName, setShortName] = useState(initial.shortName || '')
  const [dmName, setDmName] = useState(initial.dmName || '')
  const [characterName, setCharacterName] = useState(initial.characterName || '')
  const [characterClass, setCharacterClass] = useState(initial.characterClass || '')
  const [status, setStatus] = useState(initial.status || 'active')
  const [ddbUrl, setDdbUrl] = useState(initial.ddbUrl || '')
  // New campaigns ask for two things; the rest waits until you want it.
  const [showMore, setShowMore] = useState(isEdit)

  const picked = PALETTE.find((p) => p.id === palette) || PALETTE[0]

  // Preview the palette live while the modal is open, so you can see what
  // "tints every surface" actually means before committing.
  useEffect(() => {
    onPreviewPalette?.(picked)
  }, [picked, onPreviewPalette])

  const close = () => {
    onPreviewPalette?.(null)
    onCancel()
  }

  // Escape closes the modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onPreviewPalette?.(null)
    onSubmit({
      name: name.trim(),
      shortName: shortName.trim() || name.trim(),
      system: system.trim(),
      dmName: dmName.trim(),
      characterName: characterName.trim(),
      characterClass: characterClass.trim(),
      palette,
      status,
      ddbUrl: ddbUrl.trim(),
    })
  }

  const isCustomSystem = !SYSTEMS.includes(system)

  return (
    <>
      <div className="overlay" onClick={close} />
      <form className="dialog dialog--center campaign-form" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="campaign-form-title">
        <div>
          <h2 className="dialog-title" id="campaign-form-title">{isEdit ? 'Campaign settings' : 'A new campaign'}</h2>
          <p className="hint">{isEdit ? 'Change whatever has stopped being true.' : 'Two things now, the rest whenever.'}</p>
        </div>

        <label className="field">
          <span className="field-label">Campaign name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Choir Beneath Vell" autoFocus />
        </label>

        <div className="field">
          <span className="field-label" id="system-label">System</span>
          <div className="toggle-row" role="group" aria-labelledby="system-label">
            {SYSTEMS.map((sys) => (
              <button
                key={sys}
                type="button"
                className="toggle"
                aria-pressed={system === sys || (sys === 'other' && isCustomSystem)}
                onClick={() => setSystem(sys === 'other' && !isCustomSystem ? '' : sys)}
              >
                {sys}
              </button>
            ))}
          </div>
          {(isCustomSystem || system === '') && (
            <input value={system} onChange={(e) => setSystem(e.target.value)} placeholder="Call of Cthulhu, Monster of the Week…" aria-label="System name" />
          )}
        </div>

        <div className="field">
          <span className="field-label" id="ink-label">
            Ink <span className="codex-row-type">{picked.name}</span>
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby="ink-label">
            {PALETTE.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                className="swatch"
                title={p.name}
                aria-label={p.name}
                aria-checked={palette === p.id}
                onClick={() => setPalette(p.id)}
                style={{ '--swatch': p.hex }}
              />
            ))}
          </div>
          <span className="field-hint">the rubric for headings, initials and rules while you’re inside this campaign — gold leaf stays gold</span>
        </div>

        {!showMore ? (
          <button type="button" className="btn-link" onClick={() => setShowMore(true)}>+ the rest of it</button>
        ) : (
          <>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Short name</span>
                <input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="Vell" />
              </label>
              <label className="field">
                <span className="field-label">GM</span>
                <input value={dmName} onChange={(e) => setDmName(e.target.value)} placeholder="who runs it" />
              </label>
              <label className="field">
                <span className="field-label">Your character</span>
                <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Nenise" />
              </label>
              <label className="field">
                <span className="field-label">Class / concept</span>
                <input value={characterClass} onChange={(e) => setCharacterClass(e.target.value)} placeholder="bard" />
              </label>
            </div>

            <label className="field">
              <span className="field-label">D&amp;D Beyond character link</span>
              <input type="url" value={ddbUrl} onChange={(e) => setDdbUrl(e.target.value)} placeholder="https://www.dndbeyond.com/characters/…" />
              <span className="field-hint">for the rare lookup the imported sheet doesn’t cover</span>
            </label>

            <div className="field">
              <span className="field-label" id="status-label">Status</span>
              <div className="toggle-row" role="group" aria-labelledby="status-label">
                {['active', 'hiatus', 'completed'].map((st) => (
                  <button key={st} type="button" className="toggle" aria-pressed={status === st} onClick={() => setStatus(st)}>
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="dialog-actions">
          {onDelete && (
            <button type="button" className="btn-danger form-delete" onClick={onDelete}>Delete campaign</button>
          )}
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>{isEdit ? 'Save' : 'Begin'}</button>
        </div>
      </form>
    </>
  )
}
