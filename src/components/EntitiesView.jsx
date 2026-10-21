// The codex: every NPC, place, thread, item and faction of a campaign.
import { useState, useEffect, useMemo, useRef } from 'react'
import { createEntity, ENTITY_TYPES, entityTypeInfo } from '../lib/entities'
import { excerptFrom } from '../lib/text'
import { lastSeen, codexFilters } from '../lib/campaignHome'
import { toast } from '../lib/toast'
import { Drollery } from './ornament'

export default function EntitiesView({ userId, campaignId, entities, sessions, initialKind = 'all', onOpenEntity, onEntityCreated }) {
  const [filter, setFilter] = useState(initialKind)
  const [composing, setComposing] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('npc')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  // The campaign home can jump straight to a single kind.
  useEffect(() => setFilter(initialKind), [initialKind])

  useEffect(() => {
    if (composing) nameRef.current?.focus()
  }, [composing])

  const seen = useMemo(() => lastSeen(sessions), [sessions])
  const filters = codexFilters(entities, ENTITY_TYPES)
  const filtered = filter === 'all' ? entities : entities.filter((e) => e.type === filter)

  const handleCreate = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const id = await createEntity(userId, campaignId, { name: trimmed, type })
      setName('')
      setComposing(false)
      onEntityCreated?.()
      onOpenEntity(id)
    } catch (err) {
      console.error('Failed to create entity:', err)
      toast('Could not create entity.')
    }
    setSaving(false)
  }

  return (
    <div className="page-wide">
      <header className="page-head">
        <div className="page-head-text">
          <h1 className="title page-title">Codex</h1>
          <span className="meta">people, places and things met so far</span>
        </div>
        <button className="btn-gilt" onClick={() => setComposing((c) => !c)} aria-expanded={composing}>
          {composing ? 'Cancel' : '+ New page'}
        </button>
      </header>

      {composing && (
        <form className="panel codex-compose" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">Name</span>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brother Anselm" />
          </label>
          <div className="field">
            <span className="field-label" id="new-kind">Kind</span>
            <div className="toggle-row" role="group" aria-labelledby="new-kind">
              {ENTITY_TYPES.map((t) => (
                <button key={t.value} type="button" className="toggle" aria-pressed={type === t.value} onClick={() => setType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="dialog-actions">
            <button type="submit" className="btn-primary" disabled={!name.trim() || saving}>
              {saving ? 'Adding…' : 'Add to the codex'}
            </button>
          </div>
        </form>
      )}

      <div className="toggle-row" role="group" aria-label="Show">
        {filters.map((f) => (
          <button key={f.value} className="toggle" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label} <span className="toggle-count">{f.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="panel empty">
          <Drollery type="owl" width={200} />
          <p className="empty-title">
            {filter === 'all' ? 'The codex has no pages yet.' : `No ${entityTypeInfo(filter).plural.toLowerCase()} yet.`}
          </p>
          <p className="empty-body">Add one above, type @ while writing a session, or ink a session and name them there.</p>
        </div>
      ) : (
        <ul className="codex-cards">
          {filtered.map((e) => (
            <li key={e.id}>
              <button className="card codex-card" onClick={() => onOpenEntity(e.id)}>
                <span className="codex-row-name">{e.name}</span>
                <span className="codex-row-type">{entityTypeInfo(e.type).label}</span>
                <span className="codex-card-note">{excerptFrom(e.notes, 120) || 'nothing written down yet'}</span>
                <span className="codex-row-seen">{seen[e.id] ? `last seen in session ${seen[e.id]}` : 'not mentioned yet'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
