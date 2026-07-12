// src/components/PushToggle.jsx
// Lets the user turn on/off real phone notifications for this device. Hidden on
// browsers that don't support push. On iPhone, push only works once the app is
// added to the home screen (installed PWA) — we show a hint in that case.
import { useEffect, useState } from "react";
import { pushSupported, getPushStatus, enablePush, disablePush } from "../utils/push";
import { useToast } from "../context/ToastContext";
import haptics from "../utils/haptics";

function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
}
function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function PushToggle() {
    const [status, setStatus] = useState({ supported: true, subscribed: false, permission: "default" });
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    useEffect(() => { getPushStatus().then(setStatus).catch(() => {}); }, []);

    if (!pushSupported()) {
        // iOS Safari (not installed) can't do push yet — nudge to install.
        if (isIOS() && !isStandalone()) {
            return (
                <p className="text-[11px] text-slate-500 leading-snug">
                    📲 To get phone notifications on iPhone, add FOLYO to your home screen first
                    (Share → Add to Home Screen), then open it from there.
                </p>
            );
        }
        return null;
    }

    const on = status.subscribed && status.permission === "granted";

    const enable = async () => {
        setBusy(true);
        try {
            await enablePush();
            haptics.success();
            toast.success("Phone notifications enabled on this device");
            setStatus(await getPushStatus());
        } catch (e) {
            toast.error(e.message || "Couldn't enable notifications");
        } finally { setBusy(false); }
    };

    const disable = async () => {
        setBusy(true);
        try {
            await disablePush();
            toast.info("Phone notifications turned off on this device");
            setStatus(await getPushStatus());
        } catch {
            toast.error("Couldn't turn off notifications");
        } finally { setBusy(false); }
    };

    return (
        <button
            onClick={on ? disable : enable}
            disabled={busy}
            className={"flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors " +
            (on
                ? "border-green-700/50 bg-green-900/20 text-green-400"
                : "border-[#863bff]/50 bg-[#863bff]/10 text-[#b794f6] hover:bg-[#863bff]/20") +
            (busy ? " opacity-60" : "")}>
            {busy ? "…" : on ? "✓ Notifications on (this device)" : "🔔 Enable phone notifications"}
        </button>
    );
}