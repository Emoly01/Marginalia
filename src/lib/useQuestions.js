// A campaign's questions, live: found in the log, session prose, codex
// notes and open margins, and split by what I've decided about them.
// Shared by the Questions page and "Previously on…" at the table.
import { useState, useEffect, useMemo } from 'react'
import { subscribeCampaignLog } from './log'
import { listAllMargins } from './margins'
import { subscribeQuestionMarks } from './questionMarks'
import { collectQuestions, sortByStatus } from './questions'

/** → { questions, groups: { open, answered, aside }, marks } */
export function useQuestions(userId, campaignId, sessions, entities) {
  const [log, setLog] = useState([])
  const [margins, setMargins] = useState([])
  const [marks, setMarks] = useState({})

  useEffect(() => {
    const fail = (what) => (err) => console.error(`Questions could not read ${what}:`, err)
    let cancelled = false
    const unLog = subscribeCampaignLog(userId, campaignId, setLog, fail('the log'))
    const unMarks = subscribeQuestionMarks(userId, campaignId, setMarks, fail('answered questions'))
    listAllMargins(userId, campaignId)
      .then((m) => !cancelled && setMargins(m))
      .catch(fail('the margins'))
    return () => {
      cancelled = true
      unLog()
      unMarks()
    }
  }, [userId, campaignId])

  const questions = useMemo(
    () => collectQuestions({ sessions: sessions ?? [], log, entities: entities ?? [], margins }),
    [sessions, log, entities, margins]
  )
  const groups = useMemo(() => sortByStatus(questions, marks), [questions, marks])
  return { questions, groups, marks }
}
