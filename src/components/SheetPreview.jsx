// Read-only view of a parsed D&D Beyond sheet: the import preview and the
// Sheet tab. Functional markup only — styling lives in the .sheet-* classes.
import { ABILITY_KEYS } from '../lib/sheet'

const signed = (n) => (n == null ? '—' : n >= 0 ? `+${n}` : String(n))
const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')

// Proficiency is shown as a letter with a spelled-out title, never colour alone.
const PROF_MARK = {
  proficient: { mark: 'P', label: 'proficient' },
  expertise: { mark: 'E', label: 'expertise' },
  half: { mark: '½', label: 'half proficiency (Jack of All Trades)' },
}

export default function SheetPreview({ sheet }) {
  if (!sheet) return null
  const { identity, abilities, skills, combat, proficiencies, actions, attacks, features, inventory, personality } = sheet

  const spellsByLevel = new Map()
  for (const s of sheet.spells) {
    if (!spellsByLevel.has(s.level)) spellsByLevel.set(s.level, [])
    spellsByLevel.get(s.level).push(s)
  }

  const featureGroups = new Map()
  for (const f of features) {
    if (!featureGroups.has(f.group)) featureGroups.set(f.group, [])
    featureGroups.get(f.group).push(f)
  }

  return (
    <div className="sheet">
      <section className="sheet-section">
        <h3 className="sheet-name">{identity.name || 'unnamed'}</h3>
        <p className="sheet-sub">
          {[identity.classLevel, identity.species, identity.background, identity.alignment].filter(Boolean).join(' · ')}
        </p>
      </section>

      <section className="sheet-section">
        <h4 className="dossier-label">Combat</h4>
        <dl className="sheet-facts">
          <Fact label="AC" value={combat.ac} />
          <Fact label="HP" value={combat.maxHp} />
          <Fact label="Initiative" value={signed(combat.initiative)} />
          <Fact label="Speed" value={combat.speed} />
          <Fact label="Proficiency" value={signed(combat.profBonus)} />
          <Fact label="Hit dice" value={combat.hitDice.total} />
          <Fact label="Passive Perception" value={combat.passives.perception} />
          <Fact label="Passive Insight" value={combat.passives.insight} />
          <Fact label="Passive Investigation" value={combat.passives.investigation} />
          {combat.senses && <Fact label="Senses" value={combat.senses} />}
          {combat.defenses && <Fact label="Defenses" value={combat.defenses} />}
        </dl>
      </section>

      <section className="sheet-section">
        <h4 className="dossier-label">Abilities &amp; saves</h4>
        <div className="stat-grid">
          {ABILITY_KEYS.map((k) => (
            <div key={k} className="stat">
              <div className="stat-label">{k}</div>
              <div className="stat-value">{abilities[k].score ?? '—'}</div>
              <div className="sheet-stat-mod">{signed(abilities[k].mod)}</div>
              <div className="sheet-stat-save">
                save {signed(abilities[k].save)}
                {abilities[k].saveProficient && <abbr title="proficient"> P</abbr>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet-section">
        <h4 className="dossier-label">Skills</h4>
        <ul className="sheet-skills">
          {skills.map((s) => {
            const prof = PROF_MARK[s.proficiency]
            return (
              <li key={s.key} className="sheet-skill">
                <span className="sheet-skill-mark">
                  {prof ? <abbr title={prof.label}>{prof.mark}</abbr> : <span aria-hidden="true">·</span>}
                </span>
                <span className="sheet-skill-name">{s.label}</span>
                <span className="sheet-skill-ability">{s.ability}</span>
                <span className="sheet-skill-bonus">{signed(s.bonus)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {attacks.length > 0 && (
        <section className="sheet-section">
          <h4 className="dossier-label">Attacks</h4>
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
        </section>
      )}

      {sheet.spells.length > 0 && (
        <section className="sheet-section">
          <h4 className="dossier-label">Spells</h4>
          {sheet.spellcasting.map((c, i) => (
            <p key={i} className="sheet-sub">
              {c.class} · {c.ability} · save DC {c.saveDC ?? '—'} · attack {signed(c.attackBonus)}
            </p>
          ))}
          {[...spellsByLevel].map(([level, spells]) => (
            <details key={level} className="sheet-details" open>
              <summary>
                {level === 0 ? 'Cantrips' : `${ordinal(level)} level`}
                {level > 0 && sheet.slots[level] != null && ` · ${sheet.slots[level]} slots`}
                <span className="tab-count">{spells.length}</span>
              </summary>
              <table className="sheet-table">
                <thead>
                  <tr><th>Spell</th><th>Time</th><th>Range</th><th>Save/Hit</th><th>Duration</th><th>Source</th></tr>
                </thead>
                <tbody>
                  {spells.map((s) => (
                    <tr key={s.key}>
                      <td>
                        {s.name}
                        {s.concentration && <abbr title="concentration"> (C)</abbr>}
                        {s.alwaysPrepared && <abbr title="always prepared"> (P)</abbr>}
                      </td>
                      <td>{s.castingTime}</td>
                      <td>{s.range}</td>
                      <td>{s.saveHit || '—'}</td>
                      <td>{s.duration}</td>
                      <td>{s.sources.join(', ')}{s.freeUse && ` · ${s.freeUse.max}× free / ${s.freeUse.reset} rest`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </section>
      )}

      {actions.length > 0 && (
        <section className="sheet-section">
          <h4 className="dossier-label">Actions</h4>
          {actions.map((a, i) => (
            <details key={i} className="sheet-details">
              <summary>
                {a.name} <span className="sheet-tag">{a.section}</span>
                {a.uses && <span className="sheet-tag">{a.uses}</span>}
              </summary>
              <p className="sheet-text">{a.text}</p>
            </details>
          ))}
        </section>
      )}

      <section className="sheet-section">
        <h4 className="dossier-label">Features <span className="tab-count">{features.length}</span></h4>
        {[...featureGroups].map(([group, list]) => (
          <div key={group} className="sheet-group">
            {group && <h5 className="sheet-group-title">{group}</h5>}
            {list.map((f, i) => (
              <details key={`${f.name}-${i}`} className="sheet-details">
                <summary>
                  {f.name} {f.source && <span className="sheet-tag">{f.source}</span>}
                </summary>
                {f.notes.length > 0 && (
                  <ul className="sheet-notes">
                    {f.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                )}
                {f.text && <p className="sheet-text">{f.text}</p>}
              </details>
            ))}
          </div>
        ))}
      </section>

      <section className="sheet-section">
        <h4 className="dossier-label">Inventory <span className="tab-count">{inventory.items.length}</span></h4>
        <p className="sheet-sub">
          {['pp', 'gp', 'ep', 'sp', 'cp'].filter((c) => inventory.currency[c]).map((c) => `${inventory.currency[c]} ${c}`).join(' · ') || 'no coin'}
          {inventory.carried.weight && ` · carrying ${inventory.carried.weight}`}
        </p>
        <table className="sheet-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Weight</th></tr>
          </thead>
          <tbody>
            {inventory.items.map((it, i) => (
              <tr key={i}><td>{it.name}</td><td>{it.qty}</td><td>{it.weight || '—'}</td></tr>
            ))}
          </tbody>
        </table>
        {inventory.attuned.length > 0 && <p className="sheet-sub">attuned: {inventory.attuned.join(', ')}</p>}
      </section>

      <section className="sheet-section">
        <h4 className="dossier-label">Proficiencies</h4>
        <dl className="sheet-facts">
          {Object.entries(proficiencies).map(([k, list]) => (
            <Fact key={k} label={k} value={list.join(', ')} />
          ))}
        </dl>
      </section>

      {Object.values(personality).some(Boolean) && (
        <section className="sheet-section">
          <h4 className="dossier-label">Personality</h4>
          <dl className="sheet-facts sheet-facts--prose">
            {[
              ['Traits', personality.traits],
              ['Ideals', personality.ideals],
              ['Bonds', personality.bonds],
              ['Flaws', personality.flaws],
              ['Appearance', personality.appearance],
              ['Allies', personality.allies],
              ['Backstory', personality.backstory],
              ['Notes', personality.additionalNotes],
            ]
              .filter(([, v]) => v)
              .map(([label, v]) => <Fact key={label} label={label} value={v} />)}
          </dl>
        </section>
      )}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="sheet-fact">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}
