// Pure helpers for working with @-mentions in session HTML.
// Tiptap Mention nodes render as <span data-type="mention" data-id="ENTITY_ID">.

/**
 * Check whether a piece of HTML content mentions an entity ID.
 */
export function contentMentions(html, entityId) {
  if (!html || !entityId) return false
  return html.includes(`data-id="${entityId}"`)
}

/**
 * Extract all mentioned entity IDs from a piece of HTML content.
 */
export function extractMentionIds(html) {
  if (!html) return []
  const ids = []
  const regex = /data-id="([^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    ids.push(match[1])
  }
  return [...new Set(ids)]
}
