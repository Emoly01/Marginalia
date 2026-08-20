import { useState, useEffect, useMemo, useRef } from 'react'
import { createEntity, ENTITY_TYPES, entityTypeInfo } from '../lib/entities'
import { excerptFrom } from '../lib/text'
import { toast } from '../lib/toast'

export default function EntitiesView({
  userId,
  campaignId,
  entities,
  sessions,
  initialKind = 'all',
  onOpenEntity,
  onEntityCreated,
}) {
  const [filter, setFilter] = useState(initialKind)
  const [composing, setComposing] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('npc')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  // The Codex rail can jump straight to a single kind.
  useEffect(() => setFilter(initialKind), [initialKind])

  useEffect(() => {
    if (composing) nameRef.current?.focus()
  }, [composing])

  // Which session each entity first turns up in, from the mention index.
  const firstSeen = useMemo(() => {
    const seen = {}
    for (const s of sessions || []) {
      for (const id of s.mentionIds || []) {
        const n = s.sessionNumber
        if (seen[id] === undefined || n < seen[id]) seen[id] = n
      }
    }
    return seen
  }, [sessions])

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
    <div className="column column--wide">
      <div className="row-between">
        <span className="hint">people, places and things met so far</span>
        <button className="btn-quiet" onClick={() => setComposing((c) => !c)}>
          {composing ? 'cancel' : '+ New entity'}
        </button>
      </div>

      {composing && (
        <form className="panel" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="field">
            <label className="field-label" htmlFor="new-entity-name">Name</label>
            <input
              id="new-entity-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asharti"
            />
          </div>
          <div className="field">
            <span className="field-label">Kind</span>
            <div className="pill-row">
              {ENTITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`choice${type === t.value ? ' is-active' : ''}`}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="link-action" onClick={() => setComposing(false)}>
              cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim() || saving}>
              {saving ? 'adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      <div className="pill-row">
        <button
          className={`choice${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          all
        </button>
        {ENTITY_TYPES.map((t) => (
          <button
            key={t.value}
            className={`choice${filter === t.value ? ' is-active' : ''}`}
            onClick={() => setFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-title">
            {filter === 'all' ? 'nobody here yet' : `no ${entityTypeInfo(filter).label.toLowerCase()}s yet`}
          </span>
          <span className="empty-state-sub">
            add one above, or type @ while writing a session and it will make itself.
          </span>
        </div>
      ) : (
        <div className="card-grid card-grid--tight">
          {filtered.map((e) => (
            <button key={e.id} className="entity-card" onClick={() => onOpenEntity(e.id)}>
              <div className="entity-card-head">
                <span className="entity-card-name">{e.name}</span>
                <span className="pill">{entityTypeInfo(e.type).label}</span>
              </div>
              <p className="entity-card-note">
                {excerptFrom(e.notes, 110) || 'nothing written down yet.'}
              </p>
              <div className="entity-card-foot">
                {firstSeen[e.id] !== undefined
                  ? `session ${firstSeen[e.id]}`
                  : 'not mentioned yet'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
