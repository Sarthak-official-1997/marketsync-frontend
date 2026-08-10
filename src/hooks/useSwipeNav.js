import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import haptics from "../utils/haptics";
import { getNavOrder } from "../utils/bottomNavPrefs";
import { getHomePath } from "../utils/homePreference";

// Was a hardcoded ["/stocks", "/stocks/holdings", "/stocks/transactions",
// "/stocks/watchlist"] array — predates the customizable bottom nav
// entirely, and never got updated when that shipped. Swiping ignored
// whatever order/tabs the user had actually configured in Settings and
// always walked the old fixed stock-only chain, regardless of what the
// bottom nav itself displayed. Now derived from the SAME source of truth
// the bottom nav uses (getNavOrder + getHomePath for the dynamic Home
// proxy), so swiping and tapping the bar always agree.
export function getSwipeOrder(isCreator) {
    return getNavOrder(isCreator).slice(0, 4)
        .map(c => c.dynamicHome ? getHomePath(isCreator) : c.path);
}

export function indexForPath(path, order) {
    // Exact match first (covers root-level entries like "/stocks", "/mf",
    // "/home", "/creator/client-tracker" that would otherwise also
    // startsWith-match a DIFFERENT entry's sub-route by accident).
    const exact = order.indexOf(path);
    if (exact >= 0) return exact;
    // Then prefix match, longest path first, so "/stocks/holdings" doesn't
    // get shadowed by a plain "/stocks" entry earlier in the order.
    const candidates = order
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p !== "/" && path.startsWith(p))
        .sort((a, b) => b.p.length - a.p.length);
    return candidates.length > 0 ? candidates[0].i : -1;
}

// Walk up from the touch target: is any ancestor an element that can actually
// scroll horizontally? If so, the user means to scroll THAT (a pill row, table,
// chart, filter strip) — we must not hijack the gesture for navigation.
function inHorizontalScroller(el, root) {
    let node = el;
    while (node && node !== root && node.nodeType === 1) {
        const s = window.getComputedStyle(node);
        if ((s.overflowX === "auto" || s.overflowX === "scroll") &&
            node.scrollWidth > node.clientWidth + 2) {
            return true;
        }
        node = node.parentNode;
    }
    return false;
}

const THRESHOLD = 70;   // min horizontal travel (px) to count as a nav swipe
const DOMINANCE = 1.7;  // horizontal must beat vertical by this factor (rules out scrolls)

/**
 * Attaches swipe-to-switch-tab behaviour to the element held by rootRef.
 * Listeners are passive (never block scrolling). Only fires on a clear,
 * long-enough, mostly-horizontal single-finger swipe that did not start
 * inside a horizontal scroller.
 */
export function useSwipeNav(rootRef, enabled, isCreator) {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const root = rootRef.current;
        if (!enabled || !root) return;

        let startX = 0, startY = 0, active = false;

        const onStart = (e) => {
            if (e.touches.length !== 1) { active = false; return; } // ignore multi-touch
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            active = !inHorizontalScroller(e.target, root);
        };

        const onEnd = (e) => {
            if (!active) return;
            active = false;
            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            if (Math.abs(dx) < THRESHOLD) return;                 // too short
            if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;  // too diagonal / vertical

            const order = getSwipeOrder(isCreator);
            const idx = indexForPath(location.pathname, order);
            if (idx < 0) return; // not on a swipeable main tab

            if (dx < 0 && idx < order.length - 1) {
                haptics.tap();
                navigate(order[idx + 1]);   // swipe LEFT  → next tab (rightward in the bar)
            } else if (dx > 0 && idx > 0) {
                haptics.tap();
                navigate(order[idx - 1]);   // swipe RIGHT → previous tab
            }
        };

        root.addEventListener("touchstart", onStart, { passive: true });
        root.addEventListener("touchend",   onEnd,   { passive: true });
        return () => {
            root.removeEventListener("touchstart", onStart);
            root.removeEventListener("touchend",   onEnd);
        };
    }, [rootRef, enabled, navigate, location.pathname, isCreator]);
}