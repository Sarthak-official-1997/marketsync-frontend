// src/utils/ownPortfolioScopePrefs.js
// STOCKS | MF | COMBINED — which of your own holdings feed into the
// "Your Portfolio" row shown at the top of Client Tracker. Separate from
// tracked clients' portfolioScope (a real backend field) because your OWN
// portfolio isn't a TrackedClient at all — this is a personal display
// preference, same device-level pattern as theme/home-view/bottom-nav.

const KEY = "folyo_own_portfolio_scope";
export const OWN_SCOPE_EVENT = "folyo:own-portfolio-scope-changed";

export function getOwnPortfolioScope() {
    try {
        const raw = localStorage.getItem(KEY);
        return ["STOCKS", "MF", "COMBINED"].includes(raw) ? raw : "COMBINED";
    } catch {
        return "COMBINED";
    }
}

export function setOwnPortfolioScope(scope) {
    const next = ["STOCKS", "MF", "COMBINED"].includes(scope) ? scope : "COMBINED";
    try {
        localStorage.setItem(KEY, next);
        window.dispatchEvent(new CustomEvent(OWN_SCOPE_EVENT, { detail: next }));
    } catch {}
    return next;
}