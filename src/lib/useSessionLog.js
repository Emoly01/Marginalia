// useSessionLog — one session's live log, and the capture that writes to it.
// Entries come through onSnapshot, so a line shows up the moment Enter is
// pressed, from the local cache, online or not. Writes are queued, never
// awaited.
import { useState, useEffect, useCallback } from 'react'
import { setDoc } from 'firebase/firestore'
import { subscribeSessionLog, addLogEntry, deleteLogEntry } from './log'
import { newEntity } from './entities'
import { parseCapture, findEntityByName } from './capture'
import { toast } from './toast'

const fail = (what) => (err) => {
  console.error(`${what} failed:`, err)
  toast(`Could not save ${what}.`)
}

export function useSessionLog(userId, campaignId, sessionId, { entities = [], onEntityCreated } = {}) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    setEntries([])
    if (!sessionId) return undefined
    return subscribeSessionLog(userId, campaignId, sessionId, setEntries, fail('the session log'))
  }, [userId, campaignId, sessionId])

  /**
   * Write a typed line. An NPC line also creates the NPC straight away
   * (or links the existing one of that name) and the entry points at it.
   * Returns the parsed capture, or null when there was nothing to write.
   */
  const capture = useCallback(
    (input, toggledMark) => {
      const parsed = parseCapture(input, toggledMark)
      if (!parsed || !sessionId) return null
      let entityId = null
      if (parsed.npc) {
        const existing = findEntityByName(entities, parsed.npc.name)
        if (existing) {
          entityId = existing.id
        } else {
          const { ref, data } = newEntity(userId, campaignId, { name: parsed.npc.name, type: 'npc', notes: parsed.npc.notes })
          setDoc(ref, data).catch(fail('the NPC'))
          entityId = ref.id
          onEntityCreated?.({ id: ref.id, ...data })
        }
      }
      addLogEntry(userId, campaignId, { sessionId, text: parsed.text, mark: parsed.mark, entityId }).done.catch(fail('the log line'))
      return parsed
    },
    [userId, campaignId, sessionId, entities, onEntityCreated]
  )

  const remove = useCallback(
    (entryId) => deleteLogEntry(userId, campaignId, entryId).catch(fail('that change')),
    [userId, campaignId]
  )

  return { entries, capture, remove }
}
