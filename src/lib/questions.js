// The Questions page: every question I've written down in a campaign,
// pulled out of wherever it landed — the live log, a session's prose, a
// codex page, a loose margin. Pure: finding, merging and sorting them.
//
// What counts as a question:
//   - a log line marked mystery (typed with `?:` at the table), whole;
//   - a paragraph or list item that starts with `?:`, whole;
//   - any sentence that ends in "?" (prose, codex notes, margins), as long
//     as it has two words or more — "Why?" alone says nothing a week
//     later — with the sentence before it kept as context;
//   - a log line with a question in it, whole.
// Not counted: quotes (blockquotes in prose, quote-marked log lines — an
// NPC asking is not me asking), headings (Inking's recall prompts are
// questions to me, not mine), tracker lines, and log lines that were
// tossed or moved to the Margins in Inking.
//
// The same question written twice — in the log and again in the recap,
// or in two sessions — is one question with every place it was asked.

const BLOCK = /<(p|li|blockquote|h[1-6])\b[^>]*>|<\/(p|li|blockquote|h[1-6])>/gi

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
const decode = (s) => s.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => ENTITIES[m])

// Inline HTML → plain text; a mention keeps its "@Name" so MentionText can
// link it again on the page.
const plain = (html) =>
  decode(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A question's identity: case, spacing, the `?:` prefix, the trailing
 * punctuation and an @ in front of a name don't make it a different one.
 */
export function questionKey(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/^\s*\?:\s*/, '')
    .replace(/@/g, '')
    .replace(/[“”"‘’'«»]/g, '')
    .replace(/[\s.!?…,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A short stable id for a question key, usable as a Firestore doc id. */
export function questionId(key) {
  // FNV-1a, 32-bit, twice with different seeds → 13ish base-36 chars.
  const fnv = (seed) => {
    let h = seed
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(36)
  }
  return `q${fnv(0x811c9dc5)}${fnv(0x01000193)}`
}

const words = (s) => (String(s).match(/[\p{L}\p{N}]+/gu) ?? []).length

const CONTEXT_LENGTH = 140

// The sentence just before a question, so "Where would he get those?"
// still says what "those" were. Clipped from the front on a word boundary.
function contextBefore(sentences, i) {
  const prev = sentences
    .slice(0, i)
    .reverse()
    .find((x) => !x.question)
  if (!prev || sentences.slice(sentences.indexOf(prev) + 1, i).some((x) => x.question)) return ''
  const t = prev.text
  if (t.length <= CONTEXT_LENGTH) return t
  const cut = t.slice(-CONTEXT_LENGTH)
  const space = cut.indexOf(' ')
  return '…' + (space >= 0 && space < CONTEXT_LENGTH * 0.4 ? cut.slice(space + 1) : cut)
}

/**
 * The questions in a line of plain text → [{ text, context }]: each
 * sentence that ends in a question mark, with the sentence before it as
 * context (unless another question sits in between).
 */
export function findQuestions(text) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return []
  if (/^\?:/.test(s)) {
    const rest = s.slice(2).trim()
    return rest ? [{ text: rest, context: '' }] : []
  }
  // A sentence: anything up to a run of . ! ? … (plus closing quotes or
  // brackets). A run with a "?" in it ends a question ("Who?!" counts).
  const re = /[^.!?…]*?[^\s.!?…][^.!?…]*?([.!?…]+)["'”’»)\]]*/gu
  const sentences = []
  let m
  while ((m = re.exec(s)) !== null) {
    sentences.push({ text: m[0].trim().replace(/^[\s—–:-]+/, ''), question: m[1].includes('?') })
  }
  const out = []
  sentences.forEach((x, i) => {
    if (x.question && words(x.text) >= 2) out.push({ text: x.text, context: contextBefore(sentences, i) })
  })
  return out
}

/** Just the question sentences of a line of plain text. */
export function questionSentences(text) {
  return findQuestions(text).map((q) => q.text)
}

/**
 * The questions in a Tiptap HTML body (session content, entity notes),
 * as [{ text, context }]: from paragraphs and list items only — not
 * headings, not blockquotes.
 */
export function findQuestionsInHtml(html) {
  const src = String(html ?? '')
  if (!src.includes('<')) return findQuestions(decode(src))
  const out = []
  const stack = []
  let last = 0
  let m
  BLOCK.lastIndex = 0
  const flush = (end) => {
    const chunk = src.slice(last, end)
    const inside = stack.length ? stack[stack.length - 1] : null
    const quoted = stack.includes('blockquote')
    const heading = stack.some((t) => /^h\d$/.test(t))
    if (!quoted && !heading && (inside === 'p' || inside === 'li' || inside === null)) {
      out.push(...findQuestions(plain(chunk)))
    }
  }
  while ((m = BLOCK.exec(src)) !== null) {
    flush(m.index)
    if (m[1]) stack.push(m[1].toLowerCase())
    else {
      const tag = m[2].toLowerCase()
      const i = stack.lastIndexOf(tag)
      if (i >= 0) stack.splice(i)
    }
    last = m.index + m[0].length
  }
  flush(src.length)
  return out
}

/** Just the question sentences of an HTML body. */
export function questionsInHtml(html) {
  return findQuestionsInHtml(html).map((q) => q.text)
}

const toMs = (t) => {
  if (t == null) return null
  if (typeof t === 'number') return t
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (t instanceof Date) return t.getTime()
  if (typeof t.seconds === 'number') return t.seconds * 1000
  const n = Date.parse(t)
  return Number.isNaN(n) ? null : n
}

/**
 * Log lines that hold my questions. A log line is one thought typed at the
 * table, so it is kept whole: "Gnarl paid in old crowns. Where would he get
 * those?" is one question, not a stray "Where would he get those?".
 */
function logLineQuestions(e) {
  if (e.auto || e.mark === 'auto' || e.mark === 'quote' || e.mark === 'milestone') return []
  const action = e.inkedAs?.action
  if (action === 'toss' || action === 'later') return []
  const t = String(e.text ?? '').trim()
  if (!t) return []
  if (e.mark === 'mystery') return [{ text: t, context: '' }]
  return findQuestions(t).length ? [{ text: t, context: '' }] : []
}

/**
 * Every question in a campaign, merged by key, newest first.
 * → [{ id, key, text, context, sources: [{ kind, sessionId?, sessionNumber?, sessionTitle?,
 *      entityId?, entityName?, marginId?, at }], at }]
 * `kind` is 'log' | 'session' | 'entity' | 'margin'. `text` is the most
 * recent wording; `context` the sentence before it in prose, if any; `at`
 * the most recent time it was written (ms or null).
 */
export function collectQuestions({ sessions = [], log = [], entities = [], margins = [] } = {}) {
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]))
  const found = []
  const add = ({ text, context }, source) => {
    const key = questionKey(text)
    if (!key) return
    found.push({ key, text: String(text).trim(), context: context ?? '', source })
  }
  const sessionBits = (s) =>
    s ? { sessionId: s.id, sessionNumber: s.sessionNumber ?? null, sessionTitle: s.title ?? '' } : {}

  for (const e of log) {
    const s = byId[e.sessionId]
    for (const q of logLineQuestions(e)) add(q, { kind: 'log', ...sessionBits(s), sessionId: e.sessionId, entityId: e.entityId ?? null, at: toMs(e.clientAt) })
  }
  for (const s of sessions) {
    const at = toMs(s.date) ?? toMs(s.updatedAt) ?? toMs(s.createdAt)
    for (const q of findQuestionsInHtml(s.content)) add(q, { kind: 'session', ...sessionBits(s), at })
  }
  for (const en of entities) {
    for (const q of findQuestionsInHtml(en.notes)) add(q, { kind: 'entity', entityId: en.id, entityName: en.name, at: toMs(en.updatedAt) ?? toMs(en.createdAt) })
  }
  for (const m of margins) {
    if (m.archived) continue
    for (const q of findQuestions(m.text)) add(q, { kind: 'margin', marginId: m.id, at: toMs(m.createdAt) })
  }

  // A log line inked into the recap shows up twice in that session: whole
  // in the log, split into sentences in the prose. The log line wins.
  const logKeys = {}
  for (const f of found) if (f.source.kind === 'log') (logKeys[f.source.sessionId] ??= []).push(f.key)
  const echoesLog = (f) => f.source.kind === 'session' && (logKeys[f.source.sessionId] ?? []).some((k) => k !== f.key && k.includes(f.key))

  const merged = new Map()
  for (const f of found) {
    if (echoesLog(f)) continue
    const at = f.source.at ?? null
    let q = merged.get(f.key)
    if (!q) {
      q = { id: questionId(f.key), key: f.key, text: f.text, context: f.context, sources: [], at, textAt: at }
      merged.set(f.key, q)
    }
    // Keep one source per place (a line inked into the recap and still in
    // the log is asked once in that session, not twice).
    const place = f.source.sessionId ?? f.source.entityId ?? f.source.marginId
    const dupe = q.sources.find((s) => (s.sessionId ?? s.entityId ?? s.marginId) === place && (s.kind === 'entity') === (f.source.kind === 'entity'))
    if (!dupe) q.sources.push(f.source)
    if (at != null && (q.at == null || at > q.at)) q.at = at
    if (at != null && (q.textAt == null || at >= q.textAt)) {
      q.text = f.text
      q.context = f.context || q.context
      q.textAt = at
    }
  }
  const out = [...merged.values()].map((q) => {
    delete q.textAt
    q.sources.sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    return q
  })
  return out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || a.text.localeCompare(b.text))
}

/**
 * Split questions by what I've decided about them. `marks` is
 * { [questionId]: { status: 'answered' | 'aside', answer } }.
 * → { open, answered, aside } — each question carries its `mark`.
 */
export function sortByStatus(questions, marks = {}) {
  const out = { open: [], answered: [], aside: [] }
  for (const q of questions ?? []) {
    const mark = marks[q.id] ?? null
    const status = mark?.status === 'answered' || mark?.status === 'aside' ? mark.status : 'open'
    out[status].push({ ...q, mark })
  }
  return out
}

/** "Session 12" / "Gnarl" / "Margins" — where a question was written. */
export function sourceLabel(src) {
  if (src.kind === 'entity') return src.entityName || 'Codex'
  if (src.kind === 'margin') return 'Margins'
  if (src.sessionNumber != null) return `Session ${src.sessionNumber}`
  return src.sessionTitle || 'A session'
}
