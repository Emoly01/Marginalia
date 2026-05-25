// Backlinks — find which sessions mention a given entity.
// Tiptap Mention nodes render as <span data-type="mention" data-id="ENTITY_ID">.
// We scan session HTML content for data-id matches.
import { listSessions } from './sessions'

/**
 * Return sessions whose content mentions the given entity ID.
 */
export async function getSessionsMentioning(userId, campaignId, entityId) {
  const sessions = await listSessions(userId, campaignId)
  return sessions.filter((s) => contentMentions(s.content, entityId))
}

/**
 * Check whether a piece of HTML content mentions an entity ID.
 */
export function contentMentions(html, entityId) {
  if (!html || !entityId) return false
  // Mention nodes carry data-id="<entityId>"
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
