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
          // 2) Charts / returns / NAV history — heavier payloads that change slowly
          //    intraday. Show cached instantly, revalidate in the background.
          {
            urlPattern: /\/(market-data\/(chart|index-chart|returns)|nav-history)/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "folyo-charts",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2b) USER-MUTABLE DATA (watchlist, holdings, portfolio, alerts) — must
          //     reflect the user's own writes immediately, so it must NOT be served
          //     stale. NetworkFirst = fresh when online; falls back to cache only if
          //     the backend is cold/slow (networkTimeoutSeconds) or the device is
          //     offline. This fixes the bug where "added to watchlist" toasted but the
          //     item didn't appear — StaleWhileRevalidate was returning the pre-add
          //     list. Placed BEFORE the /api catch-all: Workbox matches in order.
          {
            urlPattern: /\/api\/(watchlist|holdings|portfolio|alerts)(\/|\?|$)/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "folyo-user-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 5 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 3) Everything else under /api (prices, indices, quotes…) —
          //    instant cached render, revalidate in the background. Short TTL so it
          //    never *looks* stale; only GETs are cached (mutations pass through).
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "folyo-api-cache",
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