// src/hooks/useCoachmark.js
// Tiny one-time-ever coachmark gate, scoped PER USER (not per device/browser).
// A plain device-wide key would make every account tested on the same phone
// inherit whichever coachmarks the previous account already dismissed —
// exactly the bug found in SetupChecklist's STEPS_KEY. Scoping by user id
// avoids that: a fresh account always sees its own coachmarks once.

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const KEY_PREFIX = "folyo_coachmark_seen:";

export function useCoachmark(id) {
    const { user } = useAuth();
    const scopedKey = KEY_PREFIX + (user?.id || user?.username || "anon") + ":" + id;

    const [seen, setSeen] = useState(() => {
        try { return localStorage.getItem(scopedKey) === "1"; }
        catch { return true; } // fail safe — never show if storage is unavailable
    });

    useEffect(() => {
        try { setSeen(localStorage.getItem(scopedKey) === "1"); }
        catch {}
    }, [scopedKey]);

    const dismiss = () => {
        setSeen(true);
        try { localStorage.setItem(scopedKey, "1"); } catch {}
    };

    return { active: !seen, dismiss };
}