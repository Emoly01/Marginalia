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
  - color             // hex — for visual distinction in dropdown
  - status            // "active", "hiatus", "completed"

/users/{userId}/campaigns/{campaignId}/sessions/{sessionId}
  - title             // "Session 47 — The Bridge"
  - sessionNumber     // 47
  - date              // when session happened
  - content           // rich text body of journal entry
  - mentions          // array of { entityId, entityType, position }
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
  - background
  - personality       // freeform internal-monologue space
  - relationships     // freeform relationship tracker
  - knowledge         // what my character knows (vs. what I know OOC)
  - vibes             // songs, aesthetic, mood notes
  - updatedAt
```

## Why this shape

- **All under `/users/{userId}/`** — strict per-user privacy. Firestore rules can be a single
  rule: `allow read, write: if request.auth.uid == userId`. Simple, secure.
- **Sessions store `mentions` array** — when you @-tag an NPC inline, we record the link.
  Rendering an entity page = query sessions where `mentions` contains this entityId.
- **Entities are flat per campaign** — no subcollections by type. Filter by `type` field.
  Easier to query "all things in this campaign" and easier to convert types later
  (e.g. "this NPC is actually a location now").
- **Character is a singleton doc** — one PC per campaign for v1. Can extend to multi-PC
  campaigns later if Emily ever runs a duo character.

## Future considerations

- **Sharing**: if/when sharing is added, sessions can get a `sharedToken` field that grants
  read access via a public URL. Don't build until needed.
- **Search**: Firestore full-text search is bad. If search becomes important, either use
  Algolia or do client-side fuzzy search (small enough dataset, should work fine).
- **Offline**: Firestore has built-in offline persistence — enable it once writing-during-session
  becomes a real use case.
