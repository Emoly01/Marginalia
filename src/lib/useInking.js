// useInking — the post-session triage for one session. Loads the session's
// log and the campaign's margins once, then each action writes straight
// away (recap, entity, log entry, margin), so closing the tab halfway loses
// nothing: what's done is done, and the rest is still queued next time.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { listSessionLog, updateLogEntry } from './log'
import { listAllMargins, archiveMargin, restoreMargin, deleteMargin, addMargin } from './margins'
import { newEntity, updateEntity } from './entities'
import { getSession, updateSession } from './sessions'
import {
  buildQueue,
  autoTimeline,
  appendHtml,
  recapFragment,
  entityNotesFragment,
  recallFragment,
} from './inking'
import { toast } from './toast'

const fail = (what) => (err) => {
  console.error(`${what} failed:`, err)
  toast(`Could not save ${what}.`)
}

export function useInking(userId, campaignId, session, { entities = [], onEntitiesChanged } = {}) {
  const [entries, setEntries] = useState(null)
  const [margins, setMargins] = useState(null)
  const [content, setContent] = useState(null)
  const [handled, setHandled] = useState(() => new Set())
  // What each handled item became, for the timeline ("Added to recap"), and
  // the undo stack for "Back one entry": exactly what each action wrote.
  const [results, setResults] = useState({})
  const historyRef = useRef([])
  const [loadError, setLoadError] = useState(null)
  const contentRef = useRef('')
  // Notes written during this triage, so two links to one entity both land.
  const notesRef = useRef({})

  useEffect(() => {
    let cancelled = false
    // The recap is read fresh rather than taken from the caller: the editor
    // may have autosaved since that copy was loaded, and appending to a
    // stale copy would overwrite those edits.
    Promise.all([
      getSession(userId, campaignId, session.id),
      listSessionLog(userId, campaignId, session.id),
      listAllMargins(userId, campaignId),
    ])
      .then(([fresh, log, m]) => {
        if (cancelled) return
        contentRef.current = fresh?.content || ''
        setContent(contentRef.current)
        setEntries(log)
        setMargins(m)
      })
      .catch((err) => {
        console.error('Inking load failed:', err)
        if (!cancelled) setLoadError(err.message || 'Could not load this session.')
      })
    return () => { cancelled = true }
  }, [userId, campaignId, session.id])

  const ready = entries !== null && margins !== null && content !== null
  const queue = useMemo(() => (entries && margins ? buildQueue(entries, margins) : null), [entries, margins])
  const timeline = useMemo(() => autoTimeline(entries ?? []), [entries])
  const remaining = useMemo(() => (queue ?? []).filter((q) => !handled.has(q.key)), [queue, handled])

  const appendToRecap = useCallback(
    (fragment) => {
      contentRef.current = appendHtml(contentRef.current, fragment)
      setContent(contentRef.current)
      // updateSession re-derives mentionIds from the new content.
      updateSession(userId, campaignId, session.id, { content: contentRef.current }).catch(fail('the recap'))
    },
    [userId, campaignId, session.id]
  )

  /**
   * Handle one queue item.
   *   action: 'recap' | 'entity' | 'link' | 'toss' | 'later'
   *   text: the line as (possibly) edited before acting
   *   create: { type, name } for 'entity'; entity: { id, name, notes } for 'link'
   * Every write is recorded so back() can undo it.
   */
  const act = useCallback(
    (item, { action, text = item.text, create, entity }) => {
      const undo = { item, contentBefore: contentRef.current, entityCreated: null, notesBefore: null, marginCreated: null }
      let target = null
      if (action === 'recap') {
        appendToRecap(recapFragment(text, { action, mark: item.mark, entities }))
      } else if (action === 'entity') {
        const { ref, data } = newEntity(userId, campaignId, {
          name: create.name,
          type: create.type,
          notes: entityNotesFragment(text, session, entities),
        })
        setDoc(ref, data).catch(fail('the new entity'))
        target = { id: ref.id, name: data.name, type: data.type }
        undo.entityCreated = { ref, ...target }
        onEntitiesChanged?.()
        appendToRecap(recapFragment(text, { action, mark: item.mark, entity: target, entities }))
      } else if (action === 'link') {
        target = entity
        const before = notesRef.current[entity.id] ?? entity.notes ?? ''
        const notes = appendHtml(before, entityNotesFragment(text, session, entities))
        notesRef.current[entity.id] = notes
        undo.notesBefore = { id: entity.id, notes: before }
        updateEntity(userId, campaignId, entity.id, { notes }).catch(fail('the entity notes'))
        onEntitiesChanged?.()
        appendToRecap(recapFragment(text, { action, mark: item.mark, entity, entities }))
      }

      if (item.kind === 'log') {
        const inkedAs = { action, entityId: target?.id ?? null }
        if (action === 'later') {
          // A log line kept for later waits in the Margins inbox.
          const { id, done } = addMargin(userId, campaignId, text, { fromLog: item.id })
          done.catch(fail('the margin'))
          undo.marginCreated = id
          inkedAs.marginId = id
        }
        updateLogEntry(userId, campaignId, item.id, { inked: true, inkedAs }).catch(fail('the log entry'))
      } else if (action !== 'later') {
        // A margin that was used — or tossed — leaves the inbox.
        archiveMargin(userId, campaignId, item.id).catch(fail('the margin'))
      }
      historyRef.current.push({ ...undo, action, target })
      setResults((r) => ({ ...r, [item.key]: { action, target } }))
      setHandled((h) => new Set(h).add(item.key))
    },
    [userId, campaignId, session, entities, appendToRecap, onEntitiesChanged]
  )

  /** "Back one entry": undo the last action, write by write. */
  const back = useCallback(() => {
    const last = historyRef.current.pop()
    if (!last) return null
    const { item } = last
    if (contentRef.current !== last.contentBefore) {
      contentRef.current = last.contentBefore
      setContent(contentRef.current)
      updateSession(userId, campaignId, session.id, { content: contentRef.current }).catch(fail('the recap'))
    }
    if (last.entityCreated) {
      deleteDoc(last.entityCreated.ref).catch(fail('removing that entity'))
      onEntitiesChanged?.()
    }
    if (last.notesBefore) {
      notesRef.current[last.notesBefore.id] = last.notesBefore.notes
      updateEntity(userId, campaignId, last.notesBefore.id, { notes: last.notesBefore.notes }).catch(fail('the entity notes'))
      onEntitiesChanged?.()
    }
    if (last.marginCreated) deleteMargin(userId, campaignId, last.marginCreated).catch(fail('the margin'))
    if (item.kind === 'log') {
      updateLogEntry(userId, campaignId, item.id, { inked: false, inkedAs: null }).catch(fail('the log entry'))
    } else if (last.action !== 'later') {
      restoreMargin(userId, campaignId, item.id).catch(fail('the margin'))
    }
    setResults((r) => {
      const next = { ...r }
      delete next[item.key]
      return next
    })
    setHandled((h) => {
      const next = new Set(h)
      next.delete(item.key)
      return next
    })
    return item
  }, [userId, campaignId, session.id, onEntitiesChanged])

  /** Recall answers into the recap, and the session is inked. */
  const finish = useCallback(
    (prompts, answers) => {
      const fragment = recallFragment(prompts, answers)
      if (fragment) contentRef.current = appendHtml(contentRef.current, fragment)
      setContent(contentRef.current)
      return updateSession(userId, campaignId, session.id, {
        content: contentRef.current,
        status: 'inked',
        inkedAt: serverTimestamp(),
      }).catch(fail('the inked session'))
    },
    [userId, campaignId, session.id]
  )

  return {
    loading: !ready && !loadError,
    loadError,
    queue: queue ?? [],
    remaining,
    timeline,
    entries: entries ?? [],
    results,
    canGoBack: historyRef.current.length > 0,
    back,
    content: content ?? '',
    entities,
    act,
    finish,
  }
}
