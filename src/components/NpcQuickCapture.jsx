import { useState, useRef } from 'react'
import { createEntity } from '../lib/entities'

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

  return (
    <div
      style={{
        border: '1px solid var(--m-line)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--m-card)',
        padding: '10px 14px',
      }}
    >
      <div className="row-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand roster' : 'Collapse roster'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--m-text-4)',
            padding: 0,
          }}
        >
          <span>{collapsed ? '▸' : '▾'}</span>
          Roster — quick-add NPCs
        </button>
        {recent.length > 0 && (
          <span className="rail-count">{recent.length} this session</span>
        )}
      </div>

      {!collapsed && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={busy}
            aria-label="Quick-add NPC"
            placeholder="Name — descriptor  ·  enter to add"
            style={{ width: '100%', fontSize: '15px', padding: '7px 10px' }}
          />

          {error && (
            <p className="hint" style={{ color: 'var(--m-danger)' }}>{error}</p>
          )}

          {recent.length > 0 && (
            <div className="pill-row">
              {recent.map((npc, i) => (
                <button
                  key={`${npc.id}-${i}`}
                  className="pill"
                  onClick={() => onOpenEntity?.(npc.id)}
                  title={npc.existing ? 'Already in this campaign — open' : 'Open NPC'}
                  style={{ opacity: npc.existing ? 0.65 : 1, cursor: 'pointer', fontSize: '13px' }}
                >
                  {npc.name}
                  {npc.existing && <span style={{ fontStyle: 'italic' }}> · existing</span>}
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
