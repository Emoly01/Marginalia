# Marginalia — Data Model

## Firestore Structure

```
/users/{userId}
  - displayName
  - email
  - createdAt

/users/{userId}/campaigns/{campaignId}
  - name              // "League of Ambivalence"
  - shortName         // "League" — for display
  - system            // "D&D 5e", "Call of Cthulhu", etc.
  - dmName            // optional
  - characterName     // YOUR PC's name in this campaign
  - characterClass    // optional flavor
  - createdAt
  - lastActiveAt
  - palette           // palette id — "gold", "sage", "plum"… see src/lib/palette.js
  - status            // "active", "hiatus", "completed"
  - ddbUrl            // optional D&D Beyond character link, opened from table view

/users/{userId}/campaigns/{campaignId}/sessions/{sessionId}
  - title             // "Session 47 — The Bridge"
  - sessionNumber     // 47
  - date              // when session happened
  - content           // rich text body of journal entry
  - mentionIds        // array of entity IDs mentioned in content (auto-derived on save)
  - createdAt
  - updatedAt
  - // Lifecycle — optional; sessions without `status` are legacy and count as inked:
  - status            // "live" (at the table) | "ended" (to ink) | "inked"
  - startedAt
  - endedAt
  - inkedAt
  - intention         // one line set before play: what my character wants tonight

/users/{userId}/campaigns/{campaignId}/entities/{entityId}
  - type              // "npc" | "pc" | "location" | "thread" | "item"
  - name
  - notes             // freeform notes about this entity
  - aliases           // array of alternate names
  - createdAt
  - updatedAt
  - // Auto-aggregated:
  - mentionedIn       // array of sessionIds where this entity appears

/users/{userId}/campaigns/{campaignId}/character/main
  // YOUR character — singleton doc per campaign
  - name
  - class
  - level
  - ancestry
  - pronouns
  - background
  - status            // "alive", "dead", "retired", "missing", "other"
  - abilities         // { str, dex, con, int, wis, cha } — the summary-card grid
  - personality       // freeform internal-monologue space
  - backstory
  - goals
  - relationships     // array of { id, name, type, status, notes }
  - knowledge         // what my character knows (in-character)
  - knowledgeOOC      // what I know that they haven't earned yet
  - items             // things that matter narratively
  - vibes             // songs, aesthetic, mood notes
  - updatedAt

/users/{userId}/campaigns/{campaignId}/character/sheet
  // The last D&D Beyond PDF import. The PDF itself is never stored.
  - parserVersion     // PARSER_VERSION in src/lib/sheet/parseDdbSheet.js
  - importedAt
  - sourceFileName
  - data              // parsed sheet: identity, abilities, skills, combat, proficiencies,
                      // actions, attacks, features, inventory, personality,
                      // spellcasting, slots { "1": 4, … }, spells [{ key, name, level, … }]
  - raw               // [{ page, fieldName, value, rect }] — every filled PDF field,
                      // with position, so a newer parser can re-parse without the PDF

/users/{userId}/campaigns/{campaignId}/character/play
  // Live play state. Separate from the sheet so re-imports never touch it.
  // Stores only what is used; maxima come from character/sheet.
  - hpCurrent         // null / missing = full
  - hpTemp
  - slotsUsed         // { "1": 0, "2": 1, … }
  - resources         // [{ id, name, max, reset: "short" | "long" }] — confirmed at import
  - resourcesUsed     // { [resourceId]: n }
  - hitDiceUsed
  - conditions        // ["Poisoned", …]; a legacy "Exhaustion" here reads as exhaustion 1
  - exhaustion        // 0–6, a counter (no rules text); a long rest lowers it by 1
  - concentration     // spell name or null; a long rest clears it
  - deathSaves        // { successes, failures }
  - updatedAt

/users/{userId}/campaigns/{campaignId}/character/notes
  - spells            // { [spellKey]: "my note" } — spellKey("Tasha's Hideous Laughter")
                      // = "tashas-hideous-laughter"; survives re-imports
  - updatedAt

/users/{userId}/campaigns/{campaignId}/log/{entryId}
  // Live session log, one collection per campaign. Query by sessionId only
  // and sort by clientAt client-side — no composite index.
  - sessionId
  - text
  - mark              // "note" | "important" | "quote" | "npc" | "mystery" | "loot"
                      // | "auto" (tracker taps) | "milestone" (level-up on re-import)
  - auto              // null, or { type, payload } for tracker entries
  - entityId          // entity created from or linked to this line, or null
  - clientAt          // Date.now() when written — survives offline queueing
  - createdAt         // serverTimestamp()
  - inked             // false until handled in Inking
  - inkedAs           // null, or { action: "recap" | "entity" | "link" | "toss" | "later",
                      //   entityId, marginId } — "later" moved the line into the Margins
                      //   inbox; marginId is the margin it became

/users/{userId}/campaigns/{campaignId}/margins/{marginId}
  // The Margins inbox: loose notes not tied to a session.
  - text
  - archived          // true once used or tossed in Inking
  - createdAt
  - fromLog           // log entryId, when "Keep for later" moved a log line here
```

