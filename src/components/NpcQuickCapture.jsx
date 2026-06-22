import { useState, useRef } from 'react'
import { createEntity, entityTypeInfo } from '../lib/entities'

/**
 * NpcQuickCapture — a rapid-fire roster input for jotting down NPCs
 * mid-session without breaking the flow of writing prose.
 *
 * Type a name, optionally followed by a separator and a one-line descriptor:
 *
 *   Gnarl — grumpy bartender, knows the cult
 *   Sera: captain of the guard
 *   Vex
 *
 * Each Enter creates a real NPC entity instantly (name + notes). Pasting a
 * multi-line block commits every line at once. Just-added NPCs appear as
 * clickable chips so you can jump to their detail page later.
 *
 * Separators (first match wins): em/en dash, colon, or " - " (spaced hyphen).
 * A spaced hyphen is required so hyphenated names like "Jean-Luc" stay intact.
 */
export default function NpcQuickCapture({
  userId,
  campaignId,
  entities,
  onEntityCreated,
  onOpenEntity,
}) {
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [recent, setRecent] = useState([]) // [{ id, name, existing }]
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  const commit = async (raw) => {
    // Split on newlines so a pasted block of names commits all at once.
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return

    setBusy(true)
    setError(null)
    const added = []
    try {
      for (const line of lines) {
        const { name, notes } = parseLine(line)
        if (!name) continue

        // Skip duplicates (case-insensitive name match against any entity).
        const existing = (entities || []).find(
          (e) => e.name.toLowerCase() === name.toLowerCase()
        )
        if (existing) {
          added.push({ id: existing.id, name: existing.name, existing: true })
          continue
        }

        const id = await createEntity(userId, campaignId, {
          name,
          type: 'npc',
          notes,
        })
        added.push({ id, name, existing: false })
      }
      if (added.length > 0) {
        setRecent((prev) => [...added, ...prev])
        onEntityCreated?.()
      }
      setInput('')
    } catch (err) {
      console.error('Failed to quick-add NPC:', err)
      setError('Could not save — try again.')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(input)
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    // A paste containing newlines should commit the complete lines immediately,
    // leaving any trailing unfinished fragment in the input.
    if (val.includes('\n')) {
      const lastBreak = val.lastIndexOf('\n')
      const toCommit = val.slice(0, lastBreak)
      const remainder = val.slice(lastBreak + 1)
      setInput(remainder)
      commit(toCommit)
      return
    }
    setInput(val)
  }

  const npcColor = entityTypeInfo('npc').color

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-elevated)',
        padding: 'var(--space-sm) var(--space-md)',
        marginBottom: 'var(--space-lg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-ui)',
            padding: 0,
          }}
          title={collapsed ? 'Expand roster' : 'Collapse roster'}
        >
          <span style={{ fontSize: '0.7rem' }}>{collapsed ? '▸' : '▾'}</span>
          Roster — quick-add NPCs
        </button>
        {recent.length > 0 && (
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--ink-faint)',
              fontFamily: 'var(--font-ui)',
              fontStyle: 'italic',
            }}
          >
            {recent.length} this session
          </span>
        )}
      </div>

      {!collapsed && (
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="Name — descriptor  ·  enter to add"
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
          />

          {error && (
            <p
              style={{
                color: 'var(--danger)',
                fontSize: '0.78rem',
                fontStyle: 'italic',
                marginTop: 'var(--space-xs)',
              }}
            >
              {error}
            </p>
          )}

          {/* Recently added chips */}
          {recent.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-xs)',
                marginTop: 'var(--space-sm)',
              }}
            >
              {recent.map((npc, i) => (
                <button
                  key={`${npc.id}-${i}`}
                  onClick={() => onOpenEntity?.(npc.id)}
                  title={
                    npc.existing
                      ? 'Already in this campaign — open'
                      : 'Open NPC'
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--ink-muted)',
                    opacity: npc.existing ? 0.65 : 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--accent)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--border-subtle)')
                  }
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: npcColor,
                      flexShrink: 0,
                    }}
                  />
                  {npc.name}
                  {npc.existing && (
                    <span style={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                      existing
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Parse "Name — descriptor" into { name, notes }.
 * Separators, in priority order: em dash, en dash, colon, spaced hyphen.
 */
export function parseLine(line) {
  const text = line.trim()
  const separators = ['—', '–', ':', ' - ']
  for (const sep of separators) {
    const idx = text.indexOf(sep)
    if (idx > 0) {
      return {
        name: text.slice(0, idx).trim(),
        notes: text.slice(idx + sep.length).trim(),
      }
    }
  }
  return { name: text, notes: '' }
}
