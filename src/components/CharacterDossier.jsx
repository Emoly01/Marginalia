import { useState, useEffect, useRef, useMemo } from 'react'
import {
  getCharacter,
  saveCharacter,
  emptyCharacter,
  emptyAbilities,
  ABILITIES,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_STATUSES,
  CHARACTER_STATUSES,
} from '../lib/character'
import { useDebounce } from '../lib/useDebounce'
import { excerptFrom } from '../lib/text'
import { toast } from '../lib/toast'
import RichTextEditor from './RichTextEditor'
import { IlluminatedTitle } from './ornament'

export default function CharacterDossier({
  userId,
  campaignId,
  campaignCharacterName,
  entities = [],
  onOpenEntity,
}) {
  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [editing, setEditing] = useState(false)
  const isDirty = useRef(false)

  // Load character on mount / campaign change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    isDirty.current = false
    getCharacter(userId, campaignId)
      .then((data) => {
        if (cancelled) return
        setCharacter(
          data
            ? { ...emptyCharacter(), ...data, abilities: { ...emptyAbilities(), ...data.abilities } }
            : { ...emptyCharacter(), name: campaignCharacterName || '' }
        )
        setLoading(false)
        setSaveStatus('saved')
      })
      .catch((err) => {
        console.error('Failed to load character:', err)
        toast('Could not load character.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, campaignId, campaignCharacterName])

  // Autosave debounced
  const debouncedCharacter = useDebounce(character, 1000)
  useEffect(() => {
    if (!isDirty.current || !debouncedCharacter) return
    setSaveStatus('saving')
    saveCharacter(userId, campaignId, debouncedCharacter)
      .then(() => setSaveStatus('saved'))
      .catch((err) => {
        console.error('Save failed:', err)
        setSaveStatus('unsaved')
        toast('Autosave failed — your latest changes are not saved yet.')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCharacter])

  const update = (patch) => {
    isDirty.current = true
    setSaveStatus('unsaved')
    setCharacter((c) => ({ ...c, ...patch }))
  }

  const setAbility = (key, value) => {
    update({ abilities: { ...character.abilities, [key]: value } })
  }

  const addRelationship = () => {
    update({
      relationships: [
        ...(character.relationships || []),
        { id: crypto.randomUUID(), name: '', type: 'friend', status: 'neutral', notes: '' },
      ],
    })
  }

  const updateRelationship = (id, patch) => {
    update({
      relationships: character.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })
  }

  const removeRelationship = (id) => {
    if (!confirm('Remove this relationship?')) return
    update({ relationships: character.relationships.filter((r) => r.id !== id) })
  }

  const threads = useMemo(
    () => entities.filter((e) => e.type === 'thread'),
    [entities]
  )

  if (loading || !character) {
    return <p className="hint">opening the dossier…</p>
  }

  const blurb = [
    [character.class, character.level > 1 ? character.level : ''].filter(Boolean).join(' '),
    character.ancestry,
    character.background,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="page-narrow dossier">
      <section className="panel dossier-card">
        <div className="dossier-card-head">
          <div className="dossier-card-name">
            {editing ? (
              <input
                className="input-ghost dossier-name-input"
                value={character.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Character name"
                aria-label="Character name"
              />
            ) : (
              <IlluminatedTitle text={character.name || 'Unnamed'} as="h1" size={52} className="dossier-title" />
            )}
            {!editing && <p className="dossier-blurb">{blurb || 'no sheet written yet'}</p>}
          </div>
          <SaveIndicator status={saveStatus} />
          <button className="btn-gilt" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? 'Done' : 'Edit details'}
          </button>
        </div>

        {editing && (
          <div className="dossier-fields">
            <Field label="Class / concept">
              <input value={character.class} onChange={(e) => update({ class: e.target.value })} placeholder="warlock" />
            </Field>
            <Field label="Level">
              <input type="number" min={1} inputMode="numeric" value={character.level} onChange={(e) => update({ level: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Ancestry">
              <input value={character.ancestry} onChange={(e) => update({ ancestry: e.target.value })} placeholder="tiefling" />
            </Field>
            <Field label="Pronouns">
              <input value={character.pronouns} onChange={(e) => update({ pronouns: e.target.value })} placeholder="she/her" />
            </Field>
            <Field label="Background">
              <input value={character.background} onChange={(e) => update({ background: e.target.value })} placeholder="cultist" />
            </Field>
            <Field label="Status">
              <select value={character.status} onChange={(e) => update({ status: e.target.value })}>
                {CHARACTER_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="dossier-abilities">
          {ABILITIES.map((a) => (
            <div key={a.key} className="card card--ruled dossier-ability">
              <span className="field-label">{a.label.toUpperCase()}</span>
              {editing ? (
                <input
                  type="number"
                  inputMode="numeric"
                  className="dossier-ability-input"
                  aria-label={a.label}
                  value={character.abilities?.[a.key] ?? 10}
                  onChange={(e) => setAbility(a.key, Number(e.target.value) || 0)}
                />
              ) : (
                <span className="numeral dossier-ability-num">{character.abilities?.[a.key] ?? 10}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <Section title="Open threads">
        {threads.length === 0 ? (
          <p className="hint">Nothing hanging yet — make a codex page of kind “thread” for the questions you are chasing.</p>
        ) : (
          <ul className="dossier-threads">
            {threads.map((t) => (
              <li key={t.id}>
                <button className="dossier-thread" onClick={() => onOpenEntity?.(t.id)}>
                  <span className="dossier-thread-name">{t.name}</span>
                  {excerptFrom(t.notes, 140) && <span className="meta">{excerptFrom(t.notes, 140)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Personality" hint="voice, tics, quirks, how they show up in the world">
        <Prose value={character.personality} onChange={(html) => update({ personality: html })} placeholder="Who is this person, when they're being themselves?" />
      </Section>
      <Section title="Backstory" hint="where they came from, what shaped them">
        <Prose value={character.backstory} onChange={(html) => update({ backstory: html })} placeholder="Their history, before the campaign began…" />
      </Section>
      <Section title="Goals" hint="what they're chasing — shown as “Wants, now” until a session sets an intention">
        <Prose value={character.goals} onChange={(html) => update({ goals: html })} placeholder="What does this character want? What are they running from?" />
      </Section>
      <Section title="What my character knows" hint="in-character knowledge — what they've learned, witnessed, deduced">
        <Prose value={character.knowledge} onChange={(html) => update({ knowledge: html })} placeholder="What does this character know about the world, the plot, the people around them?" />
      </Section>
      <Section title="What I know (OOC)" hint="the sealed secret on the campaign home — player knowledge the character hasn't earned yet">
        <Prose value={character.knowledgeOOC} onChange={(html) => update({ knowledgeOOC: html })} placeholder="Things you know but your character doesn't (yet)…" />
      </Section>
      <Section title="Items of meaning" hint="things that matter narratively — not full inventory">
        <Prose value={character.items} onChange={(html) => update({ items: html })} placeholder="The locket, the broken sword, the letter she never sent…" />
      </Section>
      <Section title="Vibes" hint="songs, aesthetic, mood, image prompts">
        <Prose value={character.vibes} onChange={(html) => update({ vibes: html })} placeholder="Playlists, colour palettes, art references, mood notes…" />
      </Section>

      <Section title="Bonds" hint="relationships — shown as Bonds on the campaign home">
        {(character.relationships || []).length === 0 ? (
          <p className="hint">no bonds tracked yet</p>
        ) : (
          (character.relationships || []).map((rel) => (
            <RelationshipCard
              key={rel.id}
              relationship={rel}
              onUpdate={(patch) => updateRelationship(rel.id, patch)}
              onRemove={() => removeRelationship(rel.id)}
            />
          ))
        )}
        <div>
          <button className="btn-gilt" onClick={addRelationship}>+ Add a bond</button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="dossier-section">
      <h2 className="rubric">{title}</h2>
      {hint && <p className="field-hint">{hint}</p>}
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function Prose({ value, onChange, placeholder }) {
  return (
    <div className="card dossier-surface">
      <RichTextEditor content={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

function RelationshipCard({ relationship, onUpdate, onRemove }) {
  const statusInfo = RELATIONSHIP_STATUSES.find((st) => st.value === relationship.status) || RELATIONSHIP_STATUSES[2]
  return (
    <div className="card bond-card" data-status={relationship.status}>
      <div className="bond-card-row">
        <input className="input-ghost bond-name" value={relationship.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Name" aria-label="Name" />
        <select value={relationship.type} onChange={(e) => onUpdate({ type: e.target.value })} aria-label="Kind of bond">
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={relationship.status} onChange={(e) => onUpdate({ status: e.target.value })} aria-label="How things stand">
          {RELATIONSHIP_STATUSES.map((st) => (
            <option key={st.value} value={st.value}>{st.label}</option>
          ))}
        </select>
        <button className="btn-icon" onClick={onRemove} aria-label={`Remove ${relationship.name || 'this bond'}`}>×</button>
      </div>
      <p className="bond-status">{statusInfo.label}</p>
      <textarea
        value={relationship.notes}
        onChange={(e) => onUpdate({ notes: e.target.value })}
        placeholder="What's the dynamic? What's unsaid? What's evolving?"
        rows={2}
        aria-label={`Notes on ${relationship.name || 'this bond'}`}
      />
    </div>
  )
}

function SaveIndicator({ status }) {
  const text = { saved: 'saved', saving: 'saving…', unsaved: 'unsaved' }[status]
  return <span className={`save-state${status === 'unsaved' ? ' save-state--unsaved' : ''}`} aria-live="polite">{text}</span>
}