Entities created by a sheet import carry `source: "sheet"`. One is created per
distinct item name, and only when no entity of any type already has that name
(case-insensitive), so re-imports never duplicate them.

## Why this shape

- **All under `/users/{userId}/`** — strict per-user privacy. Firestore rules can be a single
  rule: `allow read, write: if request.auth.uid == userId`. Simple, secure.
- **Sessions store a `mentionIds` array** — when you @-tag an NPC inline, we record the link.
  It's re-derived from the content on every save, so it can't drift. Entity pages check
  `mentionIds` (falling back to scanning content for pre-v0.3 sessions).
- **Entities are flat per campaign** — no subcollections by type. Filter by `type` field.
  Easier to query "all things in this campaign" and easier to convert types later
  (e.g. "this NPC is actually a location now").
- **Sheet, play and notes are separate docs** — a re-import replaces `character/sheet`
  wholesale but only touches `play.resources` (the confirmed list), so HP and spent slots
  survive a level-up, and so do spell notes. The dossier (`character/main`) is only ever
  filled where it is empty. All of it sits in the `character` subcollection, so the
  campaign delete cascade already covers it.
- **Inking writes as it goes** — each queue item is applied immediately (recap appended,
  entity created or its notes appended, log entry marked `inked`, margin archived), so a
  half-finished triage loses nothing and the rest stays queued. Appended HTML is escaped
  text in `<p>`, `<blockquote>`, `<h3>` and mention spans shaped exactly like the editor's,
  and `mentionIds` is re-derived on every write. A margin used or tossed in Inking is
  archived, not deleted.
- **One live session per campaign** — `startSession` returns the existing live session
  instead of making a second. Creating and ending sessions return as soon as the write is
  queued, so the table works without wifi.
- **The log is campaign-level, not per session** — one single-field query per session,
  and deleting a session deletes its entries (`deleteSession`); `log` is in the campaign
  delete cascade too.
- **Character is a singleton doc** — one PC per campaign for v1. Can extend to multi-PC
  campaigns later if Emily ever runs a duo character.
- **A campaign stores a palette, not a colour** — `palette` names one of ten accent
  colours, and the whole surface ramp is derived from it in OKLCH at runtime
  (`src/lib/palette.js`). Campaigns written before this carry a `theme` id and/or a
  `color` hex instead; `paletteFor()` maps those onto the nearest palette on read, and
  the campaign is rewritten with `palette` the next time it is saved. The legacy fields
  are left in place rather than deleted — nothing reads them once `palette` exists.

## Future considerations

- **Sharing**: if/when sharing is added, sessions can get a `sharedToken` field that grants
  read access via a public URL. Don't build until needed.
- **Search**: done client-side with MiniSearch (`src/lib/search.js`), nothing stored. The
  index is built on first open from live listeners on the campaigns in scope and rebuilt
  when their data changes. Exact and prefix matches win; fuzzy matching (two edits for
  terms of 5+ letters) only kicks in when they find nothing.
- **Offline**: enabled (`persistentLocalCache` in `src/firebase.js`). Table-view writes are
  fired without awaiting, so they queue offline instead of blocking.
