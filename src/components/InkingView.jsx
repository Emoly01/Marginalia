// /campaigns/:id/sessions/:id/ink — the scribe's quiet ritual after play.
// Left: the night's record. Middle: one entry at a time (each typed log
// line, then each loose margin) — into the recap, into the codex, linked to
// a page, kept for later or tossed — then a few recall prompts, one by one.
// Right: the recap as it grows. Behaviour lives in useInking.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useInking } from '../lib/useInking'
import { suggestEntity, suggestLinks, recallPrompts, recallChips, recapBlocks, RECALL_HINTS } from '../lib/inking'
import { ENTITY_TYPES, entityTypeInfo } from '../lib/entities'
import { findEntityByName } from '../lib/capture'
import { MARK_LABELS } from '../lib/marks'
import { stripAt } from '../lib/mentionText'
import { toDate } from '../lib/sessionStatus'
import { IlluminatedTitle, Mark, Drollery } from './ornament'
import MentionText from './MentionText'

const time = (ms) => toDate(ms)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? ''

function resultLabel(r) {
  if (!r) return ''
  switch (r.action) {
    case 'recap':
      return 'Added to recap'
    case 'entity':
      return `Made ${entityTypeInfo(r.target?.type).label} page`
    case 'link':
      return `Linked · ${r.target?.name ?? ''}`
    case 'later':
      return 'Kept for later'
    case 'toss':
      return 'Tossed'
    default:
      return ''
  }
}

