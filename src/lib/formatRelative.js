// Format a timestamp as "2h ago", "yesterday", "3 days ago", etc.
// Accepts: Date, Firestore Timestamp, ISO string, or null/undefined
export function formatRelative(value) {
  if (!value) return ''

  let date
  if (value?.toDate) {
    // Firestore Timestamp
    date = value.toDate()
  } else if (value instanceof Date) {
    date = value
  } else {
    date = new Date(value)
  }

  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHr = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHr / 24)

  if (diffSec < 30) return 'just now'
  if (diffMin < 1) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  if (diffDay < 30) return `${Math.round(diffDay / 7)}w ago`
  if (diffDay < 365) return `${Math.round(diffDay / 30)}mo ago`
  return `${Math.round(diffDay / 365)}y ago`
}
