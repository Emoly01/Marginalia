import { splitMentions } from '../lib/mentionText'

/** A log line with its @Names highlighted, and linked when they're in the codex. */
export default function MentionText({ text, entities, onOpenEntity }) {
  return splitMentions(text, entities).map((p, i) =>
    !p.mention ? (
      <span key={i}>{p.text}</span>
    ) : p.entity && onOpenEntity ? (
      <button key={i} className="mention-word" onClick={() => onOpenEntity(p.entity.id)}>{p.text}</button>
    ) : (
      <span key={i} className="mention-word">{p.text}</span>
    )
  )
}
