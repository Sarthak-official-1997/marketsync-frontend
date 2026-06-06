// src/hooks/useMobile.js
// Single source of truth for mobile detection across the app.
// Uses matchMedia so it's reactive — updates if user resizes window.
// Breakpoint: < 768px = mobile (same as Tailwind's md breakpoint)

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useMobile() {
    const [isMobile, setIsMobile] = useState(
        () => window.innerWidth < MOBILE_BREAKPOINT
    );

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        setIsMobile(mq.matches);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return isMobile;
}

export default useMobile;