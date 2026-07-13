import { defineConfig }  from "vite";
import react             from "@vitejs/plugin-react";
import tailwindcss       from "@tailwindcss/vite";
import { VitePWA }       from "vite-plugin-pwa";

export default defineConfig({
  // ── DEV BUILD BADGE support (remove this whole `define` block when you
  //    retire the badge). Vercel sets these env vars automatically on every
  //    deploy — no dashboard config needed. Locally they're undefined, so we
  //    fall back to "local" / build timestamp.
  define: {
    __BUILD_ID__:   JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)),
    __BUILD_MSG__:  JSON.stringify(process.env.VERCEL_GIT_COMMIT_MESSAGE || "local dev build"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  plugins: [
    react(),
    tailwindcss(),   // Tailwind v4 — must come before VitePWA

    VitePWA({
      // "prompt" (not "autoUpdate"): when a new deploy is detected the new service
      // worker WAITS instead of swapping silently, so we can surface a visible
      // "New version — Refresh" toast (see PwaUpdatePrompt). This directly attacks
      // the deploy-gap: the user sees the fresh build is ready and applies it in one
      // tap, in the current session, instead of unknowingly sitting on a stale one.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/*.png", "*.svg"],

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Pull our push/notificationclick handlers into the generated SW so push
        // notifications work even when the app is closed.
        importScripts: ["/push-sw.js"],
        // Deploy-gap hygiene: drop old precache buckets on every new deploy so a
        // stale build can't linger. Paired with registerType:"prompt" above and the
        // PwaUpdatePrompt toast, the app surfaces the newest build for a one-tap apply
        // (and BuildBadge confirms which build is actually live).
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA deep links keep working offline — but never fall back API/auth to HTML.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],

        runtimeCaching: [
          // 1) Brand logos (logo.uplead.com) — these never change. Long-lived,
          //    host-scoped, CacheFirst. Biggest cheap win: we refetch these a lot.
          {
            urlPattern: ({ url }) => url.hostname.includes("uplead"),
            handler: "CacheFirst",
            options: {
              cacheName: "folyo-logos",
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2) READ-ONLY MARKET DATA — prices, charts, returns, indices, stock/MF
          //    search, MF scheme + NAV. These aren't user-editable, so a few seconds
          //    of staleness is harmless, and instant cached render keeps the app fast
          //    (and cold-start-friendly). StaleWhileRevalidate = show cache now,
          //    refresh in background. NOTE: /watchlist/prices matches here (price data)
          //    but bare /watchlist does NOT — that falls through to NetworkFirst below.
          {
            urlPattern: /\/api\/(market-data\/|stocks\/search|stocks\/[^/]+\/price|watchlist\/prices|mf\/schemes\/)/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "folyo-readonly",
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 3) EVERYTHING ELSE UNDER /api = USER-MUTABLE DATA (watchlist, holdings,
          //    transactions, alerts, board, notifications, MF holdings/watchlist/txns,
          //    portfolio summaries, creator/admin…). NetworkFirst so the user's OWN
          //    writes always show without a manual refresh — the fresh response wins;
          //    cache is only a fallback when the backend is cold/slow
          //    (networkTimeoutSeconds) or the device is offline. This is the default,
          //    so any *new* mutable endpoint is correct automatically. Fixes the whole
          //    class of "I changed something but had to refresh to see it" bugs
          //    (deleted alert reappearing, added watchlist item missing, etc.).
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "folyo-user-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 5 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 4) Any other images.
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "folyo-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      manifest: {
        name: "FOLYO — Portfolio Tracker",
        short_name: "FOLYO",
        description: "Track your stocks and mutual funds with live prices, AI insights, and FIFO P&L",
        start_url: "/stocks",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#0a0f1e",
        theme_color: "#863bff",
        categories: ["finance", "productivity"],
        icons: [
          { src: "/icons/icon-72.png",  sizes: "72x72",   type: "image/png", purpose: "any" },
          { src: "/icons/icon-96.png",  sizes: "96x96",   type: "image/png", purpose: "any" },
          { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png", purpose: "any" },
          { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png", purpose: "any" },
          { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png", purpose: "any" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },

      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});