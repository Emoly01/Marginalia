// Table view, right side while a session is live: the log in the margin
// hand, newest at the bottom, and the capture line pinned under it.
import { useState, useEffect, useRef } from 'react'
import { CAPTURE_MARKS } from '../lib/capture'
import { MARK_LABELS } from '../lib/marks'
import { toDate } from '../lib/sessionStatus'
import { Mark } from './ornament'
import MentionText from './MentionText'

const time = (ms) => {
  const d = toDate(ms)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

export default function LiveLog({ session, entries, entities, onCapture, onRemove, onOpenEntity }) {
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

  const current = CAPTURE_MARKS.find((m) => m.value === mark)
  const written = entries.filter((e) => !e.auto && e.mark !== 'auto').length

  return (
    <div className="table-log">
      <div className="table-log-head">
        <h2 className="rubric">Log</h2>
        <span className="meta">
          {entries.length === 0 ? 'nothing yet' : `${written} written · ${entries.length - written} from the sheet`}
        </span>
      </div>
      {session.intention && (
        <p className="table-intention">
          <span className="rubric rubric--quiet">Tonight</span> {session.intention}
        </p>
      )}

      <ol className="table-log-list" ref={listRef} aria-live="polite">
        {entries.length === 0 && <li className="table-log-empty">Type below, or tap a tracker.</li>}
        {entries.map((e) => {
          const auto = e.auto || e.mark === 'auto'
          const type = auto ? 'auto' : e.mark
          return (
            <li key={e.id} className="log-line">
              <span className="log-time">{time(e.clientAt)}</span>
              <span className={`log-mark log-mark--${type}`}>
                <Mark type={type} size={20} title={MARK_LABELS[type]} />
              </span>
              <span className={`log-text${auto ? ' log-text--auto' : ''}${type === 'milestone' ? ' log-text--milestone' : ''}`}>
                {auto ? (
                  e.text
                ) : e.entityId && onOpenEntity ? (
                  <button className="mention-word" onClick={() => onOpenEntity(e.entityId)}>{e.text}</button>
                ) : (
                  <MentionText text={e.text} entities={entities} onOpenEntity={onOpenEntity} />
                )}
              </span>
              <button
                className="btn-icon btn-icon--bare table-log-remove"
                onClick={() => confirm('Remove this line from the log?') && onRemove(e.id)}
                aria-label={`Remove “${e.text}”`}
              >
                ×
              </button>
            </li>
          )
        })}
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
              className="table-mark"
              aria-pressed={mark === m.value}
              aria-label={MARK_LABELS[m.value]}
              onClick={() => setMark(m.value)}
              title={m.prefix ? `${MARK_LABELS[m.value]} — or start the line with “${m.prefix}”` : MARK_LABELS[m.value]}
            >
              <Mark type={m.value} size={22} title="" />
            </button>
          ))}
          <span className="table-mark-name" aria-hidden="true">{MARK_LABELS[current?.value] ?? ''}</span>
        </div>
        <div className="table-capture-row">
          <input
            ref={inputRef}
            className="input-hand table-capture-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mark === 'npc' ? 'Name — who they are' : 'In the margin…'}
            aria-label="Log a line"
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary" disabled={!input.trim()}>Note it</button>
        </div>
      </form>
    </div>
  )
}
