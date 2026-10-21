// Small derivations for the campaign home. Pure.

/** Typed log lines still waiting to be inked, per session: { [sessionId]: n }. */
export function uninkedCounts(logEntries) {
  const counts = {}
  for (const e of logEntries ?? []) {
    if (e.auto || e.mark === 'auto' || e.inked) continue
    counts[e.sessionId] = (counts[e.sessionId] ?? 0) + 1
  }
  return counts
}

/** The most recent session number mentioning each entity: { [entityId]: n }. */
export function lastSeen(sessions) {
  const seen = {}
  for (const s of sessions ?? []) {
    const n = s.sessionNumber
    for (const id of s.mentionIds ?? []) {
      if (n != null && (seen[id] === undefined || n > seen[id])) seen[id] = n
    }
  }
  return seen
}

/** Entities grouped for the codex filters, with counts. */
export function codexFilters(entities, types) {
  return [
    { value: 'all', label: 'All', count: (entities ?? []).length },
    ...types.map((t) => ({ value: t.value, label: t.plural, count: (entities ?? []).filter((e) => e.type === t.value).length })),
  ]
}
