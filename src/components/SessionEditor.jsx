import { useState, useEffect, useRef, useMemo } from 'react'
import { updateSession, deleteSession } from '../lib/sessions'
import { createEntity } from '../lib/entities'
import { useDebounce } from '../lib/useDebounce'
import { buildMentionSuggestion } from '../lib/mentionSuggestion'
import { toast } from '../lib/toast'
import RichTextEditor from './RichTextEditor'
import NpcQuickCapture from './NpcQuickCapture'

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
            toast('Could not create that entity.')
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

  // Single save path shared by autosave and Cmd+S
  const persist = async (values) => {
    setSaveStatus('saving')
    try {
      await updateSession(userId, campaignId, session.id, {
        title: values.title,
        date: values.date,
        sessionNumber: Number(values.sessionNumber) || 1,
        content: values.content,
      })
      setSaveStatus('saved')
      onUpdated?.()
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('unsaved')
      toast('Autosave failed — your latest changes are not saved yet.')
    }
  }

  // Autosave when debounced values change
  useEffect(() => {
    if (!isDirty.current) return
    persist({
      title: debouncedTitle,
      date: debouncedDate,
      sessionNumber: debouncedSessionNumber,
      content: debouncedContent,
    })
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
      await persist({ title, date, sessionNumber, content })
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
      toast('Could not delete session.')
    }
  }

  return (
    <div className="view">
      <header className="view-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '13px', color: 'var(--m-text-4)' }}>#</span>
          <input
            type="number"
            className="input-ghost"
            aria-label="Session number"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(e.target.value)}
            style={{ width: '64px', fontVariantNumeric: 'tabular-nums' }}
          />
          <input
            type="date"
            className="input-ghost"
            aria-label="Session date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 'auto', color: 'var(--m-text-3)', fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
          <SaveIndicator status={saveStatus} />
          <button className="btn" onClick={handleBack}>← back</button>
          <button className="btn-danger" onClick={handleDelete}>delete</button>
        </div>
      </header>

      <div className="view-body">
        <div className="column column--narrow" style={{ gap: '18px' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title…"
            aria-label="Session title"
            style={{
              width: '100%',
              fontSize: '32px',
              fontStyle: 'italic',
              color: 'var(--m-accent)',
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: '4px 0',
              lineHeight: 1.15,
            }}
          />

          {/* Quick-add NPC roster — capture names fast without breaking flow */}
          <NpcQuickCapture
            userId={userId}
            campaignId={campaignId}
            entities={entities}
            onEntityCreated={onEntityCreated}
            onOpenEntity={onOpenEntity}
          />

          {/* Body — Tiptap rich text editor */}
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="What happened this session? Type @ to mention an NPC, place, or thread."
            mentionSuggestion={mentionSuggestion}
            onMentionClick={onOpenEntity}
            tall
          />
        </div>
      </div>
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
