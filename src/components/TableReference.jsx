// Table view, left side, below the trackers: Spells / Features / Items /
// Attacks. Spell and item text is only ever what the PDF had or what I
// typed — row metadata, feature text, my notes; never rules text.
import { useState, useEffect, useMemo } from 'react'
import { getSpellNotes, setSpellNote } from '../lib/characterSheet'
import { stripHtml } from '../lib/text'
import { toast } from '../lib/toast'

const TABS = [
  { key: 'spells', label: 'Spells' },
  { key: 'features', label: 'Features' },
  { key: 'items', label: 'Items' },
  { key: 'attacks', label: 'Attacks' },
]

const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')
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
      <nav className="tabs table-tabs" aria-label="Reference">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${active === t.key ? ' is-active' : ''}`}
            aria-pressed={active === t.key}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {(active === 'spells' || active === 'features' || active === 'items') && (
        <input
          className="table-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`search ${active}…`}
          aria-label={`Search ${active}`}
        />
      )}
      {active === 'spells' && (
        <SpellList userId={userId} campaignId={campaignId} sheet={sheet} state={state} actions={actions} q={q} focusSpell={focusSpell} />
      )}
      {active === 'features' && <FeatureList features={sheet.features} q={q} />}
      {active === 'items' && <ItemList sheet={sheet} entities={entities} q={q} onOpenEntity={onOpenEntity} />}
      {active === 'attacks' && <AttackTable attacks={sheet.attacks} />}
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
        <section key={level} className="table-spell-level">
          <h4 className="sheet-group-title">{level === 0 ? 'Cantrips' : `${ordinal(level)} level`}</h4>
          <ul className="table-spell-list">
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

  const free = state.resources.find((r) => r.id === `${s.key}-free-cast`)
  const castable = s.level === 0 ? [] : state.slots.filter((x) => x.level >= s.level && x.left > 0)
  const cast = (extra) => actions.castSpell({ name: s.name, level: s.level, concentration: s.concentration, ...extra })

  return (
    <li id={`spell-${s.key}`} className={`table-spell${isOpen ? ' is-open' : ''}`}>
      <div className="table-spell-head">
        <button className="table-spell-name" onClick={onToggle} aria-expanded={isOpen}>
          {s.name}
          {s.concentration && <abbr title="concentration"> (C)</abbr>}
          {note && <span className="sheet-tag">note</span>}
        </button>
        <span className="table-spell-cast">
          {s.level === 0 ? (
            <button className="table-btn" onClick={() => cast({})}>Cast</button>
          ) : (
            <>
              {free && (
                <button className="table-btn" disabled={free.left <= 0} onClick={() => cast({ resourceId: free.id })}>
                  Free
                </button>
              )}
              {castable.map((x) => (
                <button
                  key={x.level}
                  className="table-btn"
                  onClick={() => cast({ slotLevel: x.level })}
                  aria-label={`Cast ${s.name} with a ${ordinal(x.level)}-level slot`}
                >
                  {ordinal(x.level)}
                </button>
              ))}
              {castable.length === 0 && !free && <span className="hint">no slots</span>}
            </>
          )}
        </span>
      </div>
      {isOpen && (
        <div className="table-spell-body">
          <dl className="sheet-facts">
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
                <div key={label} className="sheet-fact">
                  <dt>{label}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <label className="field">
            <span className="field-label">My note</span>
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => onSaveNote(draft)}
              placeholder="what it does, in your words — the sheet has no description"
            />
          </label>
        </div>
      )}
    </li>
  )
}

function FeatureList({ features, q }) {
  const list = features.filter((f) => matches(q, f.name, f.text, f.group, f.notes.join(' ')))
  if (list.length === 0) return <p className="hint">no features{q && ' match'}</p>
  return (
    <div className="table-features">
      {list.map((f, i) => (
        <details key={`${f.name}-${i}`} className="sheet-details" open={Boolean(q)}>
          <summary>
            {f.name} <span className="sheet-tag">{f.group}</span>
          </summary>
          {f.notes.length > 0 && (
            <ul className="sheet-notes">
              {f.notes.map((n, j) => <li key={j}>{n}</li>)}
            </ul>
          )}
          {f.text && <p className="sheet-text">{f.text}</p>}
        </details>
      ))}
    </div>
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
    <div className="table-items">
      {coin.length > 0 && <p className="sheet-sub">{coin.join(' · ')}</p>}
      {items.length === 0 ? (
        <p className="hint">no items{q && ' match'}</p>
      ) : (
        <ul className="table-item-list">
          {items.map((e) => (
            <li key={e.id} className="table-item">
              <button className="table-item-name" onClick={() => onOpenEntity(e.id)}>
                {e.name}
                {qty.get(e.name.toLowerCase()) > 1 && <span className="sheet-tag">×{qty.get(e.name.toLowerCase())}</span>}
              </button>
              {stripHtml(e.notes) && <p className="table-item-note">{stripHtml(e.notes)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AttackTable({ attacks }) {
  if (attacks.length === 0) return <p className="hint">no attacks on the sheet</p>
  return (
    <table className="sheet-table">
      <thead>
        <tr><th>Name</th><th>Hit</th><th>Damage</th><th>Notes</th></tr>
      </thead>
      <tbody>
        {attacks.map((a, i) => (
          <tr key={i}><td>{a.name}</td><td>{a.bonus}</td><td>{a.damage}</td><td>{a.notes}</td></tr>
        ))}
      </tbody>
    </table>
  )
}
