// src/utils/buildBadgePrefs.js
// Whether the creator-only build-info dot (bottom of BuildBadge.jsx) shows
// at all. Same localStorage + event pattern as bubblePrefs/homePreference —
// device-specific, since this is purely a personal dev-convenience toggle,
// not account data.

const KEY = "folyo_show_build_badge";
export const BUILD_BADGE_EVENT = "folyo:build-badge-pref-changed";

/** Defaults to shown (true) — matches the badge's existing always-on behaviour before this toggle existed. */
export function getShowBuildBadge() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw === null ? true : raw === "true";
    } catch {
        return true;
    }
}

export function setShowBuildBadge(show) {
    try {
        localStorage.setItem(KEY, show ? "true" : "false");
        window.dispatchEvent(new CustomEvent(BUILD_BADGE_EVENT, { detail: show }));
    } catch {}
    return show;
}