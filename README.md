# Marginalia

> notes in the margins of someone else's story

A cross-campaign player journal for TTRPGs. Hybrid freeform-plus-structured journaling: write naturally, @-mention NPCs and threads inline, and the structure builds itself.

## Stack

- Vite + React, Tiptap for rich text
- Firebase Auth (Google Sign-In) + Firestore (offline cache on), Spark plan — no Cloud Storage
- pdf.js (D&D Beyond sheet import, in the browser), MiniSearch (client-side search)
- vite-plugin-pwa (installable app, offline app shell)
- Deploy: GitHub → Vercel

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Firebase project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - New project — suggested name: `marginalia` or `marginalia-journal`
   - Add a Web App, copy the config
   - Enable **Authentication → Google sign-in**
   - Enable **Firestore** (start in production mode, we'll add rules)

3. **Add Firebase config**
   - Open `src/firebase.js`
   - Replace the `firebaseConfig` placeholder with your project's config

4. **Add Firestore security rules** (in Firebase console → Firestore → Rules)
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

5. **Run locally**
   ```bash
   npm run dev
   ```

## Deploy

- Push to GitHub
- Connect repo to Vercel
- Add Firebase config as Vercel env vars (or just commit it — public Firebase config is fine,
  security comes from Firestore rules, not from hiding the API key)
- `vercel.json` serves `/sw.js` with `Cache-Control: no-cache` (so a new version is picked up)
  and proxies `/__/auth/*` and `/__/firebase/*` to Firebase (see below).

## Install it (tablet / phone)

Open the deployed site in Chrome → menu → **Install app** (or "Add to home screen"). It
opens full screen; the app shell works offline and Firestore keeps your data offline. When a
new version is deployed, a "Reload" prompt appears — it never reloads on its own.

## Sign-in inside the installed app

Sign-in tries a Google popup first and falls back to a full-page redirect when the popup
can't open. Chrome, Safari and Firefox block the third-party storage a redirect needs unless
Firebase's auth pages are served from **the app's own domain**. The proxy for that is already
in `vercel.json`; to switch it on (only needed if the popup fails in the installed app):

1. Google Cloud console → APIs & Services → Credentials → the OAuth 2.0 *Web client* Firebase
   created → **Authorized redirect URIs** → add `https://<your-domain>/__/auth/handler`.
2. Firebase console → Authentication → Settings → **Authorized domains** → make sure
   `<your-domain>` is listed (it already is if sign-in works in the browser).
3. Vercel → Project → Settings → Environment Variables → `VITE_FIREBASE_AUTH_DOMAIN` =
   `<your-domain>` for **Production**, then redeploy.

Leave it unset for previews: their URLs change, and an auth domain without a registered
redirect URI breaks the popup too.

## Roadmap

**v0.1 — Scaffolding** ✅
- Auth, basic three-panel layout, data model

**v0.2 — Campaigns + Sessions**
- Create/edit/delete campaigns
- Campaign dropdown switcher
- Create session entries with title + freeform body

**v0.3 — Entities + @-mentions**
- Create NPCs, PCs, locations, threads
- @-autocomplete in session editor
- Entity detail pages aggregating all mentions

**v0.4 — Your Character**
- PC dossier per campaign — personality, relationships, knowledge, vibes

**v0.5 — Polish**
- Rich text formatting (bold/italic/lists) ✅
- Per-campaign theming ✅ — ten accent palettes, each deriving the whole
  surface ramp in OKLCH so the app takes on the colour of the campaign you're in

**v0.6 — At the table (redesign phase 1: the plumbing)** ✅
- D&D Beyond sheet import ✅ — the PDF is parsed in the browser (pdf.js, widget annotations),
  never uploaded; empty dossier fields filled, items become entities, limited-use resources
  confirmed by hand; re-import shows a level-up diff and logs a milestone
- Play state ✅ — HP/temp, slots, resources, hit dice, rests (2024), conditions,
  concentration, death saves, casting; every tap logged during a live session
- Live sessions + table view ✅ — sheet and trackers beside a live log with marks and
  `npc:` / `q:` / `?:` / `!:` / `$:` shortcuts; "Previously on…" before play; screen kept awake
- Inking ✅ — after play, each log line and margin goes into the recap, becomes or joins an
  entity, or is tossed; recall prompts; backlinks kept intact
- Search ✅ — Ctrl/Cmd+K (or the Search buttons), prefix + forgiving fuzzy matching across
  sessions, entities, margins, log, dossier and sheet
- Installable app ✅ — manifest, offline app shell, update prompt, popup → redirect sign-in

**Next — redesign phases 2–3**
- The illuminated-manuscript look on top of the plumbing (logic lives in `src/lib/` + hooks)
- Real icons; retire the session editor's NPC roster now that `npc:` lines do its job
- Target: Galaxy Tab S9 FE landscape, 1316 × 648 CSS px at DPR 1.75 (≈300 px tall with the
  keyboard up)

## Data model

See [DATA_MODEL.md](./DATA_MODEL.md)
