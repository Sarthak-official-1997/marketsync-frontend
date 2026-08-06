// src/utils/homePreference.js
// The "default primary view" preference — Stocks-first (default) or Mutual
// Funds-first. Device-specific by design, same reasoning as bubblePrefs:
// this changes what the app opens to and which tab set leads the bottom
// nav, which is inherently a per-device UI choice, not account data that
// needs to sync across devices.
//
// Single source of truth for the storage key + event name, so the Settings
// toggle (writer) and App.jsx's home route + Layout's bottom nav (readers)
// can never drift out of sync with each other.

const KEY = "folyo_default_view";

export const DEFAULT_VIEW = {
    STOCKS: "stocks",
    MUTUAL_FUNDS: "mutual_funds",
};

const DEFAULTS = DEFAULT_VIEW.STOCKS;

/** Read the current default-view preference, falling back to Stocks for anything missing/corrupt. */
export function getDefaultView() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw === DEFAULT_VIEW.MUTUAL_FUNDS ? DEFAULT_VIEW.MUTUAL_FUNDS : DEFAULTS;
    } catch {
        return DEFAULTS;
    }
}

/** Save the preference and broadcast so any mounted component (home route, bottom nav) updates without a reload. */
export function setDefaultView(view) {
    const next = view === DEFAULT_VIEW.MUTUAL_FUNDS ? DEFAULT_VIEW.MUTUAL_FUNDS : DEFAULT_VIEW.STOCKS;
    try {
        localStorage.setItem(KEY, next);
        window.dispatchEvent(new CustomEvent(DEFAULT_VIEW_EVENT, { detail: next }));
    } catch {}
    return next;
}

export const DEFAULT_VIEW_EVENT = "folyo:default-view-changed";