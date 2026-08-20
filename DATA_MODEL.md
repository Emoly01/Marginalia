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

/users/{userId}/campaigns/{campaignId}/sessions/{sessionId}
  - title             // "Session 47 — The Bridge"
  - sessionNumber     // 47
  - date              // when session happened
  - content           // rich text body of journal entry
  - mentionIds        // array of entity IDs mentioned in content (auto-derived on save)
  - createdAt
  - updatedAt

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
```

## Why this shape

- **All under `/users/{userId}/`** — strict per-user privacy. Firestore rules can be a single
  rule: `allow read, write: if request.auth.uid == userId`. Simple, secure.
- **Sessions store a `mentionIds` array** — when you @-tag an NPC inline, we record the link.
  It's re-derived from the content on every save, so it can't drift. Entity pages check
  `mentionIds` (falling back to scanning content for pre-v0.3 sessions).
- **Entities are flat per campaign** — no subcollections by type. Filter by `type` field.
  Easier to query "all things in this campaign" and easier to convert types later
  (e.g. "this NPC is actually a location now").
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
- **Search**: Firestore full-text search is bad. If search becomes important, either use
  Algolia or do client-side fuzzy search (small enough dataset, should work fine).
- **Offline**: Firestore has built-in offline persistence — enable it once writing-during-session
  becomes a real use case.
