// Table view, right side while a session is live: the log, newest at the
// bottom, and the one-line capture pinned under it.
import { useState, useEffect, useRef } from 'react'
import { CAPTURE_MARKS, markLabel } from '../lib/capture'
import { toDate } from '../lib/sessionStatus'

const time = (ms) => {
  const d = toDate(ms)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

export default function LiveLog({ session, entries, onCapture, onRemove, onOpenEntity }) {
  const [input, setInput] = useState('')
  const [mark, setMark] = useState('note')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  // Keep the newest line in view as entries arrive.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  const submit = () => {
    if (onCapture(input, mark)) {
      setInput('')
      setMark('note')
    }
    inputRef.current?.focus()
  }

  return (
    <div className="table-log">
      {session.intention && (
        <p className="table-intention">
          <span className="dossier-label">Tonight</span> {session.intention}
        </p>
      )}

      <ol className="table-log-list" ref={listRef} aria-live="polite">
        {entries.length === 0 && <li className="hint">nothing yet — type below, or tap a tracker</li>}
        {entries.map((e) => (
          <li key={e.id} className={`table-log-entry table-log-entry--${e.mark}`}>
            <span className="table-log-time">{time(e.clientAt)}</span>
            {e.mark !== 'note' && <span className="table-log-mark">{markLabel(e.mark)}</span>}
            <span className="table-log-text">
              {e.entityId && onOpenEntity ? (
                <button className="table-log-link" onClick={() => onOpenEntity(e.entityId)}>{e.text}</button>
              ) : (
                e.text
              )}
            </span>
            <button
              className="btn-icon table-log-remove"
              onClick={() => confirm('Remove this line from the log?') && onRemove(e.id)}
              aria-label={`Remove “${e.text}”`}
            >
              ×
            </button>
          </li>
        ))}
      </ol>

      <form
        className="table-capture"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="table-marks" role="group" aria-label="Mark this line as">
          {CAPTURE_MARKS.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`table-mark${mark === m.value ? ' is-on' : ''}`}
              aria-pressed={mark === m.value}
              onClick={() => setMark(m.value)}
              title={m.prefix ? `or start the line with “${m.prefix}”` : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="table-capture-row">
          <input
            ref={inputRef}
            className="table-capture-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mark === 'npc' ? 'Name — who they are' : 'what just happened…  (npc: q: ?: !: $:)'}
            aria-label="Log a line"
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="submit" className="table-btn table-btn--primary" disabled={!input.trim()}>Log</button>
        </div>
      </form>
    </div>
  )
}
