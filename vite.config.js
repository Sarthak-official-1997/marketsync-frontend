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
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png", "*.svg"],

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "folyo-api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https?:\/\/.*(logo|icon|image).*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "folyo-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
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