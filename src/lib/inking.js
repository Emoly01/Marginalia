// Inking — turning a session's live log (and loose margins) into journal
// content. Pure: the queue, the timeline, and the HTML each action appends.
//
// Session content and entity notes are Tiptap HTML strings. Everything
// added here is a <p>, <blockquote> or <h3> of escaped text, plus mention
// spans in exactly the shape RichTextEditor renders, so Tiptap reloads it
// unchanged and extractMentionIds() picks the mentions up for backlinks.
import { parseLine } from './npcLine'
import { stripAt, mentionedEntities, splitMentions } from './mentionText'

export const ENTITY_TYPES_FOR_INKING = ['npc', 'location', 'thread', 'item', 'faction']

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The mention node RichTextEditor renders for an entity. */
export function mentionHtml(entity) {
  const id = escapeHtml(entity.id)
  const name = escapeHtml(entity.name)
  return `<span data-type="mention" data-id="${id}" data-label="${name}" class="marginalia-mention">@${name}</span>`
}

/** True for '', null and Tiptap's empty document ("<p></p>"). */
export function isEmptyHtml(html) {
  return !String(html ?? '').replace(/<p>\s*<\/p>/g, '').trim()
}

/** Append a fragment of block HTML to a document, replacing an empty one. */
export function appendHtml(content, fragment) {
  return (isEmptyHtml(content) ? '' : content) + fragment
}

/**
 * One line of plain text → inline HTML: escaped, newlines as <br>, and
 * every @Name that matches an entity as a real mention (unknown @Names lose
 * the @ and stay plain text).
 */
export function inlineHtml(text, entities = []) {
  return splitMentions(String(text ?? ''), entities)
    .map((p) => (p.entity ? mentionHtml(p.entity) : escapeHtml(p.text).replace(/\n/g, '<br>')))
    .join('')
}

// Plain text → paragraphs; single newlines become <br>.
function paragraphs(text, entities) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inlineHtml(p, entities)}</p>`)
    .join('')
}

const isLogItem = (e) => !e.auto && e.mark !== 'auto'

/**
 * The triage queue: the session's own typed log lines not yet inked
 * (oldest first), then every active margin of the campaign.
 * → [{ key, kind: 'log' | 'margin', id, text, mark, at, entityId }]
 */
export function buildQueue(entries, margins) {
  const log = (entries ?? [])
    .filter((e) => isLogItem(e) && !e.inked)
    .sort((a, b) => (a.clientAt ?? 0) - (b.clientAt ?? 0))
    .map((e) => ({ key: `log:${e.id}`, kind: 'log', id: e.id, text: e.text, mark: e.mark, at: e.clientAt ?? null, entityId: e.entityId ?? null }))
  const loose = (margins ?? [])
    .filter((m) => !m.archived)
    .map((m) => ({ key: `margin:${m.id}`, kind: 'margin', id: m.id, text: m.text, mark: 'margin', at: null, entityId: null }))
  return [...log, ...loose]
}

/** Tracker entries, for the timeline beside the queue ("21:06 cast Hex"). */
export function autoTimeline(entries) {
  return (entries ?? []).filter((e) => !isLogItem(e)).sort((a, b) => (a.clientAt ?? 0) - (b.clientAt ?? 0))
}

/**
 * A first guess for "Make entity": NPC lines keep their name, loot becomes
 * an item, mysteries become threads. → { type, name, notes }
 */
export function suggestEntity(item) {
  const { name, notes } = parseLine(item.text)
  const hasSeparator = notes !== ''
  const type = { npc: 'npc', loot: 'item', mystery: 'thread' }[item.mark] ?? 'npc'
  if (item.mark === 'npc' || hasSeparator) return { type, name, notes }
  return { type, name: '', notes: item.text }
}

// "Gnarl — grumpy bartender" next to @Gnarl reads twice; drop the name.
function withoutLeadingName(text, entity) {
  const { name, notes } = parseLine(text)
  return notes && name.toLowerCase() === String(entity.name).trim().toLowerCase() ? notes : text
}

/**
 * What an action adds to the recap.
 *   'recap'  → the line as a paragraph (a quote as a blockquote)
 *   'entity' / 'link' → "@Name — the line"
 */
export function recapFragment(text, { action, mark, entity, entities = [] }) {
  if (action === 'recap') {
    return mark === 'quote' ? `<blockquote>${paragraphs(text, entities)}</blockquote>` : paragraphs(text, entities)
  }
  let rest = withoutLeadingName(stripLeadingAt(text, entity), entity).trim()
  if (rest.toLowerCase() === String(entity.name).trim().toLowerCase()) rest = ''
  const others = entities.filter((e) => e.id !== entity.id)
  return `<p>${mentionHtml(entity)}${rest ? ` — ${inlineHtml(rest, others)}` : ''}</p>`
}

// "@Gnarl lied about the bell" next to the @Gnarl mention → "lied about the bell".
function stripLeadingAt(text, entity) {
  const s = String(text ?? '').trim()
  const at = `@${String(entity.name).trim()}`
  return s.toLowerCase().startsWith(at.toLowerCase()) ? s.slice(at.length).replace(/^[\s—–:-]+/, '') : s
}

/** What "Link to existing entity" adds to that entity's notes. */
export function entityNotesFragment(text, session, entities = []) {
  const from = session?.title ? ` <em>(${escapeHtml(session.title)})</em>` : ''
  return `<p>${inlineHtml(String(text ?? '').trim(), entities)}${from}</p>`
}

export function recallPrompts(characterName) {
  return [
    'Who did we meet?',
    'What did we learn?',
    `What does ${characterName || 'my character'} want now?`,
    'Loot or losses?',
    'Where did it end?',
  ]
}

// One line under each prompt, in the handoff's words.
export const RECALL_HINTS = [
  'Names first. The codex will catch them.',
  'Facts, rumours, and things you only suspect.',
  'In their words, not yours.',
  'What changed hands, and what it cost.',
  'One line. Next session starts here.',
]

const typed = (entries) =>
  (entries ?? []).filter((e) => !e.auto && e.mark !== 'auto').sort((a, b) => (a.clientAt ?? 0) - (b.clientAt ?? 0))

/**
 * "From tonight's log, tap to borrow": a few lines of the session's own log
 * that might answer a recall prompt. Nothing is invented — every chip is a
 * name or a line I wrote at the table (or tonight's intention).
 */
export function recallChips(promptIndex, { entries = [], session = null, entities = [] } = {}, limit = 3) {
  const lines = typed(entries)
  const uniq = (xs) => [...new Set(xs.map((x) => String(x ?? '').trim()).filter(Boolean))].slice(0, limit)
  switch (promptIndex) {
    case 0: {
      const byId = Object.fromEntries(entities.map((e) => [e.id, e]))
      return uniq(
        lines
          .filter((e) => e.mark === 'npc' || (e.entityId && byId[e.entityId]?.type === 'npc'))
          .map((e) => byId[e.entityId]?.name ?? parseLine(stripAt(e.text)).name)
      )
    }
    case 1:
      return uniq(lines.filter((e) => e.mark === 'mystery' || e.mark === 'important').map((e) => stripAt(e.text)))
    case 2:
      return uniq([session?.intention])
    case 3:
      return uniq(lines.filter((e) => e.mark === 'loot').map((e) => stripAt(e.text)))
    case 4:
      return uniq(lines.slice(-1).map((e) => stripAt(e.text)))
    default:
      return []
  }
}

/**
 * "Link to an existing page" suggestions for a queue item: the entity the
 * line was captured against, then entities the line names.
 */
export function suggestLinks(item, entities = [], limit = 4) {
  const out = []
  const own = entities.find((e) => e.id === item.entityId)
  if (own) out.push(own)
  for (const e of mentionedEntities(item.text, entities, limit + 1)) if (!out.includes(e)) out.push(e)
  return out.slice(0, limit)
}

/** Recall answers → "<h3>Prompt</h3><p>answer</p>…", skipping blank ones. */
export function recallFragment(prompts, answers) {
  return prompts
    .map((prompt, i) => {
      const body = paragraphs(answers?.[i])
      return body ? `<h3>${escapeHtml(prompt)}</h3>${body}` : ''
    })
    .join('')
}

/**
 * The recap as readable blocks for the preview beside the queue — text
 * only, so nothing in it is ever rendered as HTML.
 */
export function recapBlocks(html) {
  const blocks = []
  const re = /<(h[1-3]|p|li)[^>]*>([\s\S]*?)<\/\1>/g
  let m
  while ((m = re.exec(String(html ?? ''))) !== null) {
    const text = m[2]
      .replace(/(<span[^>]*data-type="mention"[^>]*>)@/g, '$1') // a mention reads as the name
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim()
    if (text) blocks.push({ kind: m[1].startsWith('h') ? 'heading' : 'text', text })
  }
  return blocks
}
