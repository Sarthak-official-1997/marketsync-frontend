// src/components/InstallAppButton.jsx
// "Install App" entry for the mobile More menu. Behavior by state:
//  - Already installed (running standalone)  -> "already installed on this device"
//  - iOS (can't install programmatically)    -> show manual Add-to-Home-Screen steps
//  - Android/Chrome with a captured prompt    -> native install prompt, then offer
//                                                to enable stock-alert notifications
//  - Otherwise (event not offered yet)        -> point to the browser menu
import { useEffect, useState } from "react";
import { getInstallState, promptInstall, subscribeInstall, isStandalone, isIos } from "../utils/installManager";
import { enablePush, pushSupported } from "../utils/push";
import { useToast } from "../context/ToastContext";

export default function InstallAppButton() {
    const toast = useToast();
    const [, force] = useState(0);
    const [showIosHelp, setShowIosHelp] = useState(false);

    // Re-render when install state changes (event captured / app installed).
    useEffect(() => subscribeInstall(() => force(n => n + 1)), []);

    const askEnableNotifications = async () => {
        if (!pushSupported()) return;
        try {
            await enablePush();
            toast.success("Notifications on — you'll get price-alert pushes");
        } catch { /* denied or push disabled server-side — non-fatal */ }
    };

    const handleClick = async () => {
        if (isStandalone()) { toast.info("App is already installed on this device"); return; }
        if (isIos())        { setShowIosHelp(true); return; }

        const outcome = await promptInstall();
        if (outcome === "accepted") {
            toast.success("Installing FOLYO…");
            await askEnableNotifications();
        } else if (outcome === "dismissed") {
            toast.info("Install cancelled");
        } else {
            toast.info('Install isn\'t available right now — use your browser menu → "Install app / Add to Home screen".');
        }
    };

    const { installed } = getInstallState();

    return (
        <>
            <button onClick={handleClick}
                    style={{
                        width: "100%", marginTop: 12,
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 14px",
                        background: installed ? "#1e293b"
                            : "linear-gradient(90deg,#7c3aed,#a855f7)",
                        border: "1px solid rgba(134,59,255,0.4)",
                        borderRadius: 12, cursor: "pointer",
                        color: "#fff", fontWeight: 700, fontSize: 13,
                    }}>
                <span style={{ fontSize: 20 }}>📲</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                    {installed ? "App installed" : "Install App"}
                </span>
                {!installed && (
                    <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>
                        + alerts
                    </span>
                )}
            </button>

            {showIosHelp && (
                <div onClick={() => setShowIosHelp(false)}
                     style={{ position: "fixed", inset: 0, zIndex: 9200,
                         background: "rgba(0,0,0,0.65)", display: "flex",
                         alignItems: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()}
                         style={{ background: "#0f172a", borderRadius: "16px 16px 0 0",
                             borderTop: "1px solid rgba(134,59,255,0.4)",
                             padding: 16, width: "100%",
                             paddingBottom: "calc(16px + env(safe-area-inset-bottom,0px))" }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginBottom: 12 }}>
                            <p style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                                Install FOLYO on iPhone
                            </p>
                            <button onClick={() => setShowIosHelp(false)}
                                    style={{ color: "#64748b", fontSize: 18, background: "none",
                                        border: "none", cursor: "pointer" }}>✕</button>
                        </div>
                        {[
                            { icon: "⬆️", text: "Tap the Share button in Safari's bottom bar" },
                            { icon: "➕", text: 'Tap "Add to Home Screen"' },
                            { icon: "✅", text: 'Tap "Add" — then open FOLYO from your home screen' },
                            { icon: "🔔", text: "Open it once and enable notifications for price alerts" },
                        ].map((s, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
                                background: "#1e293b", borderRadius: 12,
                                padding: "10px 12px", marginBottom: 8 }}>
                                <span style={{ fontSize: 18 }}>{s.icon}</span>
                                <span style={{ color: "#cbd5e1", fontSize: 12 }}>{s.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
