// Questions: everything I've wondered about in a campaign, fished out of
// the log, the recaps, the codex and the margins, so it stops drowning in
// the notes around it. Open ones first; answered ones keep their answer.
import { useState, useEffect, useRef } from 'react'
import { markQuestion, reopenQuestion } from '../lib/questionMarks'
import { sourceLabel } from '../lib/questions'
import { useQuestions } from '../lib/useQuestions'
import { toast } from '../lib/toast'
import { Drollery, Mark } from './ornament'
import MentionText from './MentionText'

const VIEWS = [
  { value: 'open', label: 'Open' },
  { value: 'answered', label: 'Answered' },
  { value: 'aside', label: 'Set aside' },
]

export default function QuestionsView({ userId, campaignId, sessions, entities, onOpenSession, onOpenEntity }) {
  const [view, setView] = useState('open')
  const { questions, groups } = useQuestions(userId, campaignId, sessions, entities)
  const list = groups[view]

  const act = (promise, failure) =>
    Promise.resolve(promise).catch((err) => {
      console.error(failure, err)
      toast(failure)
    })

  const answer = (q, text) => act(markQuestion(userId, campaignId, q, { status: 'answered', answer: text }), 'Could not mark that answered.')
  const setAside = (q) => act(markQuestion(userId, campaignId, q, { status: 'aside' }), 'Could not set that aside.')
  const reopen = (q) => act(reopenQuestion(userId, campaignId, q.id), 'Could not reopen that question.')

  return (
    <div className="page-wide">
      <header className="page-head">
        <div className="page-head-text">
          <h1 className="title page-title">Questions</h1>
          <span className="meta">everything you’ve wondered, fished out of your notes</span>
        </div>
      </header>

      <div className="toggle-row" role="group" aria-label="Show">
        {VIEWS.map((v) => (
          <button key={v.value} className="toggle" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
            {v.label} <span className="toggle-count">{groups[v.value].length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="panel empty">
          <Drollery type="owl" width={200} />
          <p className="empty-title">
            {view === 'open' ? (questions.length ? 'Nothing left open.' : 'No questions yet.') : view === 'answered' ? 'Nothing answered yet.' : 'Nothing set aside.'}
          </p>
          {view === 'open' && (
            <p className="empty-body">
              End a sentence with <strong>?</strong> anywhere — a recap, a codex page, a margin — or start a line with{' '}
              <strong>?:</strong>, and it turns up here.
            </p>
          )}
        </div>
      ) : (
        <ol className="panel question-list">
          {list.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              entities={entities}
              onOpenSession={onOpenSession}
              onOpenEntity={onOpenEntity}
              onAnswer={(text) => answer(q, text)}
              onAside={() => setAside(q)}
              onReopen={() => reopen(q)}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function QuestionRow({ question: q, entities, onOpenSession, onOpenEntity, onAnswer, onAside, onReopen }) {
  const [answering, setAnswering] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const status = q.mark?.status ?? 'open'

  useEffect(() => {
    if (answering) inputRef.current?.focus()
  }, [answering])

  const submit = (e) => {
    e.preventDefault()
    onAnswer(draft)
    setAnswering(false)
    setDraft('')
  }

  return (
    <li className={`question-row question-row--${status}`}>
      <span className="question-mark" aria-hidden="true">
        <Mark type="mystery" size={22} title="" />
      </span>
      <div className="question-main">
        {q.context && <p className="question-context">{q.context}</p>}
        <p className="question-text">
          <MentionText text={q.text} entities={entities} onOpenEntity={onOpenEntity} />
        </p>
        {status === 'answered' && q.mark.answer && <p className="question-answer">{q.mark.answer}</p>}
        <p className="question-where">
          {q.sources.map((s, i) => {
            const label = sourceLabel(s)
            const go = s.kind === 'entity' ? () => onOpenEntity(s.entityId) : s.sessionId ? () => onOpenSession(s.sessionId) : null
            return (
              <span key={`${s.kind}:${s.sessionId ?? s.entityId ?? s.marginId}:${i}`} className="question-where-item">
                {go ? <button className="btn-link" onClick={go}>{label}</button> : label}
              </span>
            )
          })}
        </p>
        {answering && (
          <form className="question-answer-form" onSubmit={submit}>
            <input
              ref={inputRef}
              className="input-hand"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAnswering(false)}
              placeholder="the answer, if you have it — or leave it blank"
              aria-label="Answer"
            />
            <button type="submit" className="btn-primary btn--sm">Save</button>
            <button type="button" className="btn-quiet btn--sm" onClick={() => setAnswering(false)}>Cancel</button>
          </form>
        )}
      </div>
      <div className="question-actions">
        {status === 'open' ? (
          !answering && (
            <>
              <button className="btn-quiet btn--sm" onClick={() => setAnswering(true)}>Answered</button>
              <button className="btn-link question-aside" onClick={onAside} title="Not really a question">Set aside</button>
            </>
          )
        ) : (
          <button className="btn-link question-aside" onClick={onReopen}>{status === 'answered' ? 'Reopen' : 'Bring back'}</button>
        )}
      </div>
    </li>
  )
}
