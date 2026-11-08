// Table view, right side before play: what happened last time, every
// question still open across the campaign, the open threads, and tonight's
// intention — then "Start session".
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { excerptFrom } from '../lib/text'
import { sourceLabel } from '../lib/questions'
import { useQuestions } from '../lib/useQuestions'
import { Mark } from './ornament'
import MentionText from './MentionText'

export default function PreviouslyOn({ userId, campaignId, previous, sessions, entities, threads, characterName, onStart, starting, onOpenEntity }) {
  const [intention, setIntention] = useState('')
  const { groups } = useQuestions(userId, campaignId, sessions, entities)
  const open = groups.open

  const recap = previous ? excerptFrom(previous.content, 320) : ''

  return (
    <div className="table-previously">
      <div className="table-previously-body">
        <h2 className="title table-previously-title">Previously on…</h2>
        {previous ? (
          <>
            <p className="rubric rubric--quiet">
              {[previous.sessionNumber && `Session ${previous.sessionNumber}`, previous.title].filter(Boolean).join(' · ')}
            </p>
            {recap ? <p className="table-previously-recap">{recap}</p> : <p className="hint">No recap written for it yet.</p>}
          </>
        ) : (
          <p className="hint">This is the first session.</p>
        )}

        {open.length > 0 && (
          <section className="table-previously-list table-previously-list--ruled table-previously-list--questions" aria-labelledby="open-questions-head">
            <div className="table-previously-list-head">
              <h3 className="rubric" id="open-questions-head">Open questions · {open.length}</h3>
              <Link className="btn-link table-previously-more" to={`/campaigns/${campaignId}?tab=questions`}>
                Answer or set aside
              </Link>
            </div>
            <ul>
              {open.map((q) => (
                <li key={q.id} className="table-previously-mystery">
                  <Mark type="mystery" size={20} title="" />
                  <span className="table-previously-question">
                    {q.context && <span className="table-previously-context">{q.context}</span>}
                    <span>
                      <MentionText text={q.text} entities={entities} onOpenEntity={onOpenEntity} />
                    </span>
                    {q.sources[0] && <span className="table-previously-from">{sourceLabel(q.sources[0])}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {threads.length > 0 && (
          <section className="table-previously-list table-previously-list--ruled" aria-label="Open threads">
            <h3 className="rubric">Open threads</h3>
            <ul>
              {threads.map((t) => <li key={t.id}>{t.name}</li>)}
            </ul>
          </section>
        )}
      </div>

      <form
        className="table-start"
        onSubmit={(e) => {
          e.preventDefault()
          onStart(intention)
        }}
      >
        <label className="field">
          <span className="rubric">What {characterName || 'your character'} wants tonight</span>
          <input
            className="input-hand"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="one line, for yourself"
          />
        </label>
        <button type="submit" className="btn-primary btn--lg" disabled={starting}>
          {starting ? 'Starting…' : 'Start session'}
        </button>
      </form>
    </div>
  )
}
