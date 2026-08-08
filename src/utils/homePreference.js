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
    // Creator-only — the Settings UI only ever offers this option to
    // creators, but this util has no access to auth context (utils
    // shouldn't depend on it), so it can't enforce that on its own. The
    // actual gate lives where the preference gets CONSUMED (App.jsx's home
    // route), which does have isCreator — this constant just needs to exist
    // so storage/events have a valid third value to carry.
    CLIENT_TRACKER: "client_tracker",
};

const DEFAULTS = DEFAULT_VIEW.STOCKS;
const VALID_VIEWS = Object.values(DEFAULT_VIEW);

/** Read the current default-view preference, falling back to Stocks for anything missing/corrupt. */
export function getDefaultView() {
    try {
        const raw = localStorage.getItem(KEY);
        return VALID_VIEWS.includes(raw) ? raw : DEFAULTS;
    } catch {
        return DEFAULTS;
    }
}

/** Save the preference and broadcast so any mounted component (home route, bottom nav) updates without a reload. */
export function setDefaultView(view) {
    const next = VALID_VIEWS.includes(view) ? view : DEFAULT_VIEW.STOCKS;
    try {
        localStorage.setItem(KEY, next);
        window.dispatchEvent(new CustomEvent(DEFAULT_VIEW_EVENT, { detail: next }));
    } catch {}
    return next;
}

export const DEFAULT_VIEW_EVENT = "folyo:default-view-changed";

/**
 * Turns the stored preference into an actual route path — the single
 * source of truth for "where does home actually go," used by BOTH the
 * initial "/" redirect (App.jsx) and every "take me home" affordance in
 * the app (the FOLYO logo, currently). Previously the logo was hardcoded
 * to "/stocks" in two separate places (mobile + desktop header) and never
 * read this preference at all — clicking it always went to Stocks
 * regardless of what was chosen in Settings, which is the actual bug this
 * fixes. isCreator is checked here too, same reasoning as the "/" route:
 * a stale CLIENT_TRACKER preference (e.g. after a role change on a shared
 * device) should never send a non-creator toward a page that would just
 * 403 on them.
 */
export function getHomePath(isCreator) {
    const pref = getDefaultView();
    if (pref === DEFAULT_VIEW.CLIENT_TRACKER && isCreator) return "/creator/client-tracker";
    if (pref === DEFAULT_VIEW.MUTUAL_FUNDS) return "/mf/holdings";
    return "/stocks";
}