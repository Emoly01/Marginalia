import { useState, useEffect, useRef, useMemo } from 'react'
import { updateSession, deleteSession } from '../lib/sessions'
import { createEntity } from '../lib/entities'
import { useDebounce } from '../lib/useDebounce'
import { buildMentionSuggestion } from '../lib/mentionSuggestion'
import RichTextEditor from './RichTextEditor'

export default function SessionEditor({
  userId,
  campaignId,
  session,
  entities,
  onEntityCreated,
  onOpenEntity,
  onBack,
  onDeleted,
  onUpdated,
}) {
  const [title, setTitle] = useState(session.title)
  const [date, setDate] = useState(session.date)
  const [sessionNumber, setSessionNumber] = useState(session.sessionNumber)
  const [content, setContent] = useState(session.content || '')
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved'

  const debouncedTitle = useDebounce(title, 800)
  const debouncedDate = useDebounce(date, 800)
  const debouncedSessionNumber = useDebounce(sessionNumber, 800)
  const debouncedContent = useDebounce(content, 800)

  // Track whether we've actually touched anything since loading
  const isDirty = useRef(false)

  // Keep a live ref to entities so the mention suggestion always sees current data
  const entitiesRef = useRef(entities)
  useEffect(() => {
    entitiesRef.current = entities
  }, [entities])

  // Build the @-mention suggestion config once
  const mentionSuggestion = useMemo(
    () =>
      buildMentionSuggestion({
        getEntities: () => entitiesRef.current,
        onCreateEntity: async (name) => {
          try {
            const id = await createEntity(userId, campaignId, { name, type: 'npc' })
            const created = { id, name, type: 'npc' }
            onEntityCreated?.()
            return created
          } catch (err) {
            console.error('Failed to create entity from mention:', err)
            return null
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, campaignId]
  )

  // Mark dirty on any change
  useEffect(() => {
    isDirty.current = true
    setSaveStatus('unsaved')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, date, sessionNumber, content])

  // Reset dirty flag when session changes (loaded fresh)
  useEffect(() => {
    isDirty.current = false
    setSaveStatus('saved')
    setTitle(session.title)
    setDate(session.date)
    setSessionNumber(session.sessionNumber)
    setContent(session.content || '')
  }, [session.id])

  // Autosave when debounced values change
  useEffect(() => {
    if (!isDirty.current) return

    const save = async () => {
      setSaveStatus('saving')
      try {
        await updateSession(userId, campaignId, session.id, {
          title: debouncedTitle,
          date: debouncedDate,
          sessionNumber: Number(debouncedSessionNumber) || 1,
          content: debouncedContent,
        })
        setSaveStatus('saved')
        onUpdated?.()
      } catch (err) {
        console.error('Save failed:', err)
        setSaveStatus('unsaved')
      }
    }
    save()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedDate, debouncedSessionNumber, debouncedContent])

  // Warn before leaving with unsaved changes (browser refresh/close)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus !== 'saved') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  // Cmd/Ctrl+S to force-save immediately
  useEffect(() => {
    const handleKeyDown = async (e) => {
      const isCmdS = (e.metaKey || e.ctrlKey) && e.key === 's'
      if (!isCmdS) return
      e.preventDefault()
      if (saveStatus === 'saved') {
        // Flash the indicator briefly to confirm
        setSaveStatus('saving')
        setTimeout(() => setSaveStatus('saved'), 300)
        return
      }
      setSaveStatus('saving')
      try {
        await updateSession(userId, campaignId, session.id, {
          title,
          date,
          sessionNumber: Number(sessionNumber) || 1,
          content,
        })
        setSaveStatus('saved')
        onUpdated?.()
      } catch (err) {
        console.error('Force-save failed:', err)
        setSaveStatus('unsaved')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, date, sessionNumber, content, saveStatus])

  const handleBack = () => {
    if (saveStatus !== 'saved') {
      if (!confirm('You have unsaved changes. Leave anyway?')) return
    }
    onBack()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await deleteSession(userId, campaignId, session.id)
      onDeleted?.()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
      }}>
        <button
          onClick={handleBack}
          style={{
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.85rem',
          }}
        >
          ← back
        </button>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
        }}>
          <SaveIndicator status={saveStatus} />
          <button
            onClick={handleDelete}
            style={{
              fontSize: '0.85rem',
              color: 'var(--danger)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            delete
          </button>
        </div>
      </div>

      {/* Metadata row */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-md)',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
        }}>
          <span style={metaLabelStyle}>#</span>
          <input
            type="number"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(e.target.value)}
            style={{
              width: '60px',
              background: 'transparent',
              border: '1px solid transparent',
              padding: '4px 8px',
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-ui)',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--border)'}
            onBlur={(e) => e.target.style.borderColor = 'transparent'}
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-ui)',
            padding: '4px 8px',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--border)'}
          onBlur={(e) => e.target.style.borderColor = 'transparent'}
        />
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Session title…"
        style={{
          width: '100%',
          fontSize: '2rem',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: 'var(--accent)',
          background: 'transparent',
          border: 'none',
          padding: 'var(--space-sm) 0',
          marginBottom: 'var(--space-md)',
          fontFamily: 'var(--font-body)',
        }}
      />

      {/* Body — Tiptap rich text editor */}
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="What happened this session? Type @ to mention an NPC, place, or thread."
        mentionSuggestion={mentionSuggestion}
        onMentionClick={onOpenEntity}
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

const metaLabelStyle = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ink-faint)',
  fontFamily: 'var(--font-ui)',
}
