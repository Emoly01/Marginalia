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
    }
  }

  if (loading || !entity) {
    return (
      <div style={{ color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', marginTop: '15vh' }}>
        loading…
      </div>
    )
  }

  const typeInfo = entityTypeInfo(entity.type)
  const connectedEntities = (entity.connections || [])
    .map((id) => allEntities.find((e) => e.id === id))
    .filter(Boolean)
  const connectableEntities = allEntities.filter(
    (e) => e.id !== entityId && !(entity.connections || []).includes(e.id)
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'var(--space-xl)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
      }}>
        <button
          onClick={onBack}
          style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)', fontSize: '0.85rem' }}
        >
          ← back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <SaveIndicator status={saveStatus} />
          <button
            onClick={handleDelete}
            style={{ fontSize: '0.85rem', color: 'var(--danger)', fontFamily: 'var(--font-ui)' }}
          >
            delete
          </button>
        </div>
      </div>

      {/* Type selector */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <select
          value={entity.type}
          onChange={(e) => update({ type: e.target.value })}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: typeInfo.color,
            fontFamily: 'var(--font-ui)',
            fontSize: '0.8rem',
            padding: '3px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Name */}
      <input
        type="text"
        value={entity.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Name"
        style={{
          width: '100%',
          fontSize: '2rem',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: 'var(--accent)',
          background: 'transparent',
          border: 'none',
          padding: 'var(--space-sm) 0',
          marginBottom: 'var(--space-md)',
          fontFamily: 'var(--font-body)',
        }}
      />

      {/* Notes */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <SectionLabel>Notes</SectionLabel>
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-md)',
          minHeight: '100px',
        }}>
          <RichTextEditor
            content={entity.notes}
            onChange={(html) => update({ notes: html })}
            placeholder="What do you know about them?"
          />
        </div>
      </div>

      {/* Connections */}
      <div style={{
        marginBottom: 'var(--space-xl)',
        paddingBottom: 'var(--space-lg)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <SectionLabel>Connections</SectionLabel>
        {connectedEntities.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
            not connected to anything yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
            {connectedEntities.map((e) => {
              const info = entityTypeInfo(e.type)
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '4px 6px 4px 10px',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: info.color }} />
                  <button
                    onClick={() => onOpenEntity(e.id)}
                    style={{ color: 'var(--ink)', fontSize: '0.85rem', fontFamily: 'var(--font-ui)' }}
                  >
                    {e.name}
                  </button>
                  <button
                    onClick={() => handleDisconnect(e.id)}
                    title="Disconnect"
                    style={{ color: 'var(--ink-faint)', fontSize: '0.9rem', padding: '0 4px' }}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {showConnectPicker ? (
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-sm)',
            marginTop: 'var(--space-sm)',
          }}>
            {connectableEntities.length === 0 ? (
              <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: '0.85rem', padding: '4px' }}>
                no other entities to connect
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflowY: 'auto' }}>
                {connectableEntities.map((e) => {
                  const info = entityTypeInfo(e.type)
                  return (
                    <button
                      key={e.id}
                      onClick={() => handleConnect(e.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        textAlign: 'left',
                        color: 'var(--ink)',
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-ui)',
                      }}
                      onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--bg-input)'}
                      onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: info.color }} />
                      {e.name}
                      <span style={{ color: 'var(--ink-faint)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        {info.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <button
              onClick={() => setShowConnectPicker(false)}
              style={{ color: 'var(--ink-faint)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)', marginTop: '4px', padding: '4px' }}
            >
              cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConnectPicker(true)}
            style={{
              background: 'var(--bg-input)',
              color: 'var(--ink-muted)',
              padding: 'var(--space-xs) var(--space-md)',
              borderRadius: 'var(--radius)',
              border: '1px dashed var(--border)',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.85rem',
            }}
          >
            + Connect entity
          </button>
        )}
      </div>

      {/* Backlinks — sessions mentioning this entity */}
      <div>
        <SectionLabel>Appears In</SectionLabel>
        {backlinks.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            not mentioned in any session yet — type @{entity.name} while writing
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {backlinks.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenSession(s.id)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-sm) var(--space-md)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                <span style={{
                  color: 'var(--ink-faint)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8rem',
                  marginRight: '8px',
                }}>
                  #{s.sessionNumber}
                </span>
                <span style={{ color: 'var(--ink)' }}>{s.title}</span>
                <span style={{
                  color: 'var(--ink-faint)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-ui)',
                  marginLeft: '8px',
                }}>
                  {s.date}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <h3 style={{
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'var(--ink-faint)',
      fontFamily: 'var(--font-ui)',
      fontWeight: 600,
      marginBottom: 'var(--space-sm)',
    }}>
      {children}
    </h3>
  )
}

function SaveIndicator({ status }) {
  const display = {
    saved: { text: 'saved ✓', color: 'var(--ink-faint)' },
    saving: { text: 'saving…', color: 'var(--accent)' },
    unsaved: { text: 'unsaved', color: 'var(--danger)' },
  }[status]
  return (
    <span style={{
      fontSize: '0.8rem',
      color: display.color,
      fontFamily: 'var(--font-ui)',
      fontStyle: 'italic',
    }}>
      {display.text}
    </span>
  )
}
