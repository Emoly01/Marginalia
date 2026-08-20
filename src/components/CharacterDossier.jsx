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
    return <p className="hint">loading dossier…</p>
  }

  const blurb = [
    [character.class, character.level > 1 ? character.level : ''].filter(Boolean).join(' '),
    character.ancestry,
    character.background,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="column column--narrow" style={{ gap: '16px' }}>
      {/* Summary card */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <input
                className="input-ghost input-title"
                value={character.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Character name"
              />
            ) : (
              <h3 style={{
                fontSize: '26px',
                fontStyle: 'italic',
                fontWeight: 'normal',
                color: 'var(--m-accent)',
                lineHeight: 1.1,
              }}>
                {character.name || 'unnamed'}
              </h3>
            )}
            {!editing && (
              <p style={{ fontSize: '15px', color: 'var(--m-text-3)', marginTop: '5px' }}>
                {blurb || 'no sheet written yet'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
            <SaveIndicator status={saveStatus} />
            <button
              className="btn btn-outline"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Done' : 'Edit sheet'}
            </button>
          </div>
        </div>

        {editing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <Field label="Class / Concept">
              <input value={character.class} onChange={(e) => update({ class: e.target.value })} placeholder="warlock" />
            </Field>
            <Field label="Level">
              <input
                type="number"
                min={1}
                value={character.level}
                onChange={(e) => update({ level: Number(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Ancestry">
              <input value={character.ancestry} onChange={(e) => update({ ancestry: e.target.value })} placeholder="half-elf" />
            </Field>
            <Field label="Pronouns">
              <input value={character.pronouns} onChange={(e) => update({ pronouns: e.target.value })} placeholder="they/them" />
            </Field>
            <Field label="Background">
              <input value={character.background} onChange={(e) => update({ background: e.target.value })} placeholder="pact of the archfey" />
            </Field>
            <Field label="Status">
              <select value={character.status} onChange={(e) => update({ status: e.target.value })}>
                {CHARACTER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="stat-grid">
          {ABILITIES.map((a) => (
            <div key={a.key} className="stat">
              <div className="stat-label">{a.label}</div>
              {editing ? (
                <input
                  type="number"
                  className="stat-value"
                  aria-label={a.label}
                  value={character.abilities?.[a.key] ?? 10}
                  onChange={(e) => setAbility(a.key, Number(e.target.value) || 0)}
                />
              ) : (
                <div className="stat-value">{character.abilities?.[a.key] ?? 10}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Open threads — the thread entities of this campaign */}
      <div className="dossier-section">
        <span className="dossier-label">Open threads</span>
        {threads.length === 0 ? (
          <p className="hint">
            nothing hanging yet — make an entity of kind “thread” for the questions you are chasing.
          </p>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              className="marginal"
              onClick={() => onOpenEntity?.(t.id)}
              style={{ cursor: onOpenEntity ? 'pointer' : 'default' }}
            >
              <div className="marginal-title">{t.name}</div>
              {excerptFrom(t.notes, 140) && (
                <div className="marginal-note">{excerptFrom(t.notes, 140)}</div>
              )}
            </div>
          ))
        )}
      </div>

      <Section title="Personality" hint="voice, tics, quirks, how they show up in the world">
        <Prose value={character.personality} onChange={(html) => update({ personality: html })} placeholder="Who is this person, when they're being themselves?" />
      </Section>

      <Section title="Backstory" hint="where they came from, what shaped them">
        <Prose value={character.backstory} onChange={(html) => update({ backstory: html })} placeholder="Their history, before the campaign began…" />
      </Section>

      <Section title="Goals" hint="what they're chasing, what's pulling at them">
        <Prose value={character.goals} onChange={(html) => update({ goals: html })} placeholder="What does this character want? What are they running from?" />
      </Section>

      <Section title="What my character knows" hint="in-character knowledge — what they've learned, witnessed, deduced">
        <Prose value={character.knowledge} onChange={(html) => update({ knowledge: html })} placeholder="What does this character know about the world, the plot, the people around them?" />
      </Section>

      <Section title="What I know (OOC)" hint="player knowledge the character hasn't earned yet — useful for not metagaming by accident">
        <Prose value={character.knowledgeOOC} onChange={(html) => update({ knowledgeOOC: html })} placeholder="Things you know but your character doesn't (yet)…" />
      </Section>

      <Section title="Items of meaning" hint="things that matter narratively — not full inventory">
        <Prose value={character.items} onChange={(html) => update({ items: html })} placeholder="The locket, the broken sword, the letter she never sent…" />
      </Section>

      <Section title="Vibes" hint="songs, aesthetic, mood, image prompts">
        <Prose value={character.vibes} onChange={(html) => update({ vibes: html })} placeholder="Playlists, colour palettes, art references, mood notes…" />
      </Section>

      <Section title="Relationships" hint="how this character is connected to others">
        {(character.relationships || []).length === 0 ? (
          <p className="hint">no relationships tracked yet</p>
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
          <button className="btn-dashed" onClick={addRelationship}>+ add relationship</button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <div className="dossier-section">
      <span className="dossier-label">{title}</span>
      {hint && <p className="dossier-hint">{hint}</p>}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  )
}

function Prose({ value, onChange, placeholder }) {
  return (
    <div className="dossier-surface">
      <RichTextEditor content={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

function RelationshipCard({ relationship, onUpdate, onRemove }) {
  const statusInfo =
    RELATIONSHIP_STATUSES.find((s) => s.value === relationship.status) || RELATIONSHIP_STATUSES[2]

  return (
    <div
      className="dossier-surface"
      style={{ borderLeft: `2px solid ${statusInfo.color}`, display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input-ghost"
          style={{ flex: '1 1 160px', fontSize: '17px' }}
          value={relationship.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Name"
        />
        <select
          value={relationship.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
          style={{ fontSize: '14px', padding: '5px 8px' }}
        >
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={relationship.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          style={{ fontSize: '14px', padding: '5px 8px', color: statusInfo.color }}
        >
          {RELATIONSHIP_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button className="btn-icon" onClick={onRemove} title="Remove relationship">×</button>
      </div>
      <textarea
        value={relationship.notes}
        onChange={(e) => onUpdate({ notes: e.target.value })}
        placeholder="What's the dynamic? What's unsaid? What's evolving?"
        rows={2}
        style={{ width: '100%', resize: 'vertical', fontSize: '15px' }}
      />
    </div>
  )
}

function SaveIndicator({ status }) {
  const display = {
    saved: { text: 'saved', color: 'var(--m-text-4)' },
    saving: { text: 'saving…', color: 'var(--m-accent)' },
    unsaved: { text: 'unsaved', color: 'var(--m-danger)' },
  }[status]

  return <span className="save-indicator" style={{ color: display.color }}>{display.text}</span>
}
