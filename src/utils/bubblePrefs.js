// src/utils/bubblePrefs.js
// Per-device preferences for the floating bubble (FAB): transparency + visibility.
// Stored in localStorage (device-specific by design — a bubble covering content on
// your phone isn't covering it on your laptop, so this preference shouldn't sync).
// Single source of truth: both SettingsPage (writer) and the future FAB (reader)
// import from here so the storage key can never drift between them.

const KEY = "folyo_bubble_prefs";

const DEFAULTS = {
    transparency: 0,   // 0 = fully opaque, 0.8 = very see-through (0–0.8 range)
    show: true,        // whether the bubble is rendered at all
};

/** Read the current bubble prefs, falling back to defaults for anything missing/corrupt. */
export function getBubblePrefs() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return {
            transparency: clampTransparency(parsed.transparency),
            show: typeof parsed.show === "boolean" ? parsed.show : DEFAULTS.show,
        };
    } catch {
        return { ...DEFAULTS };
    }
}

/** Merge-and-save a partial update, then broadcast so a mounted FAB can react live. */
export function setBubblePrefs(patch) {
    const next = { ...getBubblePrefs(), ...patch };
    next.transparency = clampTransparency(next.transparency);
    if (typeof next.show !== "boolean") next.show = DEFAULTS.show;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
        // Let any open component (e.g. the FAB) update without a reload.
        window.dispatchEvent(new CustomEvent("bubble:prefs-changed", { detail: next }));
    } catch {}
    return next;
}

export const BUBBLE_PREFS_DEFAULTS = DEFAULTS;
export const BUBBLE_PREFS_EVENT = "bubble:prefs-changed";

function clampTransparency(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return DEFAULTS.transparency;
    return Math.min(0.8, Math.max(0, n));
}