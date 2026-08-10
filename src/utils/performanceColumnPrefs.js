// src/utils/performanceColumnPrefs.js
// Which columns show on the Performance tab, and in what order — mirrors
// the same pattern as bottomNavPrefs.js: a stable list of candidate ids,
// a saved order + visibility set in localStorage, safe fallback to
// defaults for anything missing/corrupt/never-set. Stock (name/symbol)
// isn't a candidate here — it's always the first column, same as
// Google Finance's "Symbols" column isn't itself toggleable in their
// customize-columns dialog either.

const KEY = "folyo_performance_columns_v1";
export const PERFORMANCE_COLUMNS_EVENT = "folyo:performance-columns-changed";

// id must stay stable — it's what gets persisted.
export const COLUMN_CANDIDATES = [
    { id: "qty",       label: "Qty" },
    { id: "avgPrice",  label: "Avg. price" },
    { id: "ltp",       label: "LTP" },
    { id: "dayChange", label: "Day change" },
    { id: "value",     label: "Value" },
    { id: "gainLoss",  label: "Total gain/loss" },
];

const DEFAULT_ORDER = ["qty", "avgPrice", "ltp", "dayChange", "value", "gainLoss"];
const DEFAULT_VISIBLE = ["qty", "avgPrice", "ltp", "dayChange", "value", "gainLoss"]; // all on by default

/**
 * Returns the full candidate list, reordered per saved preference, each
 * tagged with whether it's currently visible. Callers filter on `.visible`
 * themselves rather than this function silently dropping hidden columns —
 * the customize modal needs to show hidden columns too (unchecked), just
 * the table rendering doesn't.
 */
export function getColumnPrefs() {
    let order = DEFAULT_ORDER;
    let visible = DEFAULT_VISIBLE;
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && Array.isArray(parsed.order)) order = parsed.order;
        if (parsed && Array.isArray(parsed.visible)) visible = parsed.visible;
    } catch {
        // fall through to defaults
    }

    const byId = Object.fromEntries(COLUMN_CANDIDATES.map(c => [c.id, c]));
    const ordered = order.map(id => byId[id]).filter(Boolean);
    // Any column added in a later release that predates this saved
    // preference gets appended at the end, visible by default, rather
    // than silently missing until the user re-saves.
    const missing = COLUMN_CANDIDATES.filter(c => !order.includes(c.id));

    return [...ordered, ...missing].map(c => ({ ...c, visible: visible.includes(c.id) }));
}

export function setColumnPrefs(orderedIds, visibleIds) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ order: orderedIds, visible: visibleIds }));
        window.dispatchEvent(new CustomEvent(PERFORMANCE_COLUMNS_EVENT, { detail: { order: orderedIds, visible: visibleIds } }));
    } catch {}
}