// Import (or re-import) a D&D Beyond PDF export. The PDF is read in the
// browser and never leaves it; only the parsed fields are saved.
//
// A first import walks five steps: drop the file → what the sheet says →
// dossier fields to fill (untick any) → limited-use features to confirm →
// bound. A re-import opens on the proclamation of what changed, sealed in
// one tap, with the steps still there for a closer look. The plan comes from
// src/lib/sheet/importPlan.js; this component only shows it and collects the
// edits.
import { useState } from 'react'
import {
  readPdfFields,
  parseDdbSheet,
  buildImportPlan,
  cleanResources,
  selectDossierFill,
  diffRows,
  proclamation,
  SHEET_DOC_BUDGET,
} from '../lib/sheet'
import { getSheetDoc, getPlay, saveSheetImport } from '../lib/characterSheet'
import { getCharacter } from '../lib/character'
import { listSessions } from '../lib/sessions'
import { toast } from '../lib/toast'
import { Drollery, IlluminatedTitle, Leaf, Mark } from './ornament'
import SheetPreview from './SheetPreview'

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`
const signed = (n) => (n == null ? '—' : n >= 0 ? `+${n}` : String(n))
const clock = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const STEPS = ['Drop', 'Read', 'Dossier', 'Features', 'Done']
const NEXT_LABEL = ['', 'Looks right  ›', 'Fill these  ›', 'Bind the sheet', 'Open the sheet']
const MAX_USES = 20

export default function SheetImport({ userId, campaignId, entities, onCancel, onSaved }) {
  const [phase, setPhase] = useState('pick') // pick | reading | proclaim | steps | saving | sealed
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [read, setRead] = useState({ fields: 0, pages: 0 })
  const [fill, setFill] = useState(new Set())
  const [rows, setRows] = useState([])
  const [dragging, setDragging] = useState(false)
  const [sealedAt, setSealedAt] = useState(null)

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setPhase('reading')
    try {
      const { fields, pageCount } = await readPdfFields(file)
      if (fields.length === 0) {
        throw new Error('No filled form fields in this PDF. Is it a D&D Beyond “Export to PDF” file?')
      }
      const sheet = parseDdbSheet(fields)
      if (!sheet.identity.name && !sheet.identity.classLevel) {
        throw new Error('This PDF has form fields, but not the ones a D&D Beyond character sheet uses.')
      }
      const [previousDoc, character, play, sessions] = await Promise.all([
        getSheetDoc(userId, campaignId),
        getCharacter(userId, campaignId),
        getPlay(userId, campaignId),
        listSessions(userId, campaignId),
      ])
      const next = buildImportPlan({
        parsed: sheet,
        fields,
        fileName: file.name,
        previousDoc,
        character,
        entities,
        play,
        sessions,
      })
      setParsed(sheet)
      setPlan(next)
      setRead({ fields: fields.length, pages: pageCount ?? 0 })
      setFill(new Set(next.dossier.filled.map((f) => f.key)))
      setRows(next.resources)
      if (next.isReimport) {
        setPhase('proclaim')
      } else {
        setPhase('steps')
        setStep(1)
      }
    } catch (err) {
      console.error('Sheet import failed:', err)
      setError(err.message || 'Could not read that PDF.')
      setPhase('pick')
    }
  }

  const tooBig = plan ? plan.bytes > SHEET_DOC_BUDGET : false

  const save = async (after) => {
    const from = phase
    setPhase('saving')
    try {
      const chosen = { ...plan, dossier: selectDossierFill(plan.dossier, [...fill]) }
      await saveSheetImport(userId, campaignId, chosen, cleanResources(rows))
      setPhase(from)
      after()
    } catch (err) {
      console.error('Saving sheet failed:', err)
      toast('Could not save the sheet.')
      setPhase(from)
    }
  }

  const finish = () => onSaved?.({ createdItems: plan.items.create.length > 0 })

  const updateRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const removeRow = (i) => setRows((rs) => rs.filter((_, j) => j !== i))
  const addRow = () =>
    setRows((rs) => [...rs, { id: '', name: '', max: 1, reset: 'long', origin: 'manual', evidence: [], conflict: false, isNew: true }])
  const toggleFill = (key) =>
    setFill((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const name = parsed?.identity.name
  const saving = phase === 'saving'

  if (phase === 'proclaim' || (phase === 'saving' && plan?.isReimport && step === 0) || phase === 'sealed') {
    return (
      <Proclamation
        plan={plan}
        parsed={parsed}
        tooBig={tooBig}
        saving={saving}
        sealedAt={phase === 'sealed' ? sealedAt : null}
        onCancel={onCancel}
        onCloser={() => {
          setPhase('steps')
          setStep(1)
        }}
        onSeal={() =>
          save(() => {
            setSealedAt(new Date())
            setPhase('sealed')
          })
        }
        onOpen={finish}
      />
    )
  }

  const current = phase === 'pick' || phase === 'reading' ? 0 : step
  const nFill = plan ? plan.dossier.filled.filter((f) => fill.has(f.key)).length : 0
  const footNote = [
    '',
    'Nothing is saved until the last step.',
    plan?.dossier.filled.length ? `${nFill} of ${plan.dossier.filled.length} will be filled` : '',
    'Roundels refill on the rest you choose',
    '',
  ][current]

  const back = () => {
    if (current > 1) setStep(current - 1)
    else {
      setStep(0)
      setPhase(plan.isReimport ? 'proclaim' : 'pick')
    }
  }

  const next = () => {
    if (current === 3) save(() => setStep(4))
    else if (current === 4) finish()
    else setStep(current + 1)
  }

  return (
    <section className="panel bind" aria-label="Bind a sheet">
      <header className="bind-head">
        <IlluminatedTitle text="Bind a sheet" as="h2" size={44} className="title bind-title" />
        <span className="meta bind-sub">{name ? `into ${name}’s dossier` : 'into the dossier'}</span>
        <span className="toolbar-spacer" />
        <button className="btn-icon btn-icon--bare bind-close" onClick={onCancel} disabled={saving} aria-label="Close">
          ×
        </button>
      </header>

      <ol className="bind-steps" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`bind-step${i < current || current === 4 ? ' is-done' : ''}${i === current ? ' is-current' : ''}`}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="ink-pip" aria-hidden="true" />
            <span className="bind-step-label">{label}</span>
          </li>
        ))}
      </ol>

      <div className="bind-body">
        {current === 0 && (
          <DropStep
            reading={phase === 'reading'}
            dragging={dragging}
            setDragging={setDragging}
            onFile={handleFile}
            error={error}
          />
        )}
        {current === 1 && <ReadStep plan={plan} parsed={parsed} read={read} rows={rows} tooBig={tooBig} />}
        {current === 2 && <DossierStep plan={plan} fill={fill} onToggle={toggleFill} />}
        {current === 3 && <FeaturesStep rows={rows} onChange={updateRow} onRemove={removeRow} onAdd={addRow} />}
        {current === 4 && (
          <div className="bind-done">
            <Drollery type="snail" width={260} />
            <p className="title bind-done-title">Bound.</p>
            <p className="bind-done-summary">
              {read.fields} fields read, {nFill} dossier {nFill === 1 ? 'field' : 'fields'} filled, {rows.length}{' '}
              {rows.length === 1 ? 'feature' : 'features'} gilded
              {plan.items.create.length > 0 && `, ${plan.items.create.length} items in the codex`}. {name || 'Your hero'} is
              ready for the table.
            </p>
          </div>
        )}
      </div>

      <footer className="bind-foot">
        {current > 0 && current < 4 && (
          <button className="btn btn--lg" onClick={back} disabled={saving}>
            ‹  Back
          </button>
        )}
        <span className="bind-foot-note">{footNote}</span>
        {current > 0 && (
          <button className="btn-primary btn--lg" onClick={next} disabled={saving || (current === 3 && tooBig)}>
            {saving ? 'Binding…' : NEXT_LABEL[current]}
          </button>
        )}
      </footer>
    </section>
  )
}

function DropStep({ reading, dragging, setDragging, onFile, error }) {
  return (
    <>
      <label
        className={`bind-drop${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFile(e.dataTransfer.files?.[0])
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="bind-drop-input"
          disabled={reading}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Drollery type="owl" width={200} />
        <span className="bind-drop-title">Drop the sheet here</span>
        <span className="bind-drop-body">
          A PDF from D&amp;D Beyond: character menu → Export to PDF. It’s read on this device and goes nowhere else.
        </span>
        {reading ? (
          <span className="bind-reading" role="status">
            <span className="bind-reading-bar" aria-hidden="true"><span /></span>
            <span className="bind-reading-label">Reading the sheet…</span>
          </span>
        ) : (
          <span className="btn-primary btn--lg bind-drop-btn" aria-hidden="true">Choose a PDF</span>
        )}
      </label>
      {error && <p className="error-note" role="alert">{error}</p>}
    </>
  )
}

