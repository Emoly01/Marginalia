// Table view, right side while a session is live: the log in the margin
// hand, newest at the bottom, and the capture line pinned under it. The
// head flips the list to the campaign's open questions — one tap, no
// scrolling back through the log — with the capture line still there, so a
// new `?:` line lands in the list as it is typed.
import { useState, useEffect, useRef } from 'react'
import { CAPTURE_MARKS } from '../lib/capture'
import { MARK_LABELS } from '../lib/marks'
import { toDate } from '../lib/sessionStatus'
import { Mark } from './ornament'
import MentionText from './MentionText'
import { QuestionRow } from './QuestionsView'

const time = (ms) => {
  const d = toDate(ms)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

export default function LiveLog({ session, entries, entities, onCapture, onRemove, onOpenEntity, questions = [], questionActions }) {
  const [view, setView] = useState('log') // 'log' | 'questions'
  const [input, setInput] = useState('')
  const [mark, setMark] = useState('note')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  // Keep the newest line in view as entries arrive (and on flipping back).
  useEffect(() => {
    const el = listRef.current
    if (el && view === 'log') el.scrollTop = el.scrollHeight
  }, [entries.length, view])

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
        <div className="tabs tabs--start table-log-tabs" role="tablist" aria-label="Show">
          <button role="tab" id="live-tab-log" aria-selected={view === 'log'} aria-controls="live-panel" className="tab" onClick={() => setView('log')}>
            Log
          </button>
          <button role="tab" id="live-tab-questions" aria-selected={view === 'questions'} aria-controls="live-panel" className="tab" onClick={() => setView('questions')}>
            Questions <span className="toggle-count">{questions.length}</span>
          </button>
        </div>
        <span className="meta">
          {view === 'questions'
            ? questions.length === 0 ? 'nothing open' : 'still open, newest first'
            : entries.length === 0 ? 'nothing yet' : `${written} written · ${entries.length - written} from the sheet`}
        </span>
      </div>
      {session.intention && (
        <p className="table-intention">
          <span className="rubric rubric--quiet">Tonight</span> {session.intention}
        </p>
      )}

      {view === 'questions' ? (
        <ol className="table-log-list table-questions" id="live-panel" role="tabpanel" aria-labelledby="live-tab-questions">
          {questions.length === 0 && (
            <li className="table-log-empty">No open questions. Start a line with ?: and it lands here.</li>
          )}
          {questions.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              entities={entities}
              compact
              onOpenEntity={onOpenEntity}
              onAnswer={(text) => questionActions?.answer(q, text)}
              onAside={() => questionActions?.setAside(q)}
              onReopen={() => questionActions?.reopen(q)}
            />
          ))}
        </ol>
      ) : (
        <ol className="table-log-list" ref={listRef} id="live-panel" role="tabpanel" aria-labelledby="live-tab-log" aria-live="polite">
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
      )}

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
