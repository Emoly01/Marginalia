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

/** Milliseconds a session ran, from startedAt to endedAt (or now while live). */
export function sessionDuration(session, now = Date.now()) {
  const start = toDate(session?.startedAt)
  if (!start) return null
  const end = toDate(session?.endedAt) ?? (sessionStatus(session) === 'live' ? new Date(now) : null)
  return end ? Math.max(0, end - start) : null
}

/** 11_040_000 → "3 h 04 m"; under an hour → "42 m". */
export function formatDuration(ms) {
  if (ms == null) return ''
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`
}

/** A running clock for the table view: 3852000 → "1:04:12". */
export function formatClock(ms) {
  if (ms == null) return '—'
  const secs = Math.floor(ms / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`
}
