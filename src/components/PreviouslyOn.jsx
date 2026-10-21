// Table view, right side before play: what happened last time, what's
// still open, and tonight's intention — then "Start session".
import { useState, useEffect } from 'react'
import { listSessionLog } from '../lib/log'
import { excerptFrom } from '../lib/text'
import { Mark } from './ornament'

export default function PreviouslyOn({ userId, campaignId, previous, threads, characterName, onStart, starting }) {
  const [mysteries, setMysteries] = useState([])
  const [intention, setIntention] = useState('')

  useEffect(() => {
    setMysteries([])
    if (!previous) return undefined
    let cancelled = false
    listSessionLog(userId, campaignId, previous.id)
      .then((entries) => {
        if (!cancelled) setMysteries(entries.filter((e) => e.mark === 'mystery' && !e.inked))
      })
      .catch((err) => console.error('Could not load last session’s log:', err))
    return () => { cancelled = true }
  }, [userId, campaignId, previous])

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

        {threads.length > 0 && (
          <section className="table-previously-list table-previously-list--ruled" aria-label="Open threads">
            <h3 className="rubric">Open threads</h3>
            <ul>
              {threads.map((t) => <li key={t.id}>{t.name}</li>)}
            </ul>
          </section>
        )}

        {mysteries.length > 0 && (
          <section className="table-previously-list" aria-label="Still unresolved">
            <h3 className="rubric">Still unresolved</h3>
            <ul>
              {mysteries.map((m) => (
                <li key={m.id} className="table-previously-mystery">
                  <Mark type="mystery" size={20} title="" />
                  <span>{m.text}</span>
                </li>
              ))}
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
