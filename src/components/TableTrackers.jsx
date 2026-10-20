// Table view, left side, top: the numbers I need mid-fight and the
// trackers I tap. All behaviour comes from usePlayState's actions; this is
// layout only, and every control is a ≥ 48 px target.
import { useState } from 'react'
import { ABILITY_KEYS } from '../lib/sheet'
import { CONDITIONS } from '../lib/play'

const signed = (n) => (n == null ? '—' : n >= 0 ? `+${n}` : String(n))
const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')

const PROF_MARK = {
  proficient: { mark: 'P', label: 'proficient' },
  expertise: { mark: 'E', label: 'expertise' },
  half: { mark: '½', label: 'half proficiency' },
}

export default function TableTrackers({ sheet, state, actions }) {
  const { identity, combat, abilities, skills } = sheet
  const concentrationSpells = sheet.spells.filter((s) => s.concentration)

  return (
    <div className="table-trackers">
      <div className="table-identity">
        <h2 className="table-name">{identity.name}</h2>
        <p className="sheet-sub">{[identity.classLevel, identity.species].filter(Boolean).join(' · ')}</p>
      </div>

      <dl className="table-core">
        <Core label="AC" value={combat.ac} />
        <Core label="Init" value={signed(combat.initiative)} />
        <Core label="Speed" value={combat.speed.replace(/\s*\(Walking\)/i, '')} />
        <Core label="Prof" value={signed(combat.profBonus)} />
        <Core label="Passive Perc." value={combat.passives.perception} />
      </dl>

      <HitPoints state={state} actions={actions} />

      {state.hp.current === 0 && <DeathSaves saves={state.deathSaves} actions={actions} />}

      {state.slots.length > 0 && (
        <section className="table-block" aria-label="Spell slots">
          <h3 className="dossier-label">Spell slots</h3>
          {state.slots.map((s) => (
            <PipRow
              key={s.level}
              label={`${ordinal(s.level)}`}
              what={`${ordinal(s.level)}-level slot`}
              max={s.max}
              left={s.left}
              onSpend={() => actions.spendSlot(s.level)}
              onRestore={() => actions.restoreSlot(s.level)}
            />
          ))}
        </section>
      )}

      {state.resources.length > 0 && (
        <section className="table-block" aria-label="Resources">
          <h3 className="dossier-label">Resources</h3>
          {state.resources.map((r) => (
            <PipRow
              key={r.id}
              label={r.name}
              hint={r.reset === 'short' ? 'short rest' : 'long rest'}
              what={r.name}
              max={r.max}
              left={r.left}
              onSpend={() => actions.useResource(r.id)}
              onRestore={() => actions.restoreResource(r.id)}
            />
          ))}
        </section>
      )}

      <section className="table-block" aria-label="Concentration and conditions">
        <h3 className="dossier-label">Concentration</h3>
        {state.concentration ? (
          <div className="table-row">
            <span className="table-concentration">concentrating on <strong>{state.concentration}</strong></span>
            <button className="table-btn" onClick={() => actions.setConcentration(null)}>Drop</button>
          </div>
        ) : (
          <select
            className="table-select"
            value=""
            aria-label="Start concentrating on"
            onChange={(e) => e.target.value && actions.setConcentration(e.target.value)}
          >
            <option value="">not concentrating — choose a spell…</option>
            {concentrationSpells.map((s) => (
              <option key={s.key} value={s.name}>{s.name}</option>
            ))}
          </select>
        )}

        <h3 className="dossier-label">Conditions</h3>
        <div className="table-chips">
          {state.conditions.map((c) => (
            <button key={c} className="table-chip is-on" onClick={() => actions.toggleCondition(c)} aria-label={`Remove ${c}`}>
              {c} ×
            </button>
          ))}
          <select
            className="table-select"
            value=""
            aria-label="Add a condition"
            onChange={(e) => e.target.value && actions.toggleCondition(e.target.value)}
          >
            <option value="">{state.conditions.length ? 'add another…' : 'none — add…'}</option>
            {CONDITIONS.filter((c) => !state.conditions.includes(c)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </section>

      <Rests state={state} actions={actions} />

      <section className="table-block" aria-label="Abilities and saves">
        <div className="table-abilities">
          {ABILITY_KEYS.map((k) => (
            <div key={k} className="table-ability">
              <span className="table-ability-key">{k}</span>
              <span className="table-ability-mod">{signed(abilities[k].mod)}</span>
              <span className="table-ability-score">{abilities[k].score}</span>
              <span className="table-ability-save">
                save {signed(abilities[k].save)}
                {abilities[k].saveProficient && <abbr title="proficient"> P</abbr>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="table-block" aria-label="Skills">
        <ul className="table-skills">
          {skills.map((s) => {
            const prof = PROF_MARK[s.proficiency]
            return (
              <li key={s.key} className="table-skill">
                <span className="table-skill-mark">{prof ? <abbr title={prof.label}>{prof.mark}</abbr> : ''}</span>
                <span className="table-skill-name">{s.label}</span>
                <span className="table-skill-bonus">{signed(s.bonus)}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Core({ label, value }) {
  return (
    <div className="table-core-item">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

function HitPoints({ state, actions }) {
  const [amount, setAmount] = useState('')
  const n = Number(amount)
  const apply = (fn) => {
    if (!n) return
    fn(n)
    setAmount('')
  }
  const { current, max, temp } = state.hp
  return (
    <section className="table-block table-hp" aria-label="Hit points">
      <div className="table-hp-now" aria-live="polite">
        <span className="table-hp-current">{current}</span>
        <span className="table-hp-max">/ {max}</span>
        {temp > 0 && <span className="table-hp-temp">+{temp} temp</span>}
      </div>
      <div className="table-row">
        <button className="table-btn" onClick={() => actions.damage(1)} aria-label="1 damage">−1</button>
        <input
          className="table-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          placeholder="0"
          aria-label="Amount"
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply(actions.damage)}
        />
        <button className="table-btn" onClick={() => actions.heal(1)} aria-label="Heal 1">+1</button>
      </div>
      <div className="table-row">
        <button className="table-btn table-btn--danger" disabled={!n} onClick={() => apply(actions.damage)}>Damage</button>
        <button className="table-btn" disabled={!n} onClick={() => apply(actions.heal)}>Heal</button>
        <button className="table-btn" disabled={!n && !temp} onClick={() => { actions.setTemp(n || 0); setAmount('') }}>
          {n ? 'Set temp' : 'Clear temp'}
        </button>
      </div>
    </section>
  )
}

function DeathSaves({ saves, actions }) {
  return (
    <section className="table-block table-death" aria-label="Death saves">
      <h3 className="dossier-label">Death saves</h3>
      <div className="table-row">
        <span>✓ {saves.successes}/3</span>
        <button className="table-btn" onClick={() => actions.deathSave('success')} disabled={saves.successes >= 3}>Success</button>
        <span>✗ {saves.failures}/3</span>
        <button className="table-btn table-btn--danger" onClick={() => actions.deathSave('failure')} disabled={saves.failures >= 3}>Failure</button>
        <button className="table-btn" onClick={() => actions.deathSave('reset')}>Reset</button>
      </div>
    </section>
  )
}

/**
 * Pips for a slot level or resource. Filled pips are what's left: tap one to
 * spend it, tap a hollow one to get it back. The count is written out too,
 * so nothing depends on telling filled from hollow.
 */
function PipRow({ label, hint, what, max, left, onSpend, onRestore }) {
  return (
    <div className="table-pips">
      <span className="table-pips-label">
        {label}
        {hint && <span className="sheet-tag">{hint}</span>}
      </span>
      <span className="table-pips-row">
        {Array.from({ length: max }, (_, i) => {
          const available = i < left
          return (
            <button
              key={i}
              className={`table-pip${available ? ' is-available' : ''}`}
              onClick={available ? onSpend : onRestore}
              aria-label={`${what}: ${available ? 'available, tap to use' : 'used, tap to restore'}`}
            >
              <span aria-hidden="true">{available ? '●' : '○'}</span>
            </button>
          )
        })}
      </span>
      <span className="table-pips-count">{left}/{max}</span>
    </div>
  )
}

function Rests({ state, actions }) {
  const [shortOpen, setShortOpen] = useState(false)
  const [dice, setDice] = useState(0)
  const [healed, setHealed] = useState('')
  const die = state.hitDice.dice.map((d) => `d${d.die}`).join('/')

  const finishShort = () => {
    actions.shortRest({ hitDiceSpent: dice, healed: Number(healed) || 0 })
    setShortOpen(false)
    setDice(0)
    setHealed('')
  }

  return (
    <section className="table-block" aria-label="Rests">
      <div className="table-row">
        <span className="table-hitdice">hit dice {state.hitDice.left}/{state.hitDice.max} {die}</span>
        <button className="table-btn" onClick={() => setShortOpen((v) => !v)} aria-expanded={shortOpen}>Short rest</button>
        <button
          className="table-btn"
          onClick={() => confirm('Long rest? HP, slots, resources and hit dice all come back.') && actions.longRest()}
        >
          Long rest
        </button>
      </div>
      {shortOpen && (
        <div className="table-short-rest">
          <div className="table-row">
            <span>spend hit dice</span>
            <button className="table-btn" onClick={() => setDice((d) => Math.max(0, d - 1))} aria-label="One fewer hit die">−</button>
            <span className="table-pips-count" aria-live="polite">{dice}</span>
            <button
              className="table-btn"
              onClick={() => setDice((d) => Math.min(state.hitDice.left, d + 1))}
              aria-label="One more hit die"
            >
              +
            </button>
          </div>
          {dice > 0 && (
            <label className="table-row">
              <span>HP rolled (with CON)</span>
              <input
                className="table-input"
                type="number"
                inputMode="numeric"
                min={0}
                value={healed}
                onChange={(e) => setHealed(e.target.value)}
              />
            </label>
          )}
          <div className="table-row">
            <button className="table-btn" onClick={() => setShortOpen(false)}>Cancel</button>
            <button className="table-btn table-btn--primary" onClick={finishShort}>Finish short rest</button>
          </div>
        </div>
      )}
    </section>
  )
}
