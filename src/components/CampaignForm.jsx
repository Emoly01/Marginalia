import { useState } from 'react'
import { THEME_LIST } from '../lib/themes'

const COLORS = [
  '#c9a961', // gold
  '#8a9a7b', // sage
  '#9b8aa4', // dusty purple
  '#b88654', // sienna
  '#7a8fa4', // dusty blue
  '#a4787a', // dusty rose
  '#6b8a7a', // forest
]

export default function CampaignForm({ onSubmit, onCancel, initial = {} }) {
  const [name, setName] = useState(initial.name || '')
  const [shortName, setShortName] = useState(initial.shortName || '')
  const [system, setSystem] = useState(initial.system || 'D&D 5e')
  const [dmName, setDmName] = useState(initial.dmName || '')
  const [characterName, setCharacterName] = useState(initial.characterName || '')
  const [characterClass, setCharacterClass] = useState(initial.characterClass || '')
  const [color, setColor] = useState(initial.color || COLORS[0])
  const [status, setStatus] = useState(initial.status || 'active')
  const [theme, setTheme] = useState(initial.theme || 'parchment')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      shortName: shortName.trim() || name.trim(),
      system: system.trim(),
      dmName: dmName.trim(),
      characterName: characterName.trim(),
      characterClass: characterClass.trim(),
      color,
      status,
      theme,
    })
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg-elevated)',
          padding: 'var(--space-xl)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: 'var(--accent)',
          marginBottom: 'var(--space-lg)',
        }}>
          {initial.name ? 'Edit Campaign' : 'New Campaign'}
        </h2>

        <Field label="Campaign Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="League of Ambivalence"
            autoFocus
            style={{ width: '100%' }}
          />
        </Field>

        <Field label="Short Name" hint="for tight UI spaces (defaults to full name)">
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="League"
            style={{ width: '100%' }}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Field label="System">
            <input
              type="text"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="D&D 5e"
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="GM">
            <input
              type="text"
              value={dmName}
              onChange={(e) => setDmName(e.target.value)}
              placeholder="GM name"
              style={{ width: '100%' }}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Field label="Your Character">
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="character name"
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Class / Concept">
            <input
              type="text"
              value={characterClass}
              onChange={(e) => setCharacterClass(e.target.value)}
              placeholder="warlock, sorcerer, etc."
              style={{ width: '100%' }}
            />
          </Field>
        </div>

        <Field label="Color">
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '2px solid var(--ink)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Field>

        <Field label="Theme" hint="visual palette while inside this campaign">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--space-sm)',
          }}>
            {THEME_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                style={{
                  background: theme === t.id ? 'var(--bg-input)' : 'transparent',
                  border: theme === t.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  {t.swatch.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: c,
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  color: 'var(--ink)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}>
                  {t.name}
                </div>
                <div style={{
                  color: 'var(--ink-faint)',
                  fontSize: '0.75rem',
                  fontStyle: 'italic',
                  marginTop: '2px',
                }}>
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="active">active</option>
            <option value="hiatus">hiatus</option>
            <option value="completed">completed</option>
          </select>
        </Field>

        <div style={{
          display: 'flex',
          gap: 'var(--space-md)',
          justifyContent: 'flex-end',
          marginTop: 'var(--space-lg)',
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: 'var(--space-sm) var(--space-lg)',
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            cancel
          </button>
          <button
            type="submit"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              padding: 'var(--space-sm) var(--space-lg)',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
            }}
          >
            {initial.name ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 'var(--space-md)' }}>
      <label style={{
        display: 'block',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--ink-faint)',
        fontFamily: 'var(--font-ui)',
        marginBottom: 'var(--space-xs)',
      }}>
        {label} {required && <span style={{ color: 'var(--accent)' }}>*</span>}
      </label>
      {children}
      {hint && (
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
          marginTop: 'var(--space-xs)',
        }}>
          {hint}
        </div>
      )}
    </div>
  )
}
