// Table view, right side before play: what happened last time, what's
// still open, and tonight's intention — then "Start session".
import { useState, useEffect } from 'react'
import { listSessionLog } from '../lib/log'
import { excerptFrom } from '../lib/text'

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
      <section className="panel table-previously-card">
        <h3 className="dossier-label">Previously on…</h3>
        {previous ? (
          <>
            <p className="table-previously-title">{previous.title}</p>
            {recap ? <p className="sheet-text">{recap}</p> : <p className="hint">no recap written for it yet</p>}
          </>
        ) : (
          <p className="hint">This is the first session.</p>
        )}

        {mysteries.length > 0 && (
          <>
            <h4 className="sheet-group-title">Still unexplained</h4>
            <ul className="sheet-notes">
              {mysteries.map((m) => <li key={m.id}>{m.text}</li>)}
            </ul>
          </>
        )}

        {threads.length > 0 && (
          <>
            <h4 className="sheet-group-title">Open threads</h4>
            <ul className="sheet-notes">
              {threads.map((t) => <li key={t.id}>{t.name}</li>)}
            </ul>
          </>
        )}
      </section>

      <form
        className="panel table-start"
        onSubmit={(e) => {
          e.preventDefault()
          onStart(intention)
        }}
      >
        <label className="field">
          <span className="field-label">What does {characterName || 'your character'} want tonight?</span>
          <input
            className="table-capture-input"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="one line, for yourself"
          />
        </label>
        <button type="submit" className="table-btn table-btn--primary" disabled={starting}>
          {starting ? 'Starting…' : 'Start session'}
        </button>
      </form>
    </div>
  )
}
