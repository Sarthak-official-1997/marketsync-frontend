// src/utils/freshness.js
// Tracks when portfolio/price data last successfully arrived from the server, so
// the UI can honestly show "Prices as of 3:42 PM". Stamped centrally by the axios
// response interceptor (see api/portfolio.js) — no per-page wiring needed.
import { useSyncExternalStore } from "react";

let lastUpdated = null;              // epoch ms of the most recent successful GET
const listeners = new Set();

export function stampFresh(ts = Date.now()) {
    lastUpdated = ts;
    listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function getSnapshot() { return lastUpdated; }

// Returns the epoch ms of the last successful data fetch (or null). Re-renders
// the component whenever fresh data arrives.
export function useLastUpdated() {
    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function formatAsOf(ts) {
    if (!ts) return "";
    try {
        return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
}
