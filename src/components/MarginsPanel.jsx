import { useState, useEffect, useRef, useCallback } from 'react'
import {
  listAllMargins,
  createMargin,
  archiveMargin,
  restoreMargin,
  deleteMargin,
} from '../lib/margins'
import { formatRelative } from '../lib/formatRelative'
import { toast } from '../lib/toast'

export default function MarginsPanel({ userId, campaignId }) {
  const [margins, setMargins] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [input, setInput] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const inputRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setMargins(await listAllMargins(userId, campaignId))
    } catch (err) {
      console.error('Failed to load margins:', err)
      setLoadError(err.message || 'Failed to load')
    }
    setLoading(false)
  }, [userId, campaignId])

  useEffect(() => {
    if (campaignId) refresh()
  }, [campaignId, refresh])

  const save = async () => {
    const text = input.trim()
    if (!text) return
    try {
      await createMargin(userId, campaignId, text)
      setInput('')
      await refresh()
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to create margin:', err)
      toast('Could not save that note.')
    }
  }

  // Enter saves, shift+enter breaks the line.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      save()
    }
  }

  const act = async (fn, failure) => {
    try {
      await fn()
      await refresh()
    } catch (err) {
      console.error(failure, err)
      toast(failure)
    }
  }

  const active = margins.filter((m) => !m.archived)
  const archived = margins.filter((m) => m.archived)

  return (
    <>
      <div className="margins-head">
        <span>Margins</span>
        <span className="rail-count">{active.length}</span>
      </div>

      <div className="margins-composer">
        <div className="margins-composer-inner">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="dump it here, sort it later…"
            rows={3}
          />
          <div className="row-between">
            <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--m-text-4)' }}>
              enter to save · shift+enter for a line
            </span>
            <button className="btn-primary btn-primary--sm" onClick={save} disabled={!input.trim()}>
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="margins-list">
        {loading ? (
          <p className="hint">loading…</p>
        ) : loadError ? (
          <p className="hint" style={{ color: 'var(--m-danger)' }}>{loadError}</p>
        ) : active.length === 0 ? (
          <p className="hint">nothing in the margins yet</p>
        ) : (
          active.map((m) => (
            <MarginNote
              key={m.id}
              margin={m}
              actions={[
                { label: '✓', title: 'Archive', run: () => act(() => archiveMargin(userId, campaignId, m.id), 'Could not archive that note.') },
              ]}
            />
          ))
        )}

        {archived.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <button
              onClick={() => setShowArchived((v) => !v)}
              style={{
                fontSize: '11px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--m-text-4)',
                textAlign: 'left',
                padding: 0,
              }}
            >
              {showArchived ? '▾' : '▸'} archived ({archived.length})
            </button>
            {showArchived &&
              archived.map((m) => (
                <MarginNote
                  key={m.id}
                  margin={m}
                  archived
                  actions={[
                    { label: '↺', title: 'Restore', run: () => act(() => restoreMargin(userId, campaignId, m.id), 'Could not restore that note.') },
                    {
                      label: '×',
                      title: 'Delete permanently',
                      danger: true,
                      run: () => {
                        if (!confirm('Permanently delete this note? This cannot be undone.')) return
                        act(() => deleteMargin(userId, campaignId, m.id), 'Could not delete that note.')
                      },
                    },
                  ]}
                />
              ))}
          </div>
        )}
      </div>
    </>
  )
}

function MarginNote({ margin, archived, actions }) {
  return (
    <div className={`margin-note${archived ? ' is-archived' : ''}`}>
      <div className="margin-note-text">{margin.text}</div>
      <div className="margin-note-foot">
        <span className="margin-note-when">{formatRelative(margin.createdAt)}</span>
        <div className="margin-note-actions">
          {actions.map((a) => (
            <button
              key={a.label}
              className="btn-icon"
              title={a.title}
              onClick={a.run}
              style={a.danger ? { color: 'var(--m-danger)' } : undefined}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
