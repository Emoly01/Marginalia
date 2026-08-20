import { useState, useEffect, useRef } from 'react'
import {
  getEntity,
  listEntities,
  updateEntity,
  deleteEntity,
  connectEntities,
  disconnectEntities,
  ENTITY_TYPES,
  entityTypeInfo,
} from '../lib/entities'
import { getSessionsMentioning } from '../lib/backlinks'
import { useDebounce } from '../lib/useDebounce'
import { toast } from '../lib/toast'
import RichTextEditor from './RichTextEditor'

export default function EntityDetail({
  userId,
  campaignId,
  entityId,
  onBack,
  onOpenEntity,
  onOpenSession,
}) {
  const [entity, setEntity] = useState(null)
  const [allEntities, setAllEntities] = useState([])
  const [backlinks, setBacklinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [showConnectPicker, setShowConnectPicker] = useState(false)
  const isDirty = useRef(false)

  // Load entity + all entities + backlinks
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    isDirty.current = false
    Promise.all([
      getEntity(userId, campaignId, entityId),
      listEntities(userId, campaignId),
      getSessionsMentioning(userId, campaignId, entityId),
    ])
      .then(([ent, all, links]) => {
        if (cancelled) return
        setEntity(ent)
        setAllEntities(all)
        setBacklinks(links)
        setLoading(false)
        setSaveStatus('saved')
      })
      .catch((err) => {
        console.error('Failed to load entity:', err)
        toast('Could not load that entity.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, campaignId, entityId])

  // Autosave name/type/notes
  const debouncedEntity = useDebounce(entity, 800)
  useEffect(() => {
    if (!isDirty.current || !debouncedEntity) return
    setSaveStatus('saving')
    updateEntity(userId, campaignId, entityId, {
      name: debouncedEntity.name,
      type: debouncedEntity.type,
      notes: debouncedEntity.notes,
    })
      .then(() => setSaveStatus('saved'))
      .catch((err) => {
        console.error('Save failed:', err)
        setSaveStatus('unsaved')
        toast('Autosave failed — your latest changes are not saved yet.')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedEntity])

  const update = (patch) => {
    isDirty.current = true
    setSaveStatus('unsaved')
    setEntity((e) => ({ ...e, ...patch }))
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${entity.name}"? This removes it from all connections. Session mentions will remain as plain text. This cannot be undone.`)) return
    try {
      await deleteEntity(userId, campaignId, entityId)
      onBack()
    } catch (err) {
      console.error('Delete failed:', err)
      toast('Could not delete entity.')
    }
  }

  const handleConnect = async (otherId) => {
    try {
      await connectEntities(userId, campaignId, entityId, otherId)
      // refresh connections
      const updated = await getEntity(userId, campaignId, entityId)
      setEntity((e) => ({ ...e, connections: updated.connections }))
      const all = await listEntities(userId, campaignId)
      setAllEntities(all)
      setShowConnectPicker(false)
    } catch (err) {
      console.error('Connect failed:', err)
      toast('Could not connect entities.')
    }
  }

  const handleDisconnect = async (otherId) => {
    try {
      await disconnectEntities(userId, campaignId, entityId, otherId)
      const updated = await getEntity(userId, campaignId, entityId)
      setEntity((e) => ({ ...e, connections: updated.connections }))
      const all = await listEntities(userId, campaignId)
      setAllEntities(all)
    } catch (err) {
      console.error('Disconnect failed:', err)
      toast('Could not disconnect entities.')
    }
  }

  if (loading || !entity) {
    return <div className="view"><div className="view-body"><p className="hint">loading…</p></div></div>
  }

  const connectedEntities = (entity.connections || [])
    .map((id) => allEntities.find((e) => e.id === id))
    .filter(Boolean)
  const connectableEntities = allEntities.filter(
    (e) => e.id !== entityId && !(entity.connections || []).includes(e.id)
  )

  return (
    <div className="view">
      <header className="view-header" style={{ alignItems: 'center' }}>
        <div className="pill-row">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t.value}
              className={`choice${entity.type === t.value ? ' is-active' : ''}`}
              onClick={() => update({ type: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
          <SaveIndicator status={saveStatus} />
          <button className="btn" onClick={onBack}>← back</button>
          <button className="btn-danger" onClick={handleDelete}>delete</button>
        </div>
      </header>

      <div className="view-body">
        <div className="column column--narrow" style={{ gap: '20px' }}>
          <input
            type="text"
            value={entity.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Name"
            aria-label="Entity name"
            style={{
              width: '100%',
              fontSize: '32px',
              fontStyle: 'italic',
              color: 'var(--m-accent)',
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: '4px 0',
              lineHeight: 1.15,
            }}
          />

          <div className="dossier-section">
            <span className="dossier-label">Notes</span>
            <div className="dossier-surface">
              <RichTextEditor
                content={entity.notes}
                onChange={(html) => update({ notes: html })}
                placeholder="What do you know about them?"
              />
            </div>
          </div>

          <div className="dossier-section">
            <span className="dossier-label">Connections</span>
            {connectedEntities.length === 0 ? (
              <p className="hint">not connected to anything yet</p>
            ) : (
              <div className="pill-row">
                {connectedEntities.map((e) => (
                  <span
                    key={e.id}
                    className="pill"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 6px 3px 10px' }}
                  >
                    <button
                      onClick={() => onOpenEntity(e.id)}
                      style={{ color: 'var(--m-text-2)', fontSize: '14px', padding: 0 }}
                    >
                      {e.name}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDisconnect(e.id)}
                      title={`Disconnect ${e.name}`}
                      style={{ padding: '0 3px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showConnectPicker ? (
              <div className="panel" style={{ padding: '10px' }}>
                {connectableEntities.length === 0 ? (
                  <p className="hint" style={{ padding: '4px' }}>no other entities to connect</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '220px', overflowY: 'auto' }}>
                    {connectableEntities.map((e) => (
                      <button
                        key={e.id}
                        className="rail-row"
                        onClick={() => handleConnect(e.id)}
                      >
                        <span className="rail-row-name">{e.name}</span>
                        <span className="rail-row-meta">{entityTypeInfo(e.type).label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button className="btn" onClick={() => setShowConnectPicker(false)} style={{ marginTop: '6px' }}>
                  cancel
                </button>
              </div>
            ) : (
              <div>
                <button className="btn-dashed" onClick={() => setShowConnectPicker(true)}>
                  + connect entity
                </button>
              </div>
            )}
          </div>

          <div className="dossier-section">
            <span className="dossier-label">Appears in</span>
            {backlinks.length === 0 ? (
              <p className="hint">
                not mentioned in any session yet — type @{entity.name} while writing
              </p>
            ) : (
              backlinks.map((s) => (
                <button key={s.id} className="session-card" onClick={() => onOpenSession(s.id)}>
                  <div className="session-card-head">
                    <span className="session-card-num">#{s.sessionNumber}</span>
                    <span className="session-card-title" style={{ fontSize: '17px' }}>{s.title}</span>
                    <span style={{ flex: 1 }} />
                    <span className="session-card-date">{s.date}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SaveIndicator({ status }) {
  const display = {
    saved: { text: 'saved', color: 'var(--m-text-4)' },
    saving: { text: 'saving…', color: 'var(--m-accent)' },
    unsaved: { text: 'unsaved', color: 'var(--m-danger)' },
  }[status]
  return <span className="save-indicator" style={{ color: display.color }}>{display.text}</span>
}
