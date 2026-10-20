// Import (or re-import) a D&D Beyond PDF export. The PDF is read in the
// browser and never leaves it; only the parsed fields are saved.
//
// One page, top to bottom: pick the file → what changed (re-import) →
// preview → dossier fields that will be filled → items → resources to
// confirm → save. The plan comes from src/lib/sheet/importPlan.js; this
// component only shows it and collects the resource edits.
import { useState } from 'react'
import { readPdfFields, parseDdbSheet, buildImportPlan, cleanResources, SHEET_DOC_BUDGET } from '../lib/sheet'
import { getSheetDoc, getPlay, saveSheetImport } from '../lib/characterSheet'
import { getCharacter } from '../lib/character'
import { listSessions } from '../lib/sessions'
import { toast } from '../lib/toast'
import SheetPreview from './SheetPreview'

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

export default function SheetImport({ userId, campaignId, entities, onCancel, onSaved }) {
  const [phase, setPhase] = useState('pick') // pick | reading | review | saving
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [rows, setRows] = useState([])
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setPhase('reading')
    try {
      const { fields } = await readPdfFields(file)
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
      setRows(next.resources)
      setPhase('review')
    } catch (err) {
      console.error('Sheet import failed:', err)
      setError(err.message || 'Could not read that PDF.')
      setPhase('pick')
    }
  }

  const handleSave = async () => {
    setPhase('saving')
    try {
      await saveSheetImport(userId, campaignId, plan, cleanResources(rows))
      toast(plan.isReimport ? 'Sheet updated.' : 'Sheet imported.', 'info')
      onSaved?.({ createdItems: plan.items.create.length > 0 })
    } catch (err) {
      console.error('Saving sheet failed:', err)
      toast('Could not save the sheet.')
      setPhase('review')
    }
  }

  const updateRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const removeRow = (i) => setRows((rs) => rs.filter((_, j) => j !== i))
  const addRow = () =>
    setRows((rs) => [...rs, { id: '', name: '', max: 1, reset: 'long', origin: 'manual', evidence: [], conflict: false, isNew: true }])

  if (phase === 'pick' || phase === 'reading') {
    return (
      <div className="column column--narrow">
        <div className="row-between">
          <span className="hint">D&amp;D Beyond → character menu → Export to PDF</span>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
        <label
          className={`sheet-dropzone${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sheet-dropzone-input"
            disabled={phase === 'reading'}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="empty-state-title">
            {phase === 'reading' ? 'reading the sheet…' : 'drop the PDF here, or tap to choose it'}
          </span>
          <span className="empty-state-sub">It is read on this device and never uploaded.</span>
        </label>
        {error && <div className="error-note" role="alert">{error}</div>}
      </div>
    )
  }

  const tooBig = plan.bytes > SHEET_DOC_BUDGET
  const { dossier, items, diff, milestone } = plan

  return (
    <div className="column column--wide sheet-import">
      <div className="row-between">
        <span className="hint">
          {plan.isReimport ? 'Re-import' : 'Import'} of {plan.doc.sourceFileName} · {kb(plan.bytes)} stored
        </span>
        <button className="btn" onClick={onCancel} disabled={phase === 'saving'}>Cancel</button>
      </div>

      {diff && (
        <section className="panel sheet-step">
          <h3 className="dossier-label">What changed</h3>
          {diff.hasChanges ? <DiffList diff={diff} /> : <p className="hint">nothing changed since the last import</p>}
          {milestone && (
            <p className="sheet-sub">
              {milestone.session
                ? <>Will be logged in “{milestone.session.title}”: <em>{milestone.text}</em></>
                : <>No session to log this in yet — the milestone won’t be written.</>}
            </p>
          )}
        </section>
      )}

      <section className="panel sheet-step">
        <h3 className="dossier-label">Dossier</h3>
        {dossier.filled.length === 0 ? (
          <p className="hint">Nothing to fill — every dossier field the sheet covers already has something in it.</p>
        ) : (
          <>
            <p className="dossier-hint">These empty dossier fields will be filled:</p>
            <dl className="sheet-facts">
              {dossier.filled.map((f) => (
                <div key={f.key} className="sheet-fact">
                  <dt>{f.label}</dt>
                  <dd>{formatDossierValue(f.key, f.value)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {dossier.kept.length > 0 && (
          <p className="hint">Already written, left alone: {dossier.kept.map((k) => k.label).join(', ')}.</p>
        )}
      </section>

      <section className="panel sheet-step">
        <h3 className="dossier-label">Items</h3>
        {items.create.length > 0 ? (
          <>
            <p className="dossier-hint">These become Item entities, so you can @-mention them and keep notes:</p>
            <div className="pill-row">{items.create.map((n) => <span key={n} className="pill">{n}</span>)}</div>
          </>
        ) : (
          <p className="hint">No new items.</p>
        )}
        {items.existing.length > 0 && <p className="hint">Already have an entry: {items.existing.join(', ')}.</p>}
      </section>

      <section className="panel sheet-step">
        <h3 className="dossier-label">Limited-use resources</h3>
        <p className="dossier-hint">
          Read from the sheet’s text, which is guesswork — check the numbers and when each one comes back.
        </p>
        <ResourceRows rows={rows} onChange={updateRow} onRemove={removeRow} />
        <div>
          <button className="btn-dashed" onClick={addRow}>+ add resource</button>
        </div>
      </section>

      <details className="panel sheet-step sheet-details" open={!plan.isReimport}>
        <summary className="dossier-label">Everything on the sheet</summary>
        <SheetPreview sheet={parsed} />
      </details>

      {tooBig && (
        <div className="error-note" role="alert">
          This sheet is {kb(plan.bytes)}, too close to Firestore’s 1 MiB document limit to save safely.
        </div>
      )}

      <div className="sheet-actions">
        <button className="btn" onClick={onCancel} disabled={phase === 'saving'}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={phase === 'saving' || tooBig}>
          {phase === 'saving' ? 'Saving…' : plan.isReimport ? 'Save re-import' : 'Save sheet'}
        </button>
      </div>
    </div>
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

function ResourceRows({ rows, onChange, onRemove }) {
  if (rows.length === 0) return <p className="hint">None found.</p>
  return (
    <ul className="sheet-resources">
      {rows.map((r, i) => (
        <li key={i} className={`sheet-resource${r.conflict ? ' has-conflict' : ''}`}>
          <div className="sheet-resource-fields">
            <label className="field">
              <span className="field-label">Name</span>
              <input value={r.name} onChange={(e) => onChange(i, { name: e.target.value })} />
            </label>
            <label className="field sheet-resource-max">
              <span className="field-label">Uses</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={r.max}
                onChange={(e) => onChange(i, { max: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Comes back on</span>
              <select value={r.reset} onChange={(e) => onChange(i, { reset: e.target.value })}>
                <option value="short">short or long rest</option>
                <option value="long">long rest</option>
              </select>
            </label>
            <button className="btn-icon sheet-resource-remove" onClick={() => onRemove(i)} aria-label={`Remove ${r.name || 'resource'}`}>
              ×
            </button>
          </div>
          {(r.evidence?.length > 0 || r.origin) && (
            <p className="field-hint">
              {r.isNew === false ? ORIGIN_LABEL.confirmed : ORIGIN_LABEL[r.origin] ?? r.origin}
              {r.evidence?.length > 0 && <> · sheet says: {r.evidence.map((e) => `“${e.text}”`).join(', ')}</>}
            </p>
          )}
          {r.conflict && <p className="field-hint sheet-conflict">The sheet disagrees with itself here — pick the right one.</p>}
        </li>
      ))}
    </ul>
  )
}

function DiffList({ diff }) {
  const rows = []
  if (diff.classLevel) rows.push(['Class', `${diff.classLevel.from || '—'} → ${diff.classLevel.to || '—'}`])
  if (diff.maxHp) rows.push(['Max HP', `${diff.maxHp.from ?? '—'} → ${diff.maxHp.to ?? '—'}`])
  if (diff.profBonus) rows.push(['Proficiency', `${diff.profBonus.from ?? '—'} → ${diff.profBonus.to ?? '—'}`])
  for (const s of diff.slots) rows.push([`Level ${s.level} slots`, `${s.from} → ${s.to}`])
  for (const a of diff.abilities) rows.push([a.key.toUpperCase(), `${a.from ?? '—'} → ${a.to ?? '—'}`])
  if (diff.spells.added.length) rows.push(['New spells', diff.spells.added.join(', ')])
  if (diff.spells.removed.length) rows.push(['Spells gone', diff.spells.removed.join(', ')])
  if (diff.features.added.length) rows.push(['New features', diff.features.added.join(', ')])
  if (diff.features.removed.length) rows.push(['Features gone', diff.features.removed.join(', ')])
  if (diff.items.added.length) rows.push(['New items', diff.items.added.join(', ')])
  if (diff.items.removed.length) rows.push(['Items gone', diff.items.removed.join(', ')])
  for (const c of diff.items.changed) rows.push([c.name, `${c.from} → ${c.to}`])
  return (
    <dl className="sheet-facts">
      {rows.map(([label, value]) => (
        <div key={label} className="sheet-fact">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
