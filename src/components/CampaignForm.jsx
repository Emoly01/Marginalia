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
    })
  }

  const isCustomSystem = !SYSTEMS.includes(system)

  return (
    <div className="modal-backdrop" onClick={close}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div>
          <h2 className="modal-title">{isEdit ? 'Campaign settings' : 'New campaign'}</h2>
          <p className="modal-sub">
            {isEdit ? 'change whatever has stopped being true.' : 'two things now, the rest whenever.'}
          </p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="campaign-name">Campaign name</label>
          <input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="League of Ambivalence"
            autoFocus
          />
        </div>

        <div className="field">
          <span className="field-label">System</span>
          <div className="pill-row">
            {SYSTEMS.map((s) => (
              <button
                key={s}
                type="button"
                className={`choice${system === s || (s === 'other' && isCustomSystem) ? ' is-active' : ''}`}
                onClick={() => setSystem(s === 'other' && !isCustomSystem ? '' : s)}
              >
                {s}
              </button>
            ))}
          </div>
          {(isCustomSystem || system === '') && (
            <input
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="Call of Cthulhu, Monster of the Week…"
              style={{ marginTop: '2px' }}
            />
          )}
        </div>

        <div className="field">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
            <span className="field-label">Palette</span>
            <span style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--m-accent)' }}>
              {picked.name}
            </span>
          </div>
          <div className="swatch-grid">
            {PALETTE.map((p) => (
              <button
                key={p.id}
                type="button"
                className="swatch"
                title={p.name}
                aria-label={p.name}
                aria-pressed={palette === p.id}
                onClick={() => setPalette(p.id)}
                style={{
                  background: p.hex,
                  boxShadow: palette === p.id
                    ? `0 0 0 2px var(--m-card), 0 0 0 3px ${p.hex}`
                    : 'none',
                }}
              />
            ))}
          </div>
          <span className="field-hint">tints every surface while you're inside this campaign</span>
        </div>

        {!showMore ? (
          <button
            type="button"
            className="link-action"
            onClick={() => setShowMore(true)}
            style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--m-text-4)', textAlign: 'left', padding: 0 }}
          >
            + the rest of it
          </button>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="field">
                <label className="field-label" htmlFor="campaign-short">Short name</label>
                <input
                  id="campaign-short"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="League"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="campaign-gm">GM</label>
                <input
                  id="campaign-gm"
                  value={dmName}
                  onChange={(e) => setDmName(e.target.value)}
                  placeholder="who runs it"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="campaign-pc">Your character</label>
                <input
                  id="campaign-pc"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Tav"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="campaign-class">Class / concept</label>
                <input
                  id="campaign-class"
                  value={characterClass}
                  onChange={(e) => setCharacterClass(e.target.value)}
                  placeholder="warlock"
                />
              </div>
            </div>

            <div className="field">
              <span className="field-label">Status</span>
              <div className="pill-row">
                {['active', 'hiatus', 'completed'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`choice${status === s ? ' is-active' : ''}`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="btn-danger"
              onClick={onDelete}
              style={{ marginRight: 'auto' }}
            >
              delete campaign
            </button>
          )}
          <button type="button" className="link-action" onClick={close}>cancel</button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
