// src/utils/columnPrefsFactory.js
// Generic "which columns show, in what order" preference — one factory
// instead of a hand-copied prefs file per table (Performance, MF Holdings,
// Stocks Holdings, Watchlist, Transactions all need the exact same shape:
// a stable candidate list, a saved order + visibility set in localStorage,
// safe fallback to defaults for anything missing/corrupt/never-set).
//
// Usage per table:
//   const perf = createColumnPrefs("folyo_performance_columns_v1", [
//       { id: "qty", label: "Qty" }, ...
//   ]);
//   perf.getColumnPrefs() / perf.setColumnPrefs(order, visible) / perf.EVENT

export function createColumnPrefs(storageKey, candidates, defaultVisibleIds = null) {
    const EVENT = storageKey + ":changed";
    const defaultOrder = candidates.map(c => c.id);
    const defaultVisible = defaultVisibleIds || defaultOrder; // all on by default

    function getColumnPrefs() {
        let order = defaultOrder;
        let visible = defaultVisible;
        try {
            const raw = localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && Array.isArray(parsed.order)) order = parsed.order;
            if (parsed && Array.isArray(parsed.visible)) visible = parsed.visible;
        } catch {
            // fall through to defaults
        }

        const byId = Object.fromEntries(candidates.map(c => [c.id, c]));
        const ordered = order.map(id => byId[id]).filter(Boolean);
        // Anything added to `candidates` in a later release that predates
        // this saved preference gets appended at the end, visible by
        // default, rather than silently missing until re-saved.
        const missing = candidates.filter(c => !order.includes(c.id));

        return [...ordered, ...missing].map(c => ({ ...c, visible: visible.includes(c.id) }));
    }

    function setColumnPrefs(orderedIds, visibleIds) {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ order: orderedIds, visible: visibleIds }));
            window.dispatchEvent(new CustomEvent(EVENT, { detail: { order: orderedIds, visible: visibleIds } }));
        } catch {}
    }

    return { getColumnPrefs, setColumnPrefs, EVENT, candidates };
}