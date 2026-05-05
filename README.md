# Marginalia

> notes in the margins of someone else's story

A cross-campaign player journal for TTRPGs. Hybrid freeform-plus-structured journaling: write naturally, @-mention NPCs and threads inline, and the structure builds itself.

## Stack

- Vite + React
- Firebase Auth (Google Sign-In) + Firestore
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
- Rich text formatting (bold/italic/lists)
- Search across entries
- Per-campaign theming

## Data model

See [DATA_MODEL.md](./DATA_MODEL.md)
