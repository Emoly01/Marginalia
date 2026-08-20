// Small pure text helpers, kept free of Firebase imports so they stay testable.

const EXCERPT_LENGTH = 150

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/**
 * Strip a fragment of session HTML down to readable prose.
 */
export function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The opening run of a session's body, clipped on a word boundary.
 */
export function excerptFrom(html, maxLength = EXCERPT_LENGTH) {
  const text = stripHtml(html)
  if (text.length <= maxLength) return text
  const clipped = text.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  return (lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped) + '…'
}

/**
 * "Emily Wilisch" → "EW", for the avatar in the sidebar footer.
 */
export function initials(name) {
  if (!name) return '·'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