function ReadStep({ plan, parsed, read, rows, tooBig }) {
  const { identity, combat, abilities } = parsed
  const caster = parsed.spellcasting[0]
  const groups = [
    {
      label: 'Who',
      wide: true,
      cells: [
        ['Name', identity.name],
        ['Species', identity.species],
        ['Class', identity.classLevel],
        ['Background', identity.background],
      ],
    },
    {
      label: 'Numbers',
      cells: [
        ['AC', combat.ac],
        ['HP', combat.maxHp],
        ['Hit dice', combat.hitDice.total],
        ['Initiative', signed(combat.initiative)],
        ['Speed', String(combat.speed ?? '—').replace(/\s*\(Walking\)/i, '')],
        ['Proficiency', signed(combat.profBonus)],
        ['Passive Perc.', combat.passives.perception],
        ...(caster ? [['Save DC', caster.saveDC], ['Spell attack', signed(caster.attackBonus)]] : []),
      ],
    },
    { label: 'Abilities', cells: Object.entries(abilities).map(([k, a]) => [k.toUpperCase(), a.score]) },
  ]
  const checks = [
    ...rows.filter((r) => r.conflict).map((r) => [r.name || 'A resource', 'The sheet disagrees with itself here. Pick the right number on the Features step.']),
    ...parsed.spells.filter((s) => s.level == null).map((s) => [s.name, 'The sheet doesn’t say which level this spell is.']),
  ]

  return (
    <>
      <div className="bind-lede">
        <h3 className="bind-lede-title">What the sheet says</h3>
        <span className="meta">
          {plan.doc.sourceFileName}
          {read.pages > 0 && ` · ${read.pages} ${read.pages === 1 ? 'page' : 'pages'}`} · {read.fields} fields read ·{' '}
          {kb(plan.bytes)} to store
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.label} className="bind-group">
          <h4 className="rubric">{g.label}</h4>
          <dl className={`bind-cells${g.wide ? ' bind-cells--wide' : ''}`}>
            {g.cells.map(([k, v]) => (
              <div key={k} className="bind-cell">
                <dt>{k}</dt>
                <dd>{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {parsed.spells.length > 0 && (
        <div className="bind-group">
          <h4 className="rubric">Spells · {parsed.spells.length}</h4>
          <p className="bind-list">{parsed.spells.map((s) => s.name).join(', ')}</p>
        </div>
      )}

      {(checks.length > 0 || tooBig) && (
        <div className="bind-group">
          <h4 className="rubric">Worth a second look · {checks.length + (tooBig ? 1 : 0)}</h4>
          {tooBig && (
            <p className="bind-check" role="alert">
              <Mark type="important" size={20} />
              <span className="bind-check-k">Too large</span>
              <span className="bind-check-v">
                This sheet is {kb(plan.bytes)}, too close to Firestore’s 1 MiB document limit to save safely.
              </span>
            </p>
          )}
          {checks.map(([k, v], i) => (
            <p key={i} className="bind-check">
              <Mark type="mystery" size={20} />
              <span className="bind-check-k">{k}</span>
              <span className="bind-check-v">{v}</span>
            </p>
          ))}
        </div>
      )}

      <details className="sheet-details bind-everything">
        <summary>Everything on the sheet</summary>
        <SheetPreview sheet={parsed} />
      </details>
    </>
  )
}

function DossierStep({ plan, fill, onToggle }) {
  const { dossier, items } = plan
  return (
    <>
      <div className="bind-lede">
        <h3 className="bind-lede-title">
          {dossier.filled.length ? 'These empty dossier fields will be filled' : 'Nothing in the dossier to fill'}
        </h3>
        <span className="meta">
          {dossier.filled.length
            ? 'Untick anything you’d rather write yourself.'
            : 'Every dossier field the sheet covers already has something in it.'}
        </span>
      </div>

      {dossier.filled.length > 0 && (
        <div className="bind-fills">
          {dossier.filled.map((f) => {
            const on = fill.has(f.key)
            return (
              <button key={f.key} role="checkbox" aria-checked={on} className="bind-fill" onClick={() => onToggle(f.key)}>
                <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
                <span className="bind-fill-k">{f.label}</span>
                <span className="bind-fill-v">{formatDossierValue(f.key, f.value)}</span>
              </button>
            )
          })}
        </div>
      )}

      {dossier.kept.length > 0 && (
        <div className="bind-group">
          <h4 className="rubric rubric--quiet">Left as you wrote them</h4>
          <p className="bind-list">{dossier.kept.map((k) => k.label).join(' · ')}</p>
        </div>
      )}

      <div className="bind-group">
        <h4 className="rubric rubric--quiet">Into the codex</h4>
        {items.create.length > 0 ? (
          <>
            <p className="bind-list">These become item pages you can @-mention and keep notes on:</p>
            <p className="bind-chips">
              {items.create.map((n) => (
                <span key={n} className="bind-chip">{n}</span>
              ))}
            </p>
          </>
        ) : (
          <p className="bind-list">No new items.</p>
        )}
        {items.existing.length > 0 && <p className="meta">Already have a page: {items.existing.join(', ')}.</p>}
      </div>
    </>
  )
}

function formatDossierValue(key, value) {
  if (key === 'abilities') return Object.entries(value).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ')
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return String(value)
}

const ORIGIN_LABEL = {
  action: 'action tag',
  feature: 'feature tag',
  spell: 'spell row',
  'action-text': 'action text',
  'feature-text': 'feature text',
  confirmed: 'kept from last import',
  manual: 'added by you',
}

function FeaturesStep({ rows, onChange, onRemove, onAdd }) {
  return (
    <>
      <div className="bind-lede">
        <h3 className="bind-lede-title">Limited-use features</h3>
        <span className="meta">
          Read from the sheet’s text, which is guesswork. Confirm how many, and when they come back. Each becomes a row of
          gilded roundels at the table.
        </span>
      </div>

      {rows.length === 0 && <p className="bind-list">None found.</p>}
      <ul className="bind-feats">
        {rows.map((r, i) => {
          const max = Math.max(1, Math.min(MAX_USES, Number(r.max) || 1))
          const label = r.name || 'this feature'
          return (
            <li key={i} className={`card bind-feat${r.conflict ? ' has-conflict' : ''}`}>
              <div className="bind-feat-row">
                <input
                  className="bind-feat-name"
                  value={r.name}
                  onChange={(e) => onChange(i, { name: e.target.value })}
                  aria-label="Feature name"
                  placeholder="Name"
                />
                <div className="stepper" role="group" aria-label={`Uses of ${label}`}>
                  <button className="btn-icon" onClick={() => onChange(i, { max: max - 1 })} disabled={max <= 1} aria-label="Fewer uses">
                    −
                  </button>
                  <span className="stepper-value numeral" aria-live="polite">{max}</span>
                  <button className="btn-icon" onClick={() => onChange(i, { max: max + 1 })} disabled={max >= MAX_USES} aria-label="More uses">
                    +
                  </button>
                </div>
                <div className="segmented" role="group" aria-label={`${label} comes back on`}>
                  {[
                    ['short', 'Short rest'],
                    ['long', 'Long rest'],
                  ].map(([k, text]) => (
                    <button key={k} aria-pressed={r.reset === k} onClick={() => onChange(i, { reset: k })}>
                      {text}
                    </button>
                  ))}
                </div>
                <span className="bind-feat-pips" aria-hidden="true">
                  {Array.from({ length: max }, (_, k) => (
                    <Leaf key={k} size={20} />
                  ))}
                </span>
                <button className="btn-icon btn-icon--bare" onClick={() => onRemove(i)} aria-label={`Remove ${label}`}>
                  ×
                </button>
              </div>
              {(r.evidence?.length > 0 || r.origin) && (
                <p className="field-hint">
                  {r.isNew === false ? ORIGIN_LABEL.confirmed : ORIGIN_LABEL[r.origin] ?? r.origin}
                  {r.evidence?.length > 0 && <> · sheet says: {r.evidence.map((e) => `“${e.text}”`).join(', ')}</>}
                </p>
              )}
              {r.conflict && <p className="field-hint bind-conflict">The sheet disagrees with itself here. Pick the right one.</p>}
            </li>
          )
        })}
      </ul>
      <button className="btn btn-dashed bind-add" onClick={onAdd}>+ Add a feature the sheet missed</button>
    </>
  )
}

function Proclamation({ plan, parsed, tooBig, saving, sealedAt, onCancel, onCloser, onSeal, onOpen }) {
  const rows = diffRows(plan.diff)
  const { lead, title } = proclamation(plan.diff, parsed.identity)
  const { milestone } = plan
  const initial = (parsed.identity.name || 'M').trim().charAt(0).toUpperCase()

  return (
    <div className="proclaim-wrap">
      <section className="proclaim" aria-labelledby="proclaim-title">
        <p className="rubric rubric--quiet">Re-import · {plan.doc.sourceFileName}</p>
        <h2 id="proclaim-title" className="title proclaim-title">Be it known</h2>
        <p className="proclaim-lead">{lead}</p>
        {title && <p className="title proclaim-rank">{title}</p>}
        <hr className="rule rule--double" />
        {rows.length > 0 && (
          <dl className="proclaim-diff">
            {rows.map((d) => (
              <div key={d.label} className="proclaim-row">
                <dt>{d.label}</dt>
                <dd className={`proclaim-from${d.from === '—' ? ' is-none' : ''}`}>{d.from}</dd>
                <dd className="proclaim-arrow" aria-label="becomes">→</dd>
                <dd className="proclaim-to">{d.to}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="meta">
          {plan.dossier.filled.length > 0
            ? `${plan.dossier.filled.length} empty dossier ${plan.dossier.filled.length === 1 ? 'field' : 'fields'} to fill`
            : 'your notes and dossier untouched'}
          {plan.items.create.length > 0 && ` · ${plan.items.create.length} new item pages`}
          {plan.resources.some((r) => r.isNew !== false) && ' · new features to check'}
        </p>
        {tooBig && (
          <p className="error-note" role="alert">
            This sheet is {kb(plan.bytes)}, too close to Firestore’s 1 MiB document limit to save safely.
          </p>
        )}

        {sealedAt ? (
          <div className="proclaim-sealed">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="proclaim-seal">
              <path
                d="M32 4l5 6 8-2 2 8 8 2-2 8 6 5-6 5 2 8-8 2-2 8-8-2-5 6-5-6-8 2-2-8-8-2 2-8-6-5 6-5-2-8 8-2 2-8 8 2z"
                className="fill-ink-on-gold stroke-gold-lo"
              />
              <circle cx="32" cy="32" r="17" fill="none" strokeWidth="1.2" className="stroke-gold" />
              <text x="32" y="42" textAnchor="middle" className="proclaim-seal-letter fill-gold-hi">{initial}</text>
            </svg>
            <div>
              <p className="proclaim-sealed-title" role="status">Sealed at {clock(sealedAt)}</p>
              <p className="meta">
                {milestone?.session
                  ? `A milestone was added to “${milestone.session.title || 'the session'}”.`
                  : milestone
                    ? 'No session to log a milestone in yet.'
                    : 'Nothing changed, so no milestone.'}
              </p>
            </div>
            <button className="btn-primary btn--lg" onClick={onOpen}>Open the sheet</button>
          </div>
        ) : (
          <div className="proclaim-actions">
            <button className="btn btn--lg" onClick={onCancel} disabled={saving}>Not yet</button>
            <button className="btn btn--lg" onClick={onCloser} disabled={saving}>Look closer</button>
            <button className="btn-leaf btn--lg" onClick={onSeal} disabled={saving || tooBig}>
              {saving ? 'Sealing…' : 'Seal it'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
