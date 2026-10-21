import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Theme colours are night vellum in gold ink (--m-bg in tokens.css, from
// inkTokens(gold, 'night')). The per-campaign inks are applied at runtime
// and can't reach the manifest.
const INK = '#110e09'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new version waits for "Reload" (UpdatePrompt) instead of reloading
      // the page by itself — never mid-session at the table.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Marginalia',
        short_name: 'Marginalia',
        description: 'Notes in the margins of someone else’s story — a TTRPG player journal.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: INK,
        background_color: INK,
        // A blackletter M in gold leaf on the gold ink's field (iconField).
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell and serve it for every route…
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        // …except Firebase Auth's own pages (/__/auth/handler, /__/firebase/init.json),
        // which have to reach the network or sign-in breaks.
        navigateFallbackDenylist: [/^\/__\//],
        // pdf.js (~1.7 MB) is only needed to import a sheet, which needs the network anyway.
        // Fonts: Latin subsets only — the others are never requested here.
        globIgnores: ['**/pdf-*.js', '**/pdf.worker*', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        cleanupOutdatedCaches: true,
        // No runtimeCaching: Google and Firebase API traffic is never handled by the
        // service worker. Firestore keeps its own offline cache (src/firebase.js).
      },
    }),
  ],
})
