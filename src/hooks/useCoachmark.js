// src/hooks/useCoachmark.js
// Tiny one-time-ever coachmark gate. Each coachmark has a unique id; once
// dismissed it never shows again for that person (persisted in localStorage,
// same pattern as other per-device prefs in this app).

import { useState, useEffect } from "react";

const KEY_PREFIX = "folyo_coachmark_seen:";

export function useCoachmark(id) {
    const [seen, setSeen] = useState(() => {
        try { return localStorage.getItem(KEY_PREFIX + id) === "1"; }
        catch { return true; } // fail safe — never show if storage is unavailable
    });

    useEffect(() => {
        try { setSeen(localStorage.getItem(KEY_PREFIX + id) === "1"); }
        catch {}
    }, [id]);

    const dismiss = () => {
        setSeen(true);
        try { localStorage.setItem(KEY_PREFIX + id, "1"); } catch {}
    };

    return { active: !seen, dismiss };
}