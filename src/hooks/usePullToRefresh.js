// src/hooks/usePullToRefresh.js
// Pull-down-at-top to refresh. Attaches to a scroll container; when the user is at
// the very top and drags down past a threshold, runs onRefresh(). Uses refs for
// live gesture values so the touch listeners are set up once (not rebuilt on every
// move). Coexists with useSwipeNav: this only reacts to downward pulls at top,
// that one only to horizontal swipes.
import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;   // px pulled (after resistance) to trigger refresh
const MAX       = 110;  // clamp

export function usePullToRefresh(scrollRef, onRefresh) {
    const [distance,   setDistanceState]   = useState(0);
    const [refreshing, setRefreshingState] = useState(false);

    const distanceRef   = useRef(0);
    const refreshingRef = useRef(false);
    const startY        = useRef(0);
    const armed         = useRef(false);

    const setDistance   = (d) => { distanceRef.current = d;   setDistanceState(d); };
    const setRefreshing = (b) => { refreshingRef.current = b; setRefreshingState(b); };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onStart = (e) => {
            if (e.touches.length !== 1 || refreshingRef.current) { armed.current = false; return; }
            armed.current = el.scrollTop <= 0;      // only arm at the very top
            startY.current = e.touches[0].clientY;
        };
        const onMove = (e) => {
            if (!armed.current || refreshingRef.current) return;
            const dy = e.touches[0].clientY - startY.current;
            if (dy <= 0) { if (distanceRef.current) setDistance(0); return; }  // pulling up → ignore
            const d = Math.min(MAX, dy * 0.5);       // resistance
            setDistance(d);
            if (d > 4 && e.cancelable) e.preventDefault();  // suppress native bounce while pulling
        };
        const onEnd = async () => {
            if (!armed.current) return;
            armed.current = false;
            if (distanceRef.current >= THRESHOLD && !refreshingRef.current) {
                setRefreshing(true);
                setDistance(THRESHOLD);
                try { await onRefresh?.(); } catch { /* ignore */ }
                finally { setRefreshing(false); setDistance(0); }
            } else {
                setDistance(0);
            }
        };

        el.addEventListener("touchstart",  onStart, { passive: true });
        el.addEventListener("touchmove",   onMove,  { passive: false });
        el.addEventListener("touchend",    onEnd,   { passive: true });
        el.addEventListener("touchcancel", onEnd,   { passive: true });
        return () => {
            el.removeEventListener("touchstart",  onStart);
            el.removeEventListener("touchmove",   onMove);
            el.removeEventListener("touchend",    onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, [scrollRef, onRefresh]);

    return { distance, refreshing, threshold: THRESHOLD };
}
