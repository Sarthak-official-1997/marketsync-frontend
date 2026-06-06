import { useState, useEffect } from "react";

export function useMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const h  = (e) => setIsMobile(e.matches);
        mq.addEventListener("change", h);
        setIsMobile(mq.matches);
        return () => mq.removeEventListener("change", h);
    }, []);
    return isMobile;
}

export default useMobile;