// usePlayState — live HP / slots / resources for a campaign's character,
// for the trackers in table view.
//
// Both docs are watched with onSnapshot, so every tap shows up instantly
// from the local cache, online or not. Writes are fired and not awaited:
// offline, Firestore queues them, and the table shouldn't wait on wifi.
// When a session is live (pass its id), every action also writes an `auto`
// entry to that session's log, with quick HP taps merged into one line.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { subscribeSheet, subscribePlay, updatePlay, ensurePlay } from './characterSheet'
import { addLogEntry, updateLogEntry } from './log'
import { sheetData } from './sheet/importPlan'
import { createAutoLogger } from './autoLog'
import * as play from './play'
import { toast } from './toast'

export function usePlayState(userId, campaignId, { liveSessionId = null } = {}) {
  const [sheetDoc, setSheetDoc] = useState(undefined) // undefined = loading, null = none
  const [playDoc, setPlayDoc] = useState(undefined)
  // Latest play state including writes not yet echoed back by a snapshot,
  // so two taps in the same frame don't both start from the same value.
  const playRef = useRef(null)
  const sheetRef = useRef(null)

  useEffect(() => {
    setSheetDoc(undefined)
    setPlayDoc(undefined)
    const onError = (err) => {
      console.error('Play state subscription failed:', err)
      toast('Could not load the character sheet.')
    }
    const unSheet = subscribeSheet(userId, campaignId, setSheetDoc, onError)
    const unPlay = subscribePlay(
      userId,
      campaignId,
      (p) => {
        playRef.current = p
        setPlayDoc(p)
      },
      onError
    )
    return () => {
      unSheet()
      unPlay()
    }
  }, [userId, campaignId])

  const sheet = useMemo(() => sheetData(sheetDoc), [sheetDoc])
  useEffect(() => {
    sheetRef.current = sheet
  }, [sheet])

  // A sheet without a play doc (imported before play state existed, or the
  // doc was removed) gets an empty one, so field-path updates have a target.
  useEffect(() => {
    if (sheetDoc && playDoc === null) {
      ensurePlay(userId, campaignId).catch((err) => console.error('Could not create play state:', err))
    }
  }, [sheetDoc, playDoc, userId, campaignId])

  const state = useMemo(() => (sheet ? play.derivePlayState(sheet, playDoc) : null), [sheet, playDoc])

  const logger = useMemo(() => {
    if (!liveSessionId) return null
    const fail = (err) => {
      console.error('Could not write log entry:', err)
      toast('Could not write to the session log.')
    }
    return createAutoLogger({
      write: ({ text, auto }) => {
        const { id, done } = addLogEntry(userId, campaignId, { sessionId: liveSessionId, text, mark: 'auto', auto })
        done.catch(fail)
        return id
      },
      update: (id, patch) => {
        updateLogEntry(userId, campaignId, id, patch).catch(fail)
      },
    })
  }, [userId, campaignId, liveSessionId])

  const run = useCallback(
    (action, ...args) => {
      const sheetNow = sheetRef.current
      if (!sheetNow) return
      const result = action(play.derivePlayState(sheetNow, playRef.current), ...args)
      if (!result) return
      playRef.current = play.applyPatch(playRef.current, result.patch)
      setPlayDoc(playRef.current)
      updatePlay(userId, campaignId, result.patch).catch((err) => {
        console.error('Play state write failed:', err)
        toast('Could not save that change.')
      })
      logger?.log(result.log)
    },
    [userId, campaignId, logger]
  )

  const actions = useMemo(
    () => ({
      damage: (n) => run(play.damage, n),
      heal: (n) => run(play.heal, n),
      setTemp: (n) => run(play.setTemp, n),
      spendSlot: (level) => run(play.spendSlot, level),
      restoreSlot: (level) => run(play.restoreSlot, level),
      useResource: (id) => run(play.spendResource, id),
      restoreResource: (id) => run(play.restoreResource, id),
      shortRest: (opts) => run(play.shortRest, opts),
      longRest: () => run(play.longRest),
      toggleCondition: (name) => run(play.toggleCondition, name),
      setExhaustion: (level) => run(play.setExhaustion, level),
      clearConditions: () => run(play.clearConditions),
      setConcentration: (spellName) => run(play.setConcentration, spellName),
      castSpell: (cast) => run(play.castSpell, cast),
      deathSave: (kind) => run(play.deathSave, kind),
      // A typed log line between taps ends an HP burst.
      breakLogBurst: () => logger?.reset(),
    }),
    [run, logger]
  )

  return {
    loading: sheetDoc === undefined || playDoc === undefined,
    hasSheet: Boolean(sheet),
    sheet,
    sheetDoc,
    state,
    actions,
  }
}
