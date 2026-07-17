// Backlinks — find which sessions mention a given entity.
// Sessions saved since v0.3 carry a `mentionIds` array (kept up to date on
// every save); older sessions fall back to scanning their HTML content.
import { listSessions } from './sessions'
import { contentMentions } from './mentions'

/**
 * Return sessions whose content mentions the given entity ID.
 */
export async function getSessionsMentioning(userId, campaignId, entityId) {
  const sessions = await listSessions(userId, campaignId)
  return sessions.filter((s) =>
    Array.isArray(s.mentionIds)
      ? s.mentionIds.includes(entityId)
      : contentMentions(s.content, entityId)
  )
}
