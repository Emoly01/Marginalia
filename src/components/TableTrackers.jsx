// Table view, the sheet panel: the numbers I need mid-fight and the
// trackers I tap. All behaviour comes from usePlayState's actions; this is
// layout only, and every control is a ≥ 48 px target.
import { useState, useEffect, useRef } from 'react'
import { ABILITY_KEYS } from '../lib/sheet'
import { CONDITIONS, MAX_EXHAUSTION } from '../lib/play'
import { HpBar, Initial, Roundel } from './ornament'

const signed = (n) => (n == null ? '—' : n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')
const dieLabel = (state) => state.hitDice.dice.map((d) => `d${d.die}`).join('/')

/** Top of the panel: who, armour, hit points, the small numbers, abilities. */
export function TableSummary({ sheet, state, actions }) {
  const { identity, combat, abilities } = sheet
  const caster = sheet.spellcasting?.[0]
  const name = identity.name || 'Unnamed'
  const mini = [
    ['Init', signed(combat.initiative)],
    ['Speed', String(combat.speed ?? '—').replace(/\s*\(Walking\)/i, '').replace(/\s*ft\.?$/i, '')],
    ['Prof', signed(combat.profBonus)],
    ['Passive', combat.passives.perception],
    ...(caster
      ? [
          ['Save DC', caster.saveDC],
          ['Spell atk', signed(caster.attackBonus)],
        ]
      : [['Insight', combat.passives.insight]]),
  ]

  return (
    <>
      <div className="table-summary">
        <div className="table-who">
          <h2 className="table-name">
            <span className="sr-only">{name}</span>
            <span className="illuminated-visual" aria-hidden="true">
              <Initial letter={name.charAt(0).toUpperCase()} size={40} />
              <span className="title illuminated-rest">{name.slice(1)}</span>
            </span>
          </h2>
          <p className="table-who-line">
            <span className="table-who-part">{[identity.species, identity.classLevel].filter(Boolean).join(' ')}</span>
            {identity.background && <span className="table-who-part">{identity.background}</span>}
          </p>
          {(combat.defenses || combat.senses) && (
            <p className="table-who-quiet">
              {combat.defenses && <span className="table-who-part">{combat.defenses}</span>}
              {combat.senses && <span className="table-who-part">{combat.senses}</span>}
            </p>
          )}
        </div>

        <div className="card table-ac">
          <span className="table-ac-label">Armour</span>
          <span className="numeral table-ac-value">{combat.ac ?? '—'}</span>
          <span className="table-ac-label">class</span>
        </div>

        <HitPoints state={state} actions={actions} />

        <dl className="table-mini">
          {mini.map(([k, v]) => (
            <div key={k} className="card table-mini-cell">
              <dd className="numeral">{v ?? '—'}</dd>
              <dt>{k}</dt>
            </div>
          ))}
        </dl>
      </div>

      <dl className="table-abilities">
        {ABILITY_KEYS.map((k) => (
          <div key={k} className="card table-ability">
            <dt className="table-ability-key">
              {k.toUpperCase()} <span className="table-ability-score">{abilities[k].score ?? '—'}</span>
            </dt>
            <dd className="numeral table-ability-mod">{signed(abilities[k].mod)}</dd>
            <dd className="table-ability-save">
              save {signed(abilities[k].save)}
              {abilities[k].saveProficient && (
                <abbr className="table-prof" title="proficient">
                  {' '}●
                </abbr>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function HitPoints({ state, actions }) {
  const [open, setOpen] = useState(false)
  const { current, max, temp } = state.hp
  return (
    <div className="table-hp-wrap">
      <section className="card table-hp" aria-label="Hit points">
        <div className="table-hp-head">
          <span className="table-ac-label">Hit points</span>
          <span className="table-hp-temp">
            temp <span className="numeral">{temp}</span>
          </span>
        </div>
        <div className="table-hp-row">
          <button className="btn-icon table-hp-step" onClick={() => actions.damage(1)} aria-label="Lose 1 HP">
            −
          </button>
          <button
            className="table-hp-now"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`${current} of ${max} hit points. Type an amount`}
          >
            <span className="numeral table-hp-current" aria-live="polite">{current}</span>
            <span className="table-hp-max">/ {max}</span>
          </button>
          <button className="btn-icon table-hp-step" onClick={() => actions.heal(1)} aria-label="Heal 1 HP">
            +
          </button>
        </div>
        <HpBar current={current} max={max} />
        <span className="table-hp-dice">
          Hit dice {state.hitDice.left} / {state.hitDice.max}
          {state.hitDice.dice.length > 0 && ` · ${dieLabel(state)}`}
        </span>
      </section>
      {open && <HpAmount temp={temp} actions={actions} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** The typed amount: Damage, Heal, or set temp HP. */
function HpAmount({ temp, actions, onClose }) {
  const [amount, setAmount] = useState('')
  const inputRef = useRef(null)
  const n = Number(amount)
  useEffect(() => inputRef.current?.focus(), [])

  const apply = (fn) => {
    if (!n) return
    fn(n)
    onClose()
  }

  return (
    <>
      <div className="popover-scrim" onClick={onClose} />
      <div
        className="popover table-hp-pop"
        role="dialog"
        aria-label="Hit point amount"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <input
          ref={inputRef}
          className="table-hp-input numeral"
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          placeholder="0"
          aria-label="Amount"
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply(actions.damage)}
        />
        <div className="table-hp-pop-actions">
          <button className="btn btn--danger" disabled={!n} onClick={() => apply(actions.damage)}>
            Damage
          </button>
          <button className="btn-primary" disabled={!n} onClick={() => apply(actions.heal)}>
            Heal
          </button>
          <button
            className="btn"
            disabled={!n && !temp}
            onClick={() => {
              actions.setTemp(n || 0)
              onClose()
            }}
          >
            {n ? 'Set temp' : 'Clear temp'}
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * The tracker column: death saves when down, slots and limited-use features
 * as gilded roundels (scrolling), then concentration and conditions pinned
 * underneath, and the rests where the header can't hold them.
 */
export default function TableTrackers({ sheet, state, actions }) {
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const concentrationSpells = sheet.spells.filter((s) => s.concentration)
  const nConditions = state.conditions.length
  const afflicted = nConditions > 0 || state.exhaustion > 0
  const conditionSummary = nConditions
    ? `${state.conditions[0]}${nConditions > 1 ? ` +${nConditions - 1}` : ''}`
    : state.exhaustion
      ? `Exhaustion ${state.exhaustion}`
      : 'None  +'

  return (
    <div className="table-trackers">
      <div className="table-trackers-scroll">
        {state.hp.current === 0 && <DeathSaves saves={state.deathSaves} actions={actions} />}

        {state.slots.length > 0 && (
          <section className="tracker-list" aria-label="Spell slots">
            {state.slots.map((s) => (
              <Tracker
                key={s.level}
                label={ordinal(s.level)}
                what={`${ordinal(s.level)}-level slot`}
                max={s.max}
                left={s.left}
                count={`${s.left}/${s.max}`}
                slot
                onSpend={() => actions.spendSlot(s.level)}
                onRestore={() => actions.restoreSlot(s.level)}
              />
            ))}
          </section>
        )}

        {state.resources.length > 0 && (
          <section className="tracker-list tracker-list--pairs" aria-label="Limited-use features">
            {state.resources.map((r) => (
              <Tracker
                key={r.id}
                label={r.name}
                sub={r.reset === 'short' ? 'short rest' : 'long rest'}
                what={r.name}
                max={r.max}
                left={r.left}
                count={String(r.left)}
                onSpend={() => actions.useResource(r.id)}
                onRestore={() => actions.restoreResource(r.id)}
              />
            ))}
          </section>
        )}
      </div>

      <div className="table-pinned">
        <div className={`table-conc${state.concentration ? ' is-on' : ''}`}>
          {state.concentration ? (
            <>
              <span className="table-conc-text">
                <span className="table-conc-label">Concentrating</span>
                <span className="table-conc-name">{state.concentration}</span>
              </span>
              <button className="btn" onClick={() => actions.setConcentration(null)}>Drop</button>
            </>
          ) : (
            <label className="table-conc-text">
              <span className="table-conc-label">Concentration</span>
              <select
                className="table-conc-select"
                value=""
                onChange={(e) => e.target.value && actions.setConcentration(e.target.value)}
              >
                <option value="">Not concentrating</option>
                {concentrationSpells.map((s) => (
                  <option key={s.key} value={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          className={`table-cond-btn${afflicted ? ' is-on' : ''}`}
          onClick={() => setConditionsOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Conditions: ${nConditions ? state.conditions.join(', ') : 'none'}${state.exhaustion ? `, exhaustion ${state.exhaustion}` : ''}`}
        >
          <span className="table-conc-label">Conditions</span>
          <span className="table-cond-summary">{conditionSummary}</span>
        </button>
      </div>

      <Rests state={state} actions={actions} className="table-rests table-rests--column" />

      {conditionsOpen && <Conditions state={state} actions={actions} onClose={() => setConditionsOpen(false)} />}
    </div>
  )
}

/**
 * One slot level or feature as gilded roundels. Gold is what's left: tap one
 * to spend it, tap a bare ring to re-gild it. The count is written out too,
 * so nothing depends on telling gold from bare.
 */
function Tracker({ label, sub, what, max, left, count, slot = false, onSpend, onRestore }) {
  return (
    <div className={`tracker${slot ? ' tracker--slot' : ''}${max === 1 ? ' tracker--single' : ''}`}>
      <span className="tracker-label">
        <span className="tracker-name">{label}</span>
        {sub && <span className="tracker-sub">{sub}</span>}
      </span>
      <span className="tracker-roundels">
        {Array.from({ length: max }, (_, i) => (
          <Roundel key={i} available={i < left} label={what} onSpend={onSpend} onRestore={onRestore} />
        ))}
      </span>
      <span className="numeral tracker-count">{count}</span>
    </div>
  )
}

function DeathSaves({ saves, actions }) {
  return (
    <section className="table-death" aria-label="Death saves">
      <span className="rubric">Death saves</span>
      <div className="table-death-row">
        <button className="btn" onClick={() => actions.deathSave('success')} disabled={saves.successes >= 3}>
          ✓ Success <span className="numeral">{saves.successes}/3</span>
        </button>
        <button className="btn btn--danger" onClick={() => actions.deathSave('failure')} disabled={saves.failures >= 3}>
          ✗ Failure <span className="numeral">{saves.failures}/3</span>
        </button>
        <button className="btn" onClick={() => actions.deathSave('reset')}>Reset</button>
      </div>
    </section>
  )
}

/** Conditions overlay: tap to toggle, Clear all, and exhaustion as a counter. */
function Conditions({ state, actions, onClose }) {
  const doneRef = useRef(null)
  useEffect(() => doneRef.current?.focus(), [])
  const n = state.conditions.length
  const exhaustion = state.exhaustion
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div
        className="dialog table-conditions"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conditions-title"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="table-conditions-head">
          <h2 id="conditions-title" className="dialog-title">Conditions</h2>
          <span className="meta table-conditions-count">{n ? `${n} active · tap to toggle` : 'Tap to mark what’s afflicting you'}</span>
          <button className="btn" onClick={actions.clearConditions} disabled={!n && !exhaustion}>
            Clear all
          </button>
        </div>
        <div className="table-conditions-grid">
          {CONDITIONS.map((c) => {
            const on = state.conditions.includes(c)
            return (
              <button key={c} className="table-condition" aria-pressed={on} onClick={() => actions.toggleCondition(c)}>
                <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
                <span>{c}</span>
              </button>
            )
          })}
        </div>
        <div className="table-conditions-foot">
          <span className="table-exhaustion">
            <span className="table-exhaustion-title" id="exhaustion-label">Exhaustion</span>
            <span className="meta">{exhaustion ? `level ${exhaustion} of ${MAX_EXHAUSTION}` : 'none'}</span>
          </span>
          <div className="stepper" role="group" aria-labelledby="exhaustion-label">
            <button className="btn-icon" onClick={() => actions.setExhaustion(exhaustion - 1)} disabled={exhaustion <= 0} aria-label="Less exhaustion">
              −
            </button>
            <span className="stepper-value numeral" aria-live="polite">{exhaustion}</span>
            <button
              className="btn-icon"
              onClick={() => actions.setExhaustion(exhaustion + 1)}
              disabled={exhaustion >= MAX_EXHAUSTION}
              aria-label="More exhaustion"
            >
              +
            </button>
          </div>
          <button ref={doneRef} className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  )
}

/** Short rest (with the hit-dice step) and long rest. */
export function Rests({ state, actions, className = '' }) {
  const [shortOpen, setShortOpen] = useState(false)
  return (
    <div className={className}>
      <button className="btn-gilt" onClick={() => setShortOpen(true)} aria-haspopup="dialog">Short rest</button>
      <button
        className="btn-gilt"
        onClick={() =>
          confirm(
            'Long rest? HP, slots, resources and hit dice come back, concentration ends, and exhaustion drops by one.'
          ) && actions.longRest()
        }
      >
        Long rest
      </button>
      {shortOpen && <ShortRest state={state} actions={actions} onClose={() => setShortOpen(false)} />}
    </div>
  )
}

function ShortRest({ state, actions, onClose }) {
  const [dice, setDice] = useState(0)
  const [healed, setHealed] = useState('')

  const finish = () => {
    actions.shortRest({ hitDiceSpent: dice, healed: Number(healed) || 0 })
    onClose()
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div
        className="dialog dialog--center table-short-rest"
        role="dialog"
        aria-modal="true"
        aria-labelledby="short-rest-title"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2 id="short-rest-title" className="dialog-title">Short rest</h2>
        <div className="table-short-row">
          <span className="table-short-label" id="hit-dice-label">
            Spend hit dice
            <span className="meta">
              {state.hitDice.left} of {state.hitDice.max} left
              {state.hitDice.dice.length > 0 && ` · ${dieLabel(state)}`}
            </span>
          </span>
          <div className="stepper" role="group" aria-labelledby="hit-dice-label">
            <button className="btn-icon" onClick={() => setDice((d) => Math.max(0, d - 1))} disabled={dice <= 0} aria-label="One fewer hit die">
              −
            </button>
            <span className="stepper-value numeral" aria-live="polite">{dice}</span>
            <button
              className="btn-icon"
              onClick={() => setDice((d) => Math.min(state.hitDice.left, d + 1))}
              disabled={dice >= state.hitDice.left}
              aria-label="One more hit die"
            >
              +
            </button>
          </div>
        </div>
        {dice > 0 && (
          <label className="field">
            <span className="field-label">HP rolled (with CON)</span>
            <input type="number" inputMode="numeric" min={0} value={healed} onChange={(e) => setHealed(e.target.value)} autoFocus />
          </label>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={finish}>Finish short rest</button>
        </div>
      </div>
    </>
  )
}
