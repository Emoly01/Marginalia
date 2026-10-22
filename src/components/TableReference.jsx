// Table view, the sheet panel beside the trackers: Spells / Skills /
// Features / Items / Attacks. Spell and item text is only ever what the PDF
// had or what I typed — row metadata, feature text, my notes; never rules
// text.
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { getSpellNotes, setSpellNote } from '../lib/characterSheet'
import { stripHtml } from '../lib/text'
import { toast } from '../lib/toast'

const TABS = [
  { key: 'spells', label: 'Spells' },
  { key: 'skills', label: 'Skills' },
  { key: 'features', label: 'Features' },
  { key: 'items', label: 'Items' },
  { key: 'attacks', label: 'Attacks' },
]

const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')
const signed = (n) => (n == null ? '—' : n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
const levelLabel = (level) => (level === 0 ? 'Cantrip' : level == null ? 'Level ?' : ordinal(level))
const joinDot = (...parts) => parts.filter(Boolean).join(' · ')

// Proficiency is a glyph with a spelled-out title and a legend, never colour alone.
const PROF_MARK = {
  expertise: { mark: '◆', label: 'expertise' },
  proficient: { mark: '●', label: 'proficient' },
  half: { mark: '◐', label: 'half proficiency' },
}
const matches = (q, ...texts) => !q || texts.some((t) => String(t ?? '').toLowerCase().includes(q))

export default function TableReference({
  userId,
  campaignId,
  sheet,
  state,
  actions,
  entities,
  tab,
  focusSpell,
  onTabChange,
  onOpenEntity,
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const active = TABS.some((t) => t.key === tab) ? tab : 'spells'

  return (
    <div className="table-reference">
      <div className="tabs table-tabs" role="tablist" aria-label="Reference">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`ref-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls="ref-panel"
            className="tab"
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="table-ref-body" id="ref-panel" role="tabpanel" aria-labelledby={`ref-tab-${active}`}>
        {(active === 'spells' || active === 'features' || active === 'items') && (
          <input
            className="table-ref-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Find in ${active}…`}
            aria-label={`Search ${active}`}
          />
        )}
        {active === 'spells' && (
          <SpellList userId={userId} campaignId={campaignId} sheet={sheet} state={state} actions={actions} q={q} focusSpell={focusSpell} />
        )}
        {active === 'skills' && <SkillList skills={sheet.skills} />}
        {active === 'features' && <FeatureList features={sheet.features} q={q} />}
        {active === 'items' && <ItemList sheet={sheet} entities={entities} q={q} onOpenEntity={onOpenEntity} />}
        {active === 'attacks' && <AttackList attacks={sheet.attacks} />}
      </div>
    </div>
  )
}

