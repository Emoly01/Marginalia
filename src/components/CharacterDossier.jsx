import { useState, useEffect, useRef } from 'react'
import {
  getCharacter,
  saveCharacter,
  emptyCharacter,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_STATUSES,
  CHARACTER_STATUSES,
} from '../lib/character'
import { useDebounce } from '../lib/useDebounce'
import RichTextEditor from './RichTextEditor'

export default function CharacterDossier({ userId, campaignId, campaignCharacterName }) {
  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved')
  const isDirty = useRef(false)

  // Load character on mount / campaign change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    isDirty.current = false
    getCharacter(userId, campaignId)
      .then((data) => {
        if (cancelled) return
        if (data) {
          setCharacter({ ...emptyCharacter(), ...data })
        } else {
          // No character yet — initialize with the name from campaign info
          setCharacter({ ...emptyCharacter(), name: campaignCharacterName || '' })
        }
        setLoading(false)
        setSaveStatus('saved')
      })
      .catch((err) => {
        console.error('Failed to load character:', err)
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
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCharacter])

  const update = (patch) => {
    isDirty.current = true
    setSaveStatus('unsaved')
    setCharacter((c) => ({ ...c, ...patch }))
  }

  // Relationship operations
  const addRelationship = () => {
    const newRel = {
      id: crypto.randomUUID(),
      name: '',
      type: 'friend',
      status: 'neutral',
      notes: '',
    }
    update({ relationships: [...(character.relationships || []), newRel] })
  }

  const updateRelationship = (id, patch) => {
    update({
      relationships: character.relationships.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    })
  }

  const removeRelationship = (id) => {
    if (!confirm('Remove this relationship?')) return
    update({
      relationships: character.relationships.filter((r) => r.id !== id),
    })
  }

  if (loading || !character) {
    return (
      <div style={{ color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', marginTop: '15vh' }}>
        loading dossier…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'var(--space-xl)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: 'var(--accent)',
        }}>
          character dossier
        </h2>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Identity section */}
      <Section title="Identity">
        <input
          type="text"
          value={character.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Character name"
          style={{
            width: '100%',
            fontSize: '1.5rem',
            fontWeight: 'normal',
            fontStyle: 'italic',
            color: 'var(--accent)',
            background: 'transparent',
            border: '1px solid transparent',
            padding: 'var(--space-sm)',
            marginBottom: 'var(--space-sm)',
            fontFamily: 'var(--font-body)',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--border)'}
          onBlur={(e) => e.target.style.borderColor = 'transparent'}
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
        }}>
          <Field label="Class / Concept">
            <input
              type="text"
              value={character.class}
              onChange={(e) => update({ class: e.target.value })}
              placeholder="warlock, sorcerer, etc."
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Ancestry">
            <input
              type="text"
              value={character.ancestry}
              onChange={(e) => update({ ancestry: e.target.value })}
              placeholder="human, tiefling, etc."
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Level">
            <input
              type="number"
              value={character.level}
              onChange={(e) => update({ level: Number(e.target.value) || 1 })}
              min={1}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Pronouns">
            <input
              type="text"
              value={character.pronouns}
              onChange={(e) => update({ pronouns: e.target.value })}
              placeholder="she/her, they/them, etc."
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Background">
            <input
              type="text"
              value={character.background}
              onChange={(e) => update({ background: e.target.value })}
              placeholder="acolyte, criminal, etc."
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Status">
            <select
              value={character.status}
              onChange={(e) => update({ status: e.target.value })}
              style={{ width: '100%' }}
            >
              {CHARACTER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* Personality */}
      <Section title="Personality" hint="voice, tics, quirks, how they show up in the world">
        <RichTextWrapper
          content={character.personality}
          onChange={(html) => update({ personality: html })}
          placeholder="Who is this person, when they're being themselves?"
        />
      </Section>

      {/* Backstory */}
      <Section title="Backstory" hint="where they came from, what shaped them">
        <RichTextWrapper
          content={character.backstory}
          onChange={(html) => update({ backstory: html })}
          placeholder="Their history, before the campaign began…"
        />
      </Section>

      {/* Goals & Threads */}
      <Section title="Goals & Threads" hint="what they're chasing, what's pulling at them">
        <RichTextWrapper
          content={character.goals}
          onChange={(html) => update({ goals: html })}
          placeholder="What does this character want? What are they running from?"
        />
      </Section>

      {/* Knowledge — IC */}
      <Section title="What My Character Knows" hint="in-character knowledge — what they've learned, witnessed, deduced">
        <RichTextWrapper
          content={character.knowledge}
          onChange={(html) => update({ knowledge: html })}
          placeholder="What does this character know about the world, the plot, the people around them?"
        />
      </Section>

      {/* Knowledge — OOC */}
      <Section title="What I Know (OOC)" hint="player-knowledge that the character hasn't earned yet — useful for not metagaming by accident">
        <RichTextWrapper
          content={character.knowledgeOOC}
          onChange={(html) => update({ knowledgeOOC: html })}
          placeholder="Things you know but your character doesn't (yet)…"
        />
      </Section>

      {/* Items of Meaning */}
      <Section title="Items of Meaning" hint="things that matter narratively — not full inventory">
        <RichTextWrapper
          content={character.items}
          onChange={(html) => update({ items: html })}
          placeholder="The locket, the broken sword, the letter she never sent…"
        />
      </Section>

      {/* Vibes */}
      <Section title="Vibes" hint="songs, aesthetic, mood, image prompts">
        <RichTextWrapper
          content={character.vibes}
          onChange={(html) => update({ vibes: html })}
          placeholder="Playlists, color palettes, art references, mood notes…"
        />
      </Section>

      {/* Relationships */}
      <Section title="Relationships" hint="how this character is connected to others">
        {(character.relationships || []).length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic', marginBottom: 'var(--space-md)' }}>
            no relationships tracked yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            {character.relationships.map((rel) => (
              <RelationshipCard
                key={rel.id}
                relationship={rel}
                onUpdate={(patch) => updateRelationship(rel.id, patch)}
                onRemove={() => removeRelationship(rel.id)}
              />
            ))}
          </div>
        )}
        <button
          onClick={addRelationship}
          style={{
            background: 'var(--bg-input)',
            color: 'var(--ink-muted)',
            padding: 'var(--space-sm) var(--space-md)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.9rem',
          }}
        >
          + Add Relationship
        </button>
      </Section>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <div style={{
      marginBottom: 'var(--space-xl)',
      paddingBottom: 'var(--space-lg)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <h3 style={{
        fontSize: '0.85rem',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--ink-faint)',
        fontFamily: 'var(--font-ui)',
        fontWeight: 600,
        marginBottom: hint ? 'var(--space-xs)' : 'var(--space-md)',
      }}>
        {title}
      </h3>
      {hint && (
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
          marginBottom: 'var(--space-md)',
        }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--ink-faint)',
        fontFamily: 'var(--font-ui)',
        marginBottom: 'var(--space-xs)',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function RichTextWrapper({ content, onChange, placeholder }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius)',
      padding: 'var(--space-md)',
      minHeight: '120px',
    }}>
      <RichTextEditor
        content={content}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  )
}

