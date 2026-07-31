// src/hooks/useCoachmark.js
// Tiny one-time-ever coachmark gate, scoped PER USER (not per device/browser)
// so testing multiple accounts on one phone doesn't make a fresh account
// inherit a previous account's dismissed state. CREATOR never sees coachmarks
// at all — Sarthak already knows the app on every device he uses.

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const KEY_PREFIX = "folyo_coachmark_seen:";

export function useCoachmark(id) {
    const { user, isCreator } = useAuth();
    const scopedKey = KEY_PREFIX + (user?.id || user?.username || "anon") + ":" + id;

    const [seen, setSeen] = useState(() => {
        try { return localStorage.getItem(scopedKey) === "1"; }
        catch { return true; }
    });

    useEffect(() => {
        try { setSeen(localStorage.getItem(scopedKey) === "1"); }
        catch {}
    }, [scopedKey]);

    const dismiss = () => {
        setSeen(true);
        try { localStorage.setItem(scopedKey, "1"); } catch {}
    };

    return { active: !isCreator && !seen, dismiss };
}