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
import { Drollery, Mark } from './ornament'

export default function MarginsPanel({ userId, campaignId, onClose }) {
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
    <div className="margins">
      <div className="panel-head">
        <h2 className="rubric">Margins</h2>
        <span className="meta">{active.length ? `${active.length} waiting` : 'empty'}</span>
        {onClose && (
          <button className="btn-icon btn-icon--bare" onClick={onClose} aria-label="Close the Margins inbox">×</button>
        )}
      </div>

      <div className="margins-composer">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Dump it here, sort it later…"
          rows={3}
          aria-label="New margin note"
        />
        <div className="margins-composer-foot">
          <span className="field-hint">Enter saves · Shift+Enter for a new line</span>
          <button className="btn-primary btn--sm" onClick={save} disabled={!input.trim()}>Note it</button>
        </div>
      </div>

      <div className="panel-body">
        {loading ? (
          <p className="hint home-pad">reading the margins…</p>
        ) : loadError ? (
          <p className="hint home-pad">{loadError}</p>
        ) : active.length === 0 ? (
          <div className="empty">
            <Drollery type="cat" width={170} />
            <p className="empty-title">Nothing waiting in the margins.</p>
            <p className="empty-body">Every loose note has found its page. The cat approves, or is asleep.</p>
          </div>
        ) : (
          <ul className="margins-list">
            {active.map((m) => (
              <MarginNote
                key={m.id}
                margin={m}
                actions={[
                  { label: '✓', title: 'Archive', run: () => act(() => archiveMargin(userId, campaignId, m.id), 'Could not archive that note.') },
                ]}
              />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <>
            <button className="margins-archived-toggle" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
              {showArchived ? '▾' : '▸'} archived ({archived.length})
            </button>
            {showArchived && (
              <ul className="margins-list">
                {archived.map((m) => (
                  <MarginNote
                    key={m.id}
                    margin={m}
                    archived
                    actions={[
                      { label: '↺', title: 'Restore', run: () => act(() => restoreMargin(userId, campaignId, m.id), 'Could not restore that note.') },
                      {
                        label: '×',
                        title: 'Delete permanently',
                        run: () => {
                          if (!confirm('Permanently delete this note? This cannot be undone.')) return
                          act(() => deleteMargin(userId, campaignId, m.id), 'Could not delete that note.')
                        },
                      },
                    ]}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MarginNote({ margin, archived, actions }) {
  return (
    <li className={`margin-note${archived ? ' is-archived' : ''}`}>
      <span className="log-mark"><Mark type="margin" size={20} title="" /></span>
      <span className="log-text">
        {margin.text}
        <span className="margin-note-when">{formatRelative(margin.createdAt)}</span>
      </span>
      <span className="margin-note-actions">
        {actions.map((a) => (
          <button key={a.label} className="btn-icon btn-icon--bare" aria-label={a.title} title={a.title} onClick={a.run}>
            {a.label}
          </button>
        ))}
      </span>
    </li>
  )
}
