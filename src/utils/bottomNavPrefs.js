// src/utils/bottomNavPrefs.js
// Fully user-orderable bottom navigation — every possible destination
// (Home, Stocks pages, MF pages, Client Tracker for creators) in one list
// the user reorders themselves in Settings. The first 4, in that order,
// become the primary bar; everything else falls into "More". This
// supersedes the old "stocks-primary vs MF-primary" toggle entirely — a
// user who wants Home, MF Holdings, Stock Watchlist, and Client Tracker
// as their 4 main tabs can now have exactly that, in exactly that order,
// rather than being locked into one fund type's whole tab set at a time.

const KEY = "folyo_bottom_nav_order";
export const BOTTOM_NAV_EVENT = "folyo:bottom-nav-order-changed";

// id must stay stable — it's what gets persisted. label/icon/path are
// resolved at render time in Layout.jsx so this file stays a plain data
// module with no JSX or icon dependencies.
export const NAV_CANDIDATES = [
    { id: "home",       label: "Home",         path: "/home" },
    { id: "market",     label: "Market",       path: "/stocks" },
    { id: "holdings",   label: "Holdings",     path: "/stocks/holdings" },
    { id: "trades",     label: "Trades",       path: "/stocks/transactions" },
    { id: "watchlist",  label: "Watchlist",    path: "/stocks/watchlist" },
    { id: "mf-market",     label: "MF Market",     path: "/mf" },
    { id: "mf-holdings",   label: "MF Holdings",   path: "/mf/holdings" },
    { id: "mf-trades",     label: "MF Trades",     path: "/mf/transactions" },
    { id: "mf-watchlist",  label: "MF Watchlist",  path: "/mf/watchlist" },
    { id: "client-tracker", label: "Client Tracker", path: "/creator/client-tracker", creatorOnly: true },
];

const DEFAULT_ORDER = ["home", "market", "holdings", "trades", "watchlist",
    "mf-market", "mf-holdings", "mf-trades", "mf-watchlist", "client-tracker"];

/**
 * Returns the full candidate list (each with label/path resolved from
 * NAV_CANDIDATES), reordered per the saved preference, filtered to what
 * this user can actually see (creator-only items dropped for non-creators).
 * Falls back to DEFAULT_ORDER for anything missing/corrupt/never-set.
 */
export function getNavOrder(isCreator) {
    let order;
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        order = Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ORDER;
    } catch {
        order = DEFAULT_ORDER;
    }

    const byId = Object.fromEntries(NAV_CANDIDATES.map(c => [c.id, c]));
    // Any id in the saved order that no longer exists (future-proofing
    // against a candidate being removed later) is silently dropped rather
    // than crashing the nav.
    const ordered = order.map(id => byId[id]).filter(Boolean);
    // Anything NEW since this was last saved (a candidate added in a later
    // release) gets appended at the end, so it's still reachable via More
    // rather than silently missing until the user manually re-saves.
    const missing = NAV_CANDIDATES.filter(c => !order.includes(c.id));

    return [...ordered, ...missing].filter(c => !c.creatorOnly || isCreator);
}

export function setNavOrder(orderedIds) {
    try {
        localStorage.setItem(KEY, JSON.stringify(orderedIds));
        window.dispatchEvent(new CustomEvent(BOTTOM_NAV_EVENT, { detail: orderedIds }));
    } catch {}
}