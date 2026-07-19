import { useState, useEffect } from 'react'
import {
  listEntities,
  createEntity,
  ENTITY_TYPES,
  entityTypeInfo,
} from '../lib/entities'
import { toast } from '../lib/toast'

export default function EntitiesView({ userId, campaignId, onOpenEntity, refreshTrigger }) {
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState('all')

  const refresh = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listEntities(userId, campaignId)
      setEntities(list)
    } catch (err) {
      console.error('Failed to load entities:', err)
      setLoadError(err.message || 'Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, refreshTrigger])

  const handleCreate = async (type) => {
    const name = window.prompt(`New ${entityTypeInfo(type).label} name:`)
    if (!name || !name.trim()) return
    try {
      const id = await createEntity(userId, campaignId, { name: name.trim(), type })
      await refresh()
      onOpenEntity(id)
    } catch (err) {
      console.error('Failed to create entity:', err)
      toast('Could not create entity.')
    }
  }

  const filtered = filter === 'all'
    ? entities
    : entities.filter((e) => e.type === filter)

  // Group by type for display
  const grouped = {}
  filtered.forEach((e) => {
    if (!grouped[e.type]) grouped[e.type] = []
    grouped[e.type].push(e)
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-md)',
        flexWrap: 'wrap',
        gap: 'var(--space-sm)',
      }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            all
          </FilterChip>
          {ENTITY_TYPES.map((t) => (
            <FilterChip
              key={t.value}
              active={filter === t.value}
              onClick={() => setFilter(t.value)}
              color={t.color}
            >
              {t.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Create buttons */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
      }}>
        {ENTITY_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => handleCreate(t.value)}
            style={{
              background: 'var(--bg-input)',
              color: 'var(--ink-muted)',
              padding: 'var(--space-xs) var(--space-md)',
              borderRadius: 'var(--radius)',
              border: '1px dashed var(--border)',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
            }}
          >
            + {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>loading…</p>
      ) : loadError ? (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-lg)',
          color: 'var(--danger)',
          fontSize: '0.9rem',
        }}>
          <strong>Could not load entities:</strong>
          <div style={{ marginTop: 'var(--space-xs)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {loadError}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--ink-muted)',
          fontStyle: 'italic',
        }}>
          {filter === 'all'
            ? 'no entities yet — create one above, or type @ while writing a session'
            : `no ${filter}s yet`}
        </div>
      ) : (
        <div>
          {ENTITY_TYPES.filter((t) => grouped[t.value]?.length).map((t) => (
            <div key={t.value} style={{ marginBottom: 'var(--space-lg)' }}>
              <h4 style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-faint)',
                fontFamily: 'var(--font-ui)',
                marginBottom: 'var(--space-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: t.color,
                }} />
                {t.label}s
                <span style={{ color: 'var(--ink-faint)', fontWeight: 'normal' }}>
                  ({grouped[t.value].length})
                </span>
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--space-sm)',
              }}>
                {grouped[t.value].map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onOpenEntity(e.id)}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `3px solid ${t.color}`,
                      borderRadius: 'var(--radius)',
                      padding: 'var(--space-sm) var(--space-md)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(ev) => ev.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={(ev) => ev.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    <div style={{ color: 'var(--ink)', fontSize: '0.95rem' }}>
                      {e.name}
                    </div>
                    {(e.connections?.length > 0) && (
                      <div style={{
                        color: 'var(--ink-faint)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-ui)',
                        marginTop: '2px',
                      }}>
                        {e.connections.length} connection{e.connections.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: '12px',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--ink-muted)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
        fontFamily: 'var(--font-ui)',
        fontSize: '0.8rem',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