function RelationshipCard({ relationship, onUpdate, onRemove }) {
  const statusInfo = RELATIONSHIP_STATUSES.find((s) => s.value === relationship.status) || RELATIONSHIP_STATUSES[2]

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderLeft: `4px solid ${statusInfo.color}`,
      borderRadius: 'var(--radius)',
      padding: 'var(--space-md)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr auto',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-sm)',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={relationship.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Name"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--ink)',
            fontSize: '1rem',
            padding: '4px 8px',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--border)'}
          onBlur={(e) => e.target.style.borderColor = 'transparent'}
        />
        <select
          value={relationship.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
          style={{
            background: 'transparent',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.85rem',
            padding: '4px 8px',
          }}
        >
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={relationship.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          style={{
            background: 'transparent',
            color: statusInfo.color,
            fontFamily: 'var(--font-ui)',
            fontSize: '0.85rem',
            padding: '4px 8px',
          }}
        >
          {RELATIONSHIP_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          title="Remove relationship"
          style={{
            color: 'var(--ink-faint)',
            fontSize: '1rem',
            padding: '4px 8px',
            fontFamily: 'var(--font-ui)',
          }}
        >
          ×
        </button>
      </div>
      <textarea
        value={relationship.notes}
        onChange={(e) => onUpdate({ notes: e.target.value })}
        placeholder="What's the dynamic? What's unsaid? What's evolving?"
        rows={2}
        style={{
          width: '100%',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.95rem',
          padding: 'var(--space-sm)',
          resize: 'vertical',
        }}
      />
    </div>
  )
}

function SaveIndicator({ status }) {
  const display = {
    saved: { text: 'saved ✓', color: 'var(--ink-faint)' },
    saving: { text: 'saving…', color: 'var(--accent)' },
    unsaved: { text: 'unsaved', color: 'var(--danger)' },
  }[status]

  return (
    <span style={{
      fontSize: '0.8rem',
      color: display.color,
      fontFamily: 'var(--font-ui)',
      fontStyle: 'italic',
      transition: 'color 0.2s',
    }}>
      {display.text}
    </span>
  )
}
