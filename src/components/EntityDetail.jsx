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
import { IlluminatedTitle } from './ornament'

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
    return <div className="waiting">opening the page…</div>
  }

  const connectedEntities = (entity.connections || [])
    .map((id) => allEntities.find((e) => e.id === id))
    .filter(Boolean)
  const connectableEntities = allEntities.filter(
    (e) => e.id !== entityId && !(entity.connections || []).includes(e.id)
  )

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={onBack}>‹ Codex</button>
        <span className="rubric">{entityTypeInfo(entity.type).label}</span>
        <span className="toolbar-spacer" />
        <SaveIndicator status={saveStatus} />
        <button className="btn-danger" onClick={handleDelete}>Delete page</button>
      </div>
      <div className="page">
        <div className="page-narrow entity">
          <IlluminatedTitle text={entity.name || 'Unnamed'} as="h1" size={60} variant="gilt" className="entity-title" />
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input-ghost entity-name-input" value={entity.name} onChange={(e) => update({ name: e.target.value })} placeholder="Name" />
          </label>
          <div className="field">
            <span className="field-label" id="entity-kind">Kind</span>
            <div className="toggle-row" role="group" aria-labelledby="entity-kind">
              {ENTITY_TYPES.map((t) => (
                <button key={t.value} className="toggle" aria-pressed={entity.type === t.value} onClick={() => update({ type: t.value })}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <section className="dossier-section">
            <h2 className="rubric">Notes</h2>
            <div className="card dossier-surface">
              <RichTextEditor content={entity.notes} onChange={(html) => update({ notes: html })} placeholder="What do you know about them?" />
            </div>
          </section>

          <section className="dossier-section">
            <h2 className="rubric">Connections</h2>
            {connectedEntities.length === 0 ? (
              <p className="hint">Not connected to anything yet.</p>
            ) : (
              <ul className="entity-links">
                {connectedEntities.map((e) => (
                  <li key={e.id} className="entity-link">
                    <button className="entity-link-name" onClick={() => onOpenEntity(e.id)}>
                      {e.name} <span className="codex-row-type">{entityTypeInfo(e.type).label}</span>
                    </button>
                    <button className="btn-icon btn-icon--bare" onClick={() => handleDisconnect(e.id)} aria-label={`Disconnect ${e.name}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
            {showConnectPicker ? (
              <div className="card entity-picker">
                {connectableEntities.length === 0 ? (
                  <p className="hint">No other pages to connect.</p>
                ) : (
                  <ul className="entity-picker-list">
                    {connectableEntities.map((e) => (
                      <li key={e.id}>
                        <button className="drawer-row" onClick={() => handleConnect(e.id)}>
                          <span className="drawer-row-name">{e.name}</span>
                          <span className="codex-row-type">{entityTypeInfo(e.type).label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="btn btn--sm" onClick={() => setShowConnectPicker(false)}>Cancel</button>
              </div>
            ) : (
              <div>
                <button className="btn-gilt" onClick={() => setShowConnectPicker(true)}>+ Connect a page</button>
              </div>
            )}
          </section>

          <section className="dossier-section">
            <h2 className="rubric">Appears in</h2>
            {backlinks.length === 0 ? (
              <p className="hint">Not mentioned in any session yet — type @{entity.name} while writing.</p>
            ) : (
              <ol className="session-rows">
                {backlinks.map((sn) => (
                  <li key={sn.id} className="session-row">
                    <button className="session-row-main" onClick={() => onOpenSession(sn.id)}>
                      <span className="session-row-num numeral">{sn.sessionNumber}</span>
                      <span className="session-row-text">
                        <span className="session-row-title">{sn.title}</span>
                        <span className="session-row-when">{sn.date}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function SaveIndicator({ status }) {
  const text = { saved: 'saved', saving: 'saving…', unsaved: 'unsaved' }[status]
  return <span className={`save-state${status === 'unsaved' ? ' save-state--unsaved' : ''}`} aria-live="polite">{text}</span>
}
