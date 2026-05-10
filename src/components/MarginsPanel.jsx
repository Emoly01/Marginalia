import { useState, useEffect, useRef } from 'react'
import {
  listAllMargins,
  createMargin,
  archiveMargin,
  restoreMargin,
  deleteMargin,
} from '../lib/margins'
import { formatRelative } from '../lib/formatRelative'

export default function MarginsPanel({ userId, campaignId }) {
  const [margins, setMargins] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [input, setInput] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const inputRef = useRef(null)

  // Load margins on mount / campaign change
  useEffect(() => {
    if (!campaignId) return
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const refresh = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const all = await listAllMargins(userId, campaignId)
      setMargins(all)
    } catch (err) {
      console.error('Failed to load margins:', err)
      setLoadError(err.message || 'Failed to load')
    }
    setLoading(false)
  }

  const handleKeyDown = async (e) => {
    // Enter to save, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = input.trim()
      if (!text) return
      try {
        await createMargin(userId, campaignId, text)
        setInput('')
        await refresh()
        inputRef.current?.focus()
      } catch (err) {
        console.error('Failed to create margin:', err)
      }
    }
  }

  const handleArchive = async (id) => {
    try {
      await archiveMargin(userId, campaignId, id)
      await refresh()
    } catch (err) {
      console.error('Failed to archive:', err)
    }
  }

  const handleRestore = async (id) => {
    try {
      await restoreMargin(userId, campaignId, id)
      await refresh()
    } catch (err) {
      console.error('Failed to restore:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this note? This cannot be undone.')) return
    try {
      await deleteMargin(userId, campaignId, id)
      await refresh()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const activeMargins = margins.filter((m) => !m.archived)
  const archivedMargins = margins.filter((m) => m.archived)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 'var(--space-md)',
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-ui)',
          marginBottom: 'var(--space-xs)',
        }}>
          Margins
        </label>
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
        }}>
          dump it here, sort it later
        </p>
      </div>

      {/* Active notes list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: 'var(--space-md)',
      }}>
        {loading ? (
          <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: '0.85rem' }}>
            loading…
          </p>
        ) : loadError ? (
          <p style={{ color: 'var(--danger)', fontStyle: 'italic', fontSize: '0.8rem' }}>
            error: {loadError}
          </p>
        ) : activeMargins.length === 0 ? (
          <p style={{
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            fontSize: '0.85rem',
            padding: 'var(--space-sm) 0',
          }}>
            nothing yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {activeMargins.map((m) => (
              <MarginCard
                key={m.id}
                margin={m}
                onArchive={() => handleArchive(m.id)}
              />
            ))}
          </div>
        )}

        {/* Archived section */}
        {archivedMargins.length > 0 && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              style={{
                fontSize: '0.75rem',
                color: 'var(--ink-faint)',
                fontFamily: 'var(--font-ui)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 'var(--space-sm)',
                padding: 0,
              }}
            >
              {showArchived ? '▾' : '▸'} archived ({archivedMargins.length})
            </button>
            {showArchived && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {archivedMargins.map((m) => (
                  <MarginCard
                    key={m.id}
                    margin={m}
                    archived
                    onRestore={() => handleRestore(m.id)}
                    onDelete={() => handleDelete(m.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-add input */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 'var(--space-md)',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="capture something… (enter to save, shift+enter for newline)"
          rows={3}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--ink)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            padding: 'var(--space-sm)',
            resize: 'none',
            borderRadius: 'var(--radius)',
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  )
}

function MarginCard({ margin, archived, onArchive, onRestore, onDelete }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius)',
      padding: 'var(--space-sm)',
      opacity: archived ? 0.6 : 1,
    }}>
      <div style={{
        color: 'var(--ink)',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {margin.text}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'var(--space-xs)',
      }}>
        <span style={{
          color: 'var(--ink-faint)',
          fontSize: '0.7rem',
          fontFamily: 'var(--font-ui)',
          fontStyle: 'italic',
        }}>
          {formatRelative(margin.createdAt)}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {archived ? (
            <>
              <button
                onClick={onRestore}
                title="Restore"
                style={iconButtonStyle}
              >
                ↺
              </button>
              <button
                onClick={onDelete}
                title="Delete permanently"
                style={{ ...iconButtonStyle, color: 'var(--danger)' }}
              >
                ×
              </button>
            </>
          ) : (
            <button
              onClick={onArchive}
              title="Archive"
              style={iconButtonStyle}
            >
              ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const iconButtonStyle = {
  color: 'var(--ink-faint)',
  fontSize: '0.85rem',
  padding: '2px 6px',
  fontFamily: 'var(--font-ui)',
  borderRadius: '3px',
  cursor: 'pointer',
}
