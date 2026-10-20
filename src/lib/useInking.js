// useInking — the post-session triage for one session. Loads the session's
// log and the campaign's margins once, then each action writes straight
// away (recap, entity, log entry, margin), so closing the tab halfway loses
// nothing: what's done is done, and the rest is still queued next time.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { listSessionLog, updateLogEntry } from './log'
import { listAllMargins, archiveMargin } from './margins'
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
   */
  const act = useCallback(
    (item, { action, text = item.text, create, entity }) => {
      let target = null
      if (action === 'recap') {
        appendToRecap(recapFragment(text, { action, mark: item.mark }))
      } else if (action === 'entity') {
        const { ref, data } = newEntity(userId, campaignId, {
          name: create.name,
          type: create.type,
          notes: entityNotesFragment(text, session),
        })
        setDoc(ref, data).catch(fail('the new entity'))
        target = { id: ref.id, name: data.name }
        onEntitiesChanged?.()
        appendToRecap(recapFragment(text, { action, mark: item.mark, entity: target }))
      } else if (action === 'link') {
        target = entity
        const notes = appendHtml(notesRef.current[entity.id] ?? entity.notes ?? '', entityNotesFragment(text, session))
        notesRef.current[entity.id] = notes
        updateEntity(userId, campaignId, entity.id, { notes }).catch(fail('the entity notes'))
        onEntitiesChanged?.()
        appendToRecap(recapFragment(text, { action, mark: item.mark, entity }))
      }

      if (item.kind === 'log') {
        updateLogEntry(userId, campaignId, item.id, {
          inked: true,
          inkedAs: { action, entityId: target?.id ?? null },
        }).catch(fail('the log entry'))
      } else if (action !== 'later') {
        // A margin that was used — or tossed — leaves the inbox.
        archiveMargin(userId, campaignId, item.id).catch(fail('the margin'))
      }
      setHandled((h) => new Set(h).add(item.key))
    },
    [userId, campaignId, session, appendToRecap, onEntitiesChanged]
  )

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
    content: content ?? '',
    entities,
    act,
    finish,
  }
}