export default function InkingView({ userId, campaignId, session, entities, characterName, onEntitiesChanged, onDone, onBack }) {
  const ink = useInking(userId, campaignId, session, { entities, onEntitiesChanged })
  const [stage, setStage] = useState('entries') // entries | prompts | done
  const prompts = useMemo(() => recallPrompts(characterName), [characterName])
  const [answers, setAnswers] = useState(() => prompts.map(() => ''))
  const [pIdx, setPIdx] = useState(0)

  const current = ink.remaining[0]
  const done = ink.queue.length - ink.remaining.length
  const position = Math.min(done + 1, ink.queue.length)

  // R / T / K while sorting, unless typing.
  const quick = useCallback(
    (e) => {
      if (stage !== 'entries' || !current) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'r') ink.act(current, { action: 'recap' })
      else if (k === 't') ink.act(current, { action: 'toss' })
      else if (k === 'k') ink.act(current, { action: 'later' })
    },
    [stage, current, ink]
  )
  useEffect(() => {
    window.addEventListener('keydown', quick)
    return () => window.removeEventListener('keydown', quick)
  }, [quick])

  const goBack = () => {
    if (stage === 'prompts' && pIdx > 0) return setPIdx((i) => i - 1)
    if (stage === 'prompts') setStage('entries')
    ink.back()
  }

  const seal = () => {
    ink.finish(prompts, answers)
    setStage('done')
  }

  const record = useMemo(
    () => [...ink.entries].sort((a, b) => (a.clientAt ?? 0) - (b.clientAt ?? 0)),
    [ink.entries]
  )
  const range = record.length ? `${time(record[0].clientAt)} – ${time(record[record.length - 1].clientAt)}` : ''
  const blocks = recapBlocks(ink.content)
  const results = Object.values(ink.results)
  const madePages = results.filter((r) => r.action === 'entity')
  const kept = results.filter((r) => r.action === 'later').length

  const progressLabel =
    stage === 'entries'
      ? ink.queue.length
        ? `${done} of ${ink.queue.length} notes inked`
        : 'nothing waiting in the log or the margins'
      : stage === 'prompts'
        ? 'Notes inked · now, from memory'
        : 'Inked tonight'

  return (
    <>
      <div className="toolbar ink-toolbar">
        <IlluminatedTitle text="Inking" as="h1" size={46} className="ink-title" />
        <div className="ink-toolbar-meta">
          <span className="rubric">Session {session.sessionNumber} · {session.title}</span>
          <span className="meta" aria-live="polite">{progressLabel}</span>
        </div>
        <span className="toolbar-spacer" />
        {stage === 'entries' && current && <span className="meta kbd--hint">R recap · T toss · K keep</span>}
        <button className="btn" onClick={onBack}>Finish later</button>
      </div>

      {ink.loadError ? (
        <div className="waiting">could not load this session — {ink.loadError}</div>
      ) : ink.loading ? (
        <div className="waiting">gathering the night’s notes…</div>
      ) : (
        <div className="ink">
          <aside className="panel panel-col ink-record" aria-labelledby="record-head">
            <div className="panel-head">
              <h2 className="rubric" id="record-head">The night’s record</h2>
              <span className="meta">{range}</span>
            </div>
            <div className="panel-body">
              {record.length === 0 ? (
                <p className="hint home-pad">No log for this session.</p>
              ) : (
                <ol className="ink-record-list">
                  {record.map((e) => {
                    const auto = e.auto || e.mark === 'auto'
                    const r = ink.results[`log:${e.id}`]
                    const isCurrent = stage === 'entries' && current?.kind === 'log' && current.id === e.id
                    const status = r ? resultLabel(r) : e.inked ? 'Inked before' : ''
                    return (
                      <li key={e.id} className={`log-line ink-record-line${isCurrent ? ' is-current' : ''}${r?.action === 'toss' ? ' is-tossed' : ''}`}>
                        <span className="log-time">{time(e.clientAt)}</span>
                        <span className={`log-mark log-mark--${auto ? 'auto' : e.mark}`}><Mark type={auto ? 'auto' : e.mark} size={18} /></span>
                        <span className={`log-text${auto ? ' log-text--auto' : ''}`}>
                          <span className="ink-record-text">{stripAt(e.text)}</span>
                          {status && <span className="ink-record-status">{status}</span>}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </aside>

          <section className="panel ink-desk" aria-live="polite">
            {stage === 'entries' && (
              <EntriesStage
                ink={ink}
                current={current}
                position={position}
                entities={entities}
                onContinue={() => setStage('prompts')}
                onBack={goBack}
              />
            )}
            {stage === 'prompts' && (
              <PromptStage
                prompts={prompts}
                index={pIdx}
                answers={answers}
                chips={recallChips(pIdx, { entries: ink.entries, session, entities })}
                onAnswer={(v) => setAnswers((a) => a.map((x, j) => (j === pIdx ? v : x)))}
                onBack={goBack}
                onNext={() => (pIdx >= prompts.length - 1 ? seal() : setPIdx((i) => i + 1))}
                onSkip={() => (pIdx >= prompts.length - 1 ? seal() : setPIdx((i) => i + 1))}
              />
            )}
            {stage === 'done' && (
              <div className="ink-done">
                <Drollery type="cat" width={240} />
                <p className="title ink-done-title">Inked.</p>
                <p className="ink-done-summary">
                  Session {session.sessionNumber} has a recap of {blocks.length} {blocks.length === 1 ? 'passage' : 'passages'},{' '}
                  {madePages.length} new codex {madePages.length === 1 ? 'page' : 'pages'}, and {kept}{' '}
                  {kept === 1 ? 'note' : 'notes'} kept for another night.
                </p>
                <button className="btn-primary btn--lg" onClick={onDone}>Open in the editor</button>
              </div>
            )}
          </section>

          <aside className="panel panel-col ink-recap" aria-labelledby="recap-head">
            <div className="panel-head">
              <h2 className="rubric" id="recap-head">Recap</h2>
              <span className="meta">{blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'passage' : 'passages'}` : 'empty'}</span>
            </div>
            <div className="panel-body ink-recap-body">
              <IlluminatedTitle text={session.title} as="h3" size={44} className="illuminated--wrap ink-recap-title" />
              <p className="rubric rubric--quiet ink-recap-sub">Session {session.sessionNumber} · draft</p>
              {blocks.length === 0 ? (
                <p className="hint">Nothing yet. What you add to the recap gathers here, in the order it happened.</p>
              ) : (
                blocks.map((b, i) =>
                  b.kind === 'heading' ? (
                    <p key={i} className="rubric ink-recap-head">{b.text}</p>
                  ) : (
                    <p key={i} className="ink-recap-text">{b.text}</p>
                  )
                )
              )}
              {madePages.length > 0 && (
                <div className="ink-recap-codex">
                  <p className="rubric">New in the codex</p>
                  {madePages.map((r) => (
                    <p key={r.target.id}>
                      <strong>{r.target.name}</strong> <span className="codex-row-type">{entityTypeInfo(r.target.type).label}</span>
                    </p>
                  ))}
                </div>
              )}
              {kept > 0 && <p className="hint">{kept} kept for later, waiting in the Margins inbox.</p>}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function Pips({ total, done, current }) {
  return (
    <span className="ink-pips" aria-hidden="true">
      {Array.from({ length: total }, (_, k) => (
        <span key={k} className={`ink-pip${k < done ? ' is-done' : ''}${k === current ? ' is-current' : ''}`} />
      ))}
    </span>
  )
}

function EntriesStage({ ink, current, position, entities, onContinue, onBack }) {
  if (!current) {
    return (
      <div className="ink-done">
        <Drollery type="owl" width={200} />
        <p className="empty-title">{ink.queue.length ? 'Every note is inked.' : 'Nothing in the log or the margins to sort.'}</p>
        <p className="empty-body">A few questions now, from memory, before the ink dries.</p>
        <div className="ink-actions-row">
          <button className="btn" onClick={onBack} disabled={!ink.canGoBack}>‹ Back</button>
          <button className="btn-primary btn--lg" onClick={onContinue}>On to the questions ›</button>
        </div>
      </div>
    )
  }
  const next = ink.remaining[1]
  return (
    <>
      <div className="ink-step">
        <span className="rubric">Entry {position} of {ink.queue.length}</span>
        <span className="toolbar-spacer" />
        {ink.queue.length <= 24 && <Pips total={ink.queue.length} done={ink.queue.length - ink.remaining.length} current={position - 1} />}
      </div>
      <InkItem key={current.key} item={current} entities={entities} onAct={(opts) => ink.act(current, opts)} />
      <div className="ink-actions-row">
        <button className="btn ink-back" onClick={onBack} disabled={!ink.canGoBack} aria-label="Back one entry">‹</button>
        <button className="btn-gilt ink-wide" onClick={() => ink.act(current, { action: 'later' })}>
          <span>Keep for later</span>
          <span className="btn-kbd kbd--hint">K</span>
        </button>
        <button className="btn ink-wide" onClick={() => ink.act(current, { action: 'toss' })}>
          <span>Toss</span>
          <span className="btn-kbd kbd--hint">T</span>
        </button>
      </div>
      <p className="ink-next">{next ? `Next · ${stripAt(next.text)}` : 'Last one. Then a few questions, from memory.'}</p>
      <button className="btn-link ink-skip" onClick={onContinue}>Skip to the questions — the rest stays queued</button>
    </>
  )
}

function InkItem({ item, entities, onAct }) {
  const suggestion = useMemo(() => suggestEntity({ ...item, text: stripAt(item.text) }), [item])
  const links = useMemo(() => suggestLinks(item, entities), [item, entities])
  const [text, setText] = useState(item.text)
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(suggestion.name)
  const [otherId, setOtherId] = useState('')
  const clash = findEntityByName(entities, newName)
  const sorted = useMemo(() => [...entities].sort((a, b) => a.name.localeCompare(b.name)), [entities])
  const other = entities.find((e) => e.id === otherId)
  const kind = item.kind === 'margin' ? 'Margin note' : MARK_LABELS[item.mark] ?? 'Note'

  return (
    <>
      <article className="card card--ruled ink-card">
        <p className="ink-card-kind">
          <Mark type={item.kind === 'margin' ? 'margin' : item.mark} size={26} title="" />
          <span className="ink-card-kind-label">{kind}</span>
          {item.at && <span className="meta">· {time(item.at)}</span>}
          <span className="toolbar-spacer" />
          <button className="btn-link" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? 'Done editing' : 'Edit the line'}
          </button>
        </p>
        {editing ? (
          <textarea className="ink-card-edit" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="The line" autoFocus />
        ) : (
          <p className="ink-card-text"><MentionText text={text} entities={entities} /></p>
        )}
      </article>

      <button className="btn-primary btn--lg ink-recap-btn" onClick={() => onAct({ action: 'recap', text })} disabled={!text.trim()}>
        <span>Add to recap</span>
        <span className="btn-kbd kbd--hint">R</span>
      </button>

      <div className="ink-make">
        <p className="ink-label">
          Make a codex page
          {suggestion.name && <span className="codex-row-type"> · suggested: {entityTypeInfo(suggestion.type).label}, “{suggestion.name}”</span>}
        </p>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name the page" aria-label="New page name" />
        <div className="ink-make-types" role="group" aria-label="Make it a">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t.value}
              className={`toggle${t.value === suggestion.type ? ' is-on' : ''}`}
              disabled={!newName.trim() || Boolean(clash)}
              onClick={() => onAct({ action: 'entity', text, create: { type: t.value, name: newName.trim() } })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {clash && <p className="field-hint">“{clash.name}” is already in the codex — link to it below.</p>}
      </div>

      <div className="ink-link">
        <p className="ink-label">Link to an existing page</p>
        <div className="toggle-row">
          {links.map((e) => (
            <button key={e.id} className="toggle ink-link-btn" onClick={() => onAct({ action: 'link', text, entity: e })}>
              {e.name} <span className="codex-row-type">{entityTypeInfo(e.type).label}</span>
            </button>
          ))}
          <select value={otherId} onChange={(e) => setOtherId(e.target.value)} aria-label="Another page">
            <option value="">{links.length ? 'another page…' : 'choose a page…'}</option>
            {sorted.map((e) => (
              <option key={e.id} value={e.id}>{e.name} · {entityTypeInfo(e.type).label}</option>
            ))}
          </select>
          {other && <button className="btn-gilt" onClick={() => onAct({ action: 'link', text, entity: other })}>Link</button>}
        </div>
      </div>
    </>
  )
}

function PromptStage({ prompts, index, answers, chips, onAnswer, onBack, onNext, onSkip }) {
  const answer = answers[index]
  const last = index >= prompts.length - 1
  return (
    <>
      <div className="ink-step">
        <span className="rubric">Recall · {index + 1} of {prompts.length}</span>
        <span className="toolbar-spacer" />
        <Pips total={prompts.length} done={index} current={index} />
      </div>
      <div className="ink-prompt">
        <p className="title ink-prompt-q" id="recall-q">{prompts[index]}</p>
        <p className="ink-prompt-hint">{RECALL_HINTS[index]}</p>
      </div>
      <textarea
        key={index}
        className="ink-answer"
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="Write it as you’d tell it at the next table…"
        aria-labelledby="recall-q"
        autoFocus
      />
      {chips.length > 0 && (
        <div className="ink-link">
          <p className="ink-label">From tonight’s log, tap to borrow</p>
          <div className="toggle-row">
            {chips.map((c) => (
              <button key={c} className="toggle ink-chip" onClick={() => onAnswer(answer.trim() ? `${answer.trim()} ${c}` : c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ink-actions-row ink-actions-row--end">
        <button className="btn ink-back" onClick={onBack} aria-label="Back">‹</button>
        <span className="toolbar-spacer" />
        <button className="btn" onClick={onSkip}>Skip</button>
        <button className={last ? 'btn-leaf btn--lg' : 'btn-primary btn--lg'} onClick={onNext}>
          {last ? 'Seal the recap' : 'Write it in ›'}
        </button>
      </div>
    </>
  )
}
