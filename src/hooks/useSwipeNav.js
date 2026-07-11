import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Primary bottom-nav routes, in left→right order. Swiping moves between these.
// "More" is a sheet, not a route, so it's intentionally not in the chain.
const ORDER = ["/stocks", "/stocks/holdings", "/stocks/transactions", "/stocks/watchlist"];

export function indexForPath(path) {
    if (path.startsWith("/stocks/holdings"))     return 1;
    if (path.startsWith("/stocks/transactions")) return 2;
    if (path.startsWith("/stocks/watchlist"))    return 3;
    if (path === "/stocks")                       return 0;
    return -1; // sub-pages (alerts, detail modals, etc.) are NOT in the swipe chain
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
export function useSwipeNav(rootRef, enabled) {
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

            const idx = indexForPath(location.pathname);
            if (idx < 0) return; // not on a swipeable main tab

            if (dx < 0 && idx < ORDER.length - 1) {
                navigate(ORDER[idx + 1]);   // swipe LEFT  → next tab (rightward in the bar)
            } else if (dx > 0 && idx > 0) {
                navigate(ORDER[idx - 1]);   // swipe RIGHT → previous tab
            }
        };

        root.addEventListener("touchstart", onStart, { passive: true });
        root.addEventListener("touchend",   onEnd,   { passive: true });
        return () => {
            root.removeEventListener("touchstart", onStart);
            root.removeEventListener("touchend",   onEnd);
        };
    }, [rootRef, enabled, navigate, location.pathname]);
}