import { useState, useEffect, useRef, useMemo } from 'react'
import { updateSession, deleteSession } from '../lib/sessions'
import { createEntity } from '../lib/entities'
import { useDebounce } from '../lib/useDebounce'
import { buildMentionSuggestion } from '../lib/mentionSuggestion'
import { toast } from '../lib/toast'
import { sessionStatus } from '../lib/sessionStatus'
import { useSessionLog } from '../lib/useSessionLog'
import { updateLogEntry } from '../lib/log'
import { appendHtml, recapFragment } from '../lib/inking'
import { stripAt } from '../lib/mentionText'
import { sessionDuration, formatDuration, toDate } from '../lib/sessionStatus'
import { stripHtml } from '../lib/text'
import RichTextEditor from './RichTextEditor'
import { IlluminatedTitle, Mark } from './ornament'
import MentionText from './MentionText'

export default function SessionEditor({
  userId,
  campaign,
  campaignId,
  session,
  entities,
  onEntityCreated,
  onOpenEntity,
  onBack,
  onDeleted,
  onUpdated,
  onInk,
}) {
  const [title, setTitle] = useState(session.title)
  const [date, setDate] = useState(session.date)
  const [sessionNumber, setSessionNumber] = useState(session.sessionNumber)
  const [content, setContent] = useState(session.content || '')
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved'
  const [savedAt, setSavedAt] = useState(null)
  const [editingTitle, setEditingTitle] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSavedAt(new Date())
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

  // Unsaved edits are written first. The write is queued before we leave,
  // and Inking reads the session back through the same local cache.
  const handleInk = () => {
    if (saveStatus !== 'saved') persist({ title, date, sessionNumber, content })
    onInk?.()
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

  // The session's own log, down the margin: "Weave in" pulls a line into
  // the page (the same as Inking's "Add to recap") and marks it inked.
  const { entries } = useSessionLog(userId, campaignId, session.id, { entities })
  const typed = entries.filter((e) => !e.auto && e.mark !== 'auto')
  const remaining = typed.filter((e) => !e.inked).length
  const weave = (entry) => {
    setContent((c) => appendHtml(c, recapFragment(entry.text, { action: 'recap', mark: entry.mark, entities })))
    updateLogEntry(userId, campaignId, entry.id, { inked: true, inkedAs: { action: 'recap', via: 'weave', entityId: null } }).catch((err) => {
      console.error('Could not mark the line woven:', err)
      toast('Could not mark that line as woven in.')
    })
  }

  const words = stripHtml(content).split(/\s+/).filter(Boolean).length
  const duration = formatDuration(sessionDuration(session))
  const people = useMemo(() => {
    const ids = new Set()
    const re = /data-id="([^"]+)"/g
    let m
    while ((m = re.exec(content)) !== null) ids.add(m[1])
    return entities.filter((e) => ids.has(e.id) && (e.type === 'npc' || e.type === 'pc')).map((e) => e.name).slice(0, 4)
  }, [content, entities])
  const status = sessionStatus(session)
  const dateLabel = (() => {
    const d = toDate(date ? `${date}T12:00:00` : null)
    return d ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  })()
  const savedLabel = { saved: savedAt ? `saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'saved', saving: 'saving…', unsaved: 'unsaved' }[saveStatus]

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={handleBack}>‹ {campaign?.shortName || campaign?.name || 'Back'}</button>
        <span className="rubric rubric--quiet">Sessions · {sessionNumber}</span>
        <span className="toolbar-spacer" />
        <span className={`save-state${saveStatus === 'unsaved' ? ' save-state--unsaved' : ''}`} aria-live="polite">
          {words} {words === 1 ? 'word' : 'words'} · {savedLabel}
        </span>
        {status !== 'live' && (
          remaining > 0 || status === 'ended' ? (
            <button className="btn-quiet" onClick={handleInk}>Ink the log{remaining ? ` · ${remaining} left` : ''}</button>
          ) : typed.length > 0 ? (
            <span className="meta">Inked</span>
          ) : null
        )}
        <button className="btn-danger" onClick={handleDelete}>Delete</button>
        <button className="btn-primary" onClick={handleBack}>Done</button>
      </div>

      <div className="editor">
        <div className="editor-page">
          <article className="editor-sheet">
            {editingTitle ? (
              <input
                className="input-ghost editor-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                placeholder="Session title…"
                aria-label="Session title"
                autoFocus
              />
            ) : (
              <button className="editor-title" onClick={() => setEditingTitle(true)} aria-label={`Session title: ${title || 'untitled'} — tap to edit`}>
                <IlluminatedTitle text={title || 'Untitled'} as="span" size={128} variant="grand" className="illuminated--wrap editor-title-text" />
              </button>
            )}
            <div className="editor-meta">
              <label className="editor-meta-num">
                <span className="rubric">Session</span>
                <input type="number" inputMode="numeric" className="input-ghost" aria-label="Session number" value={sessionNumber} onChange={(e) => setSessionNumber(e.target.value)} />
              </label>
              <label className="editor-meta-date">
                <span className="sr-only">Date</span>
                <input type="date" className="input-ghost" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Session date" />
              </label>
              {dateLabel && <span>{dateLabel}</span>}
              {duration && <span>{duration} at the table</span>}
              {people.length > 0 && <span>{people.join(', ')}</span>}
            </div>
            <hr className="rule rule--double" />
            {sessionStatus(session) === 'ended' && onInk && (
              <div className="wash-box ink-banner">
                <span>This session hasn’t been inked yet — its log and your margins are waiting.</span>
                <button className="btn-primary" onClick={handleInk}>Ink it</button>
              </div>
            )}
            <div className="prose-illuminated">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="What happened this session? Type @ to name someone from the codex."
                mentionSuggestion={mentionSuggestion}
                onMentionClick={onOpenEntity}
                tall
              />
            </div>
            <p className="field-hint">@ names someone from the codex · “Weave in” pulls a margin note into the page</p>
          </article>
        </div>

        <aside className="panel panel-col editor-margin" aria-labelledby="margin-head">
          <div className="panel-head">
            <h2 className="rubric" id="margin-head">In the margin</h2>
            <span className="meta">{typed.length ? (remaining ? `${remaining} not yet woven in` : 'all woven in') : 'no log for this session'}</span>
          </div>
          <div className="panel-body">
            {entries.length === 0 ? (
              <p className="hint home-pad">Lines you log at the table land here, ready to weave into the page.</p>
            ) : (
              <ol className="margin-log">
                {entries.map((e) => (
                  <MarginLine key={e.id} entry={e} entities={entities} onWeave={() => weave(e)} onOpenEntity={onOpenEntity} />
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

function MarginLine({ entry: e, entities, onWeave, onOpenEntity }) {
  const auto = e.auto || e.mark === 'auto'
  const time = toDate(e.clientAt)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? ''
  const woven = e.inked && e.inkedAs?.action === 'recap'
  return (
    <li className="log-line">
      <span className="log-time">{time}</span>
      <span className={`log-mark log-mark--${auto ? 'auto' : e.mark}`}><Mark type={auto ? 'auto' : e.mark} size={20} /></span>
      <span className={`log-text${auto ? ' log-text--auto' : ''}${e.inked ? ' log-text--done' : ''}`}>
        <span>{auto ? e.text : <MentionText text={e.text} entities={entities} onOpenEntity={onOpenEntity} />}</span>
        {!auto && !e.inked && (
          <button className="btn-gilt btn--sm margin-weave" onClick={onWeave} aria-label={`Weave in: ${stripAt(e.text)}`}>
            Weave in ↵
          </button>
        )}
        {woven && <span className="margin-woven">✓ woven into the page</span>}
        {e.inked && !woven && <span className="margin-woven">✓ inked</span>}
      </span>
    </li>
  )
}