function SpellList({ userId, campaignId, sheet, state, actions, q, focusSpell }) {
  const [notes, setNotes] = useState({})
  const [open, setOpen] = useState(() => new Set(focusSpell ? [focusSpell] : []))

  useEffect(() => {
    let cancelled = false
    getSpellNotes(userId, campaignId)
      .then((n) => !cancelled && setNotes(n))
      .catch((err) => console.error('Could not load spell notes:', err))
    return () => { cancelled = true }
  }, [userId, campaignId])

  useEffect(() => {
    if (!focusSpell) return
    setOpen((s) => new Set([...s, focusSpell]))
    document.getElementById(`spell-${focusSpell}`)?.scrollIntoView({ block: 'center' })
  }, [focusSpell])

  const saveNote = (key, text) => {
    if ((notes[key] ?? '') === text) return
    setNotes((n) => ({ ...n, [key]: text }))
    setSpellNote(userId, campaignId, key, text).catch((err) => {
      console.error('Spell note failed:', err)
      toast('Could not save that spell note.')
    })
  }

  const toggle = (key) =>
    setOpen((s) => {
      const next = new Set(s)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const levels = useMemo(() => {
    const byLevel = new Map()
    for (const s of sheet.spells) {
      if (!matches(q, s.name, s.sources.join(' '), notes[s.key])) continue
      if (!byLevel.has(s.level)) byLevel.set(s.level, [])
      byLevel.get(s.level).push(s)
    }
    return [...byLevel]
  }, [sheet.spells, q, notes])

  if (levels.length === 0) return <p className="hint">no spells{q && ' match'}</p>

  return (
    <div className="table-spells">
      {levels.map(([level, spells]) => (
        <section key={level ?? 'unknown'} className="table-spell-level" aria-label={level === 0 ? 'Cantrips' : `${levelLabel(level)} level`}>
          <h3 className="rubric">{level === 0 ? 'Cantrips' : level == null ? 'Level not on the sheet' : `${ordinal(level)} level`}</h3>
          <ul className="table-cards">
            {spells.map((s) => (
              <Spell
                key={s.key}
                spell={s}
                state={state}
                actions={actions}
                isOpen={open.has(s.key)}
                onToggle={() => toggle(s.key)}
                note={notes[s.key] ?? ''}
                onSaveNote={(text) => saveNote(s.key, text)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Spell({ spell: s, state, actions, isOpen, onToggle, note, onSaveNote }) {
  const [draft, setDraft] = useState(note)
  useEffect(() => setDraft(note), [note])

  // The note box grows with what's written, so a long note reads whole
  // instead of scrolling inside two rows.
  const noteRef = useRef(null)
  useLayoutEffect(() => {
    const el = noteRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [draft, isOpen])

  const free = state.resources.find((r) => r.id === `${s.key}-free-cast`)
  const castable = s.level === 0 ? [] : state.slots.filter((x) => x.level >= s.level && x.left > 0)
  const cast = (extra) => actions.castSpell({ name: s.name, level: s.level, concentration: s.concentration, ...extra })

  return (
    <li id={`spell-${s.key}`} className={`card table-spell${isOpen ? ' is-open' : ''}`}>
      <div className="table-spell-head">
        <button className="table-spell-toggle" onClick={onToggle} aria-expanded={isOpen}>
          <span className="table-card-title">
            {s.name}
            {s.concentration && <abbr className="table-spell-flag" title="concentration"> C</abbr>}
            {s.alwaysPrepared && <abbr className="table-spell-flag" title="always prepared"> P</abbr>}
          </span>
          <span className="table-card-line">{joinDot(s.castingTime, s.range, s.duration)}</span>
          <span className="table-card-line">{joinDot(s.components, s.saveHit, s.sources.join(', '))}</span>
        </button>
        <span className="table-spell-cast">
          <span className="table-spell-level-label">{levelLabel(s.level)}</span>
          <span className="table-spell-cast-btns">
            {s.level === 0 ? (
              <button className="btn btn--cast" onClick={() => cast({})} aria-label={`Cast ${s.name}`}>Cast</button>
            ) : (
              <>
                {free && (
                  <button
                    className="btn btn--cast"
                    disabled={free.left <= 0}
                    onClick={() => cast({ resourceId: free.id })}
                    aria-label={`Cast ${s.name} free`}
                  >
                    Free
                  </button>
                )}
                {castable.map((x) => (
                  <button
                    key={x.level}
                    className="btn btn--cast"
                    onClick={() => cast({ slotLevel: x.level })}
                    aria-label={`Cast ${s.name} with a ${ordinal(x.level)}-level slot`}
                  >
                    {ordinal(x.level)}
                  </button>
                ))}
                {castable.length === 0 && !free && <span className="meta">no slots</span>}
              </>
            )}
          </span>
        </span>
      </div>
      {/* Under the head rather than in it, so the note gets the card's full
          width instead of what the cast buttons leave. The toggle above is
          the keyboard route; this is a bigger target for the mouse. */}
      {note && !isOpen && (
        <p className="table-spell-note" onClick={onToggle}>{note}</p>
      )}
      {isOpen && (
        <div className="table-spell-body">
          <label className="field">
            <span className="field-label">My note</span>
            <textarea
              ref={noteRef}
              className="input-hand table-spell-note-input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => onSaveNote(draft)}
              placeholder="what it does, in your words — the sheet has no description"
            />
          </label>
          <dl className="table-spell-facts">
            {[
              ['Time', s.castingTime],
              ['Range', s.range],
              ['Save / hit', s.saveHit],
              ['Duration', s.duration],
              ['Components', s.components],
              ['Source', s.sources.join(', ')],
              ['Book', s.reference],
              ['Sheet notes', s.notes.join(' · ')],
            ]
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </li>
  )
}

function SkillList({ skills }) {
  return (
    <>
      <p className="table-skill-legend">
        ◆ expertise · ● proficient · ◐ half
      </p>
      <ul className="table-skills">
        {skills.map((s) => {
          const prof = PROF_MARK[s.proficiency]
          return (
            <li key={s.key} className="table-skill">
              <span className="table-skill-mark">{prof ? <abbr title={prof.label}>{prof.mark}</abbr> : ''}</span>
              <span className="table-skill-name">
                {s.label} <span className="table-skill-ability">{s.ability}</span>
              </span>
              <span className="numeral table-skill-bonus">{signed(s.bonus)}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function FeatureList({ features, q }) {
  const list = features.filter((f) => matches(q, f.name, f.text, f.group, f.notes.join(' ')))
  if (list.length === 0) return <p className="hint">no features{q && ' match'}</p>
  return (
    <ul className="table-cards">
      {list.map((f, i) => (
        <li key={`${f.name}-${i}`} className="card table-feature">
          <details open={Boolean(q)}>
            <summary className="table-card-head">
              <span className="table-card-title">{f.name}</span>
              <span className="table-card-aside">{f.group}</span>
            </summary>
            {f.notes.length > 0 && (
              <ul className="table-feature-notes">
                {f.notes.map((n, j) => <li key={j}>{n}</li>)}
              </ul>
            )}
            {f.text && <p className="table-feature-text">{f.text}</p>}
          </details>
        </li>
      ))}
    </ul>
  )
}

function ItemList({ sheet, entities, q, onOpenEntity }) {
  const qty = new Map()
  for (const it of sheet.inventory.items) qty.set(it.name.toLowerCase(), (qty.get(it.name.toLowerCase()) ?? 0) + it.qty)
  const items = entities
    .filter((e) => e.type === 'item')
    .filter((e) => matches(q, e.name, stripHtml(e.notes)))
  const coin = ['pp', 'gp', 'ep', 'sp', 'cp'].filter((c) => sheet.inventory.currency[c]).map((c) => `${sheet.inventory.currency[c]} ${c}`)
  return (
    <>
      {coin.length > 0 && <p className="table-coin numeral">{coin.join(' · ')}</p>}
      {items.length === 0 ? (
        <p className="hint">no items{q && ' match'}</p>
      ) : (
        <ul className="table-cards">
          {items.map((e) => {
            const n = qty.get(e.name.toLowerCase())
            const note = stripHtml(e.notes)
            return (
              <li key={e.id}>
                <button className="card table-item" onClick={() => onOpenEntity(e.id)}>
                  <span className="table-card-title">{e.name}</span>
                  <span className="numeral table-item-qty">{n > 0 ? n : ''}</span>
                  {note && <span className="table-item-note">{note}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function AttackList({ attacks }) {
  if (attacks.length === 0) return <p className="hint">no attacks on the sheet</p>
  return (
    <ul className="table-cards">
      {attacks.map((a, i) => (
        <li key={i} className="card table-attack">
          <span className="table-attack-text">
            <span className="table-card-title">{a.name}</span>
            <span className="table-card-line">{joinDot(a.damage, a.notes)}</span>
          </span>
          <span className="numeral table-attack-hit">{a.bonus}</span>
        </li>
      ))}
    </ul>
  )
}
