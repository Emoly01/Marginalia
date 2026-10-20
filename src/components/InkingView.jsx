// /campaigns/:id/sessions/:id/ink — after play, one item at a time: each
// typed log line, then each loose margin, goes into the recap, becomes or
// joins an entity, or is tossed. Then a few recall prompts, and the session
// is inked. Behaviour lives in useInking; this is layout.
import { useState, useEffect, useMemo } from 'react'
import { useInking } from '../lib/useInking'
import { suggestEntity, recallPrompts, recapBlocks, ENTITY_TYPES_FOR_INKING } from '../lib/inking'
import { entityTypeInfo } from '../lib/entities'
import { markLabel, findEntityByName } from '../lib/capture'
import { toDate } from '../lib/sessionStatus'

const time = (ms) => {
  const d = toDate(ms)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

export default function InkingView({ userId, campaignId, session, entities, characterName, onEntitiesChanged, onDone, onBack }) {
  const ink = useInking(userId, campaignId, session, { entities, onEntitiesChanged })
  const [phase, setPhase] = useState('queue') // queue | recall
  const prompts = useMemo(() => recallPrompts(characterName), [characterName])
  const [answers, setAnswers] = useState(() => prompts.map(() => ''))

  const current = ink.remaining[0]
  const done = ink.queue.length - ink.remaining.length

  const finish = () => {
    ink.finish(prompts, answers)
    onDone()
  }

  return (
    <div className="view">
      <header className="view-header">
        <div className="row-between">
          <div style={{ minWidth: 0 }}>
            <h2 className="view-title">Inking</h2>
            <p className="view-subtitle">{session.title}</p>
          </div>
          <button className="btn" onClick={onBack}>← back to the session</button>
        </div>
      </header>

      <div className="view-body">
        {ink.loadError ? (
          <div className="error-note" role="alert">could not load this session — {ink.loadError}</div>
        ) : ink.loading ? (
          <p className="hint">gathering the night’s notes…</p>
        ) : (
          <div className="ink">
            <div className="ink-main">
              {phase === 'queue' ? (
                <>
                  <p className="hint" aria-live="polite">
                    {ink.queue.length === 0
                      ? 'nothing in the log or the margins to sort'
                      : `${done} of ${ink.queue.length} sorted`}
                  </p>
                  {current ? (
                    <InkItem key={current.key} item={current} entities={ink.entities} onAct={(opts) => ink.act(current, opts)} />
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-title">all sorted</span>
                      <span className="empty-state-sub">a few questions before the ink dries.</span>
                    </div>
                  )}
                  <div className="sheet-actions">
                    <button className={current ? 'btn' : 'btn-primary'} onClick={() => setPhase('recall')}>
                      {current ? 'Skip to recall — the rest stays queued' : 'Continue'}
                    </button>
                  </div>
                </>
              ) : (
                <form
                  className="panel ink-recall"
                  onSubmit={(e) => {
                    e.preventDefault()
                    finish()
                  }}
                >
                  <p className="dossier-hint">Anything that didn’t make it into the log. Blank answers are left out.</p>
                  {prompts.map((p, i) => (
                    <label key={p} className="field">
                      <span className="field-label">{p}</span>
                      <textarea
                        rows={2}
                        value={answers[i]}
                        onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    </label>
                  ))}
                  <div className="sheet-actions">
                    <button type="button" className="btn" onClick={() => setPhase('queue')}>Back to the queue</button>
                    <button type="submit" className="btn-primary">Finish inking</button>
                  </div>
                </form>
              )}

              <details className="panel sheet-details ink-recap">
                <summary className="dossier-label">Recap so far</summary>
                <RecapPreview html={ink.content} />
              </details>
            </div>

            <aside className="ink-timeline" aria-label="What the sheet logged">
              <h3 className="dossier-label">At the table</h3>
              {ink.timeline.length === 0 ? (
                <p className="hint">no tracker taps logged</p>
              ) : (
                <ol className="ink-timeline-list">
                  {ink.timeline.map((e) => (
                    <li key={e.id}>
                      <span className="table-log-time">{time(e.clientAt)}</span> {e.text}
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function InkItem({ item, entities, onAct }) {
  const suggestion = useMemo(() => suggestEntity(item), [item])
  const [text, setText] = useState(item.text)
  const [newType, setNewType] = useState(suggestion.type)
  const [newName, setNewName] = useState(suggestion.name)
  const sorted = useMemo(() => [...entities].sort((a, b) => a.name.localeCompare(b.name)), [entities])
  const [linkId, setLinkId] = useState(item.entityId && entities.some((e) => e.id === item.entityId) ? item.entityId : '')
  useEffect(() => {
    if (!linkId && item.entityId && entities.some((e) => e.id === item.entityId)) setLinkId(item.entityId)
  }, [entities, item.entityId, linkId])

  const linked = entities.find((e) => e.id === linkId)
  const clash = findEntityByName(entities, newName)

  return (
    <article className="panel ink-item">
      <p className="ink-item-meta">
        <span className="table-log-mark">{item.kind === 'margin' ? 'margin' : markLabel(item.mark)}</span>
        {item.at && <span className="table-log-time"> {time(item.at)}</span>}
      </p>
      <label className="field">
        <span className="field-label">The line — edit before it goes anywhere</span>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="ink-actions">
        <button className="btn-primary" onClick={() => onAct({ action: 'recap', text })} disabled={!text.trim()}>
          Add to recap
        </button>

        <div className="ink-action-row">
          <select value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Kind of entity">
            {ENTITY_TYPES_FOR_INKING.map((t) => (
              <option key={t} value={t}>{entityTypeInfo(t).label}</option>
            ))}
          </select>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="name" aria-label="New entity name" />
          <button
            className="btn-quiet"
            disabled={!newName.trim() || Boolean(clash)}
            onClick={() => onAct({ action: 'entity', text, create: { type: newType, name: newName.trim() } })}
          >
            Make entity
          </button>
        </div>
        {clash && <p className="field-hint">“{clash.name}” already exists — link to it below instead.</p>}

        <div className="ink-action-row">
          <select value={linkId} onChange={(e) => setLinkId(e.target.value)} aria-label="Existing entity">
            <option value="">link to an existing entity…</option>
            {sorted.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {entityTypeInfo(e.type).label}
              </option>
            ))}
          </select>
          <button className="btn-quiet" disabled={!linked} onClick={() => onAct({ action: 'link', text, entity: linked })}>
            Link
          </button>
        </div>

        <div className="ink-action-row">
          <button className="btn-danger" onClick={() => onAct({ action: 'toss' })}>Toss</button>
          {item.kind === 'margin' && (
            <button className="btn" onClick={() => onAct({ action: 'later' })}>Keep for later</button>
          )}
        </div>
      </div>
    </article>
  )
}

function RecapPreview({ html }) {
  const blocks = recapBlocks(html)
  if (blocks.length === 0) return <p className="hint">empty so far</p>
  return (
    <div className="ink-recap-body">
      {blocks.map((b, i) =>
        b.kind === 'heading' ? <h4 key={i} className="sheet-group-title">{b.text}</h4> : <p key={i} className="sheet-text">{b.text}</p>
      )}
    </div>
  )
}
