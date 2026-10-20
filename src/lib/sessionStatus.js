// Session lifecycle rules, pure. A session is 'live' while I'm at the table,
// 'ended' once play stops, and 'inked' after triage. Sessions written before
// the lifecycle existed have no status and count as inked: no badges.

export const SESSION_STATUSES = ['live', 'ended', 'inked']

export function sessionStatus(session) {
  return SESSION_STATUSES.includes(session?.status) ? session.status : 'inked'
}

/** The campaign's live session, if any (there should only ever be one). */
export function findLiveSession(sessions) {
  return (sessions ?? []).find((s) => sessionStatus(s) === 'live') ?? null
}

/**
 * The most recent session that isn't live — what "Previously on…" recaps.
 * `sessions` arrive most-recent-first, as listSessions() returns them.
 */
export function findPreviousSession(sessions) {
  return (sessions ?? []).find((s) => sessionStatus(s) !== 'live') ?? null
}

/** Badge text for a session card, or null for none. */
export function sessionBadge(session) {
  const status = sessionStatus(session)
  if (status === 'live') return 'live'
  if (status === 'ended') return 'to ink'
  return null
}

/** Firestore Timestamp | Date | ms → Date, or null. */
export function toDate(value) {
  if (!value) return null
  if (value.toDate) return value.toDate()
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}
