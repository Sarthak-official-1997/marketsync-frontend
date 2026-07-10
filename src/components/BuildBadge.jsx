// ─────────────────────────────────────────────────────────────────────────
// DEV BUILD BADGE  —  TEMPORARY. Remove before sharing the app.
// Shows which build is actually live on the device, so you can tell whether a
// push has finished deploying. Values are injected at build time by vite.config
// (`define` block) from Vercel's git env vars.
//
// To remove later: delete this file, its <BuildBadge/> usage in App.jsx, and
// the `define` block in vite.config.js.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";

// Guarded reads so this never throws if the define block is missing (tests, etc).
const BUILD_ID   = typeof __BUILD_ID__   !== "undefined" ? __BUILD_ID__   : "dev";
const BUILD_MSG  = typeof __BUILD_MSG__  !== "undefined" ? __BUILD_MSG__  : "local dev build";
const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();

function relTime(iso) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 60)      return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)      return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)      return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function BuildBadge() {
    const [open, setOpen] = useState(true);
    const [, tick] = useState(0);

    // Re-render every 15s so the "built Xm ago" label stays live.
    useEffect(() => {
        const t = setInterval(() => tick(n => n + 1), 15000);
        return () => clearInterval(t);
    }, []);

    // Collapsed: a tiny tappable dot in the corner so it never blocks the UI.
    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                style={{
                    position: "fixed",
                    top: "calc(env(safe-area-inset-top, 0px) + 4px)",
                    left: "4px",
                    zIndex: 99999,
                    width: 14, height: 14,
                    borderRadius: 999,
                    background: "#22c55e",
                    border: "1px solid rgba(0,0,0,0.4)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }}
                title="Show build info"
            />
        );
    }

    return (
        <div
            onClick={() => setOpen(false)}
            style={{
                position: "fixed",
                top: "calc(env(safe-area-inset-top, 0px) + 4px)",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 99999,
                maxWidth: "94vw",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(6,10,20,0.92)",
                border: "1px solid rgba(134,59,255,0.5)",
                backdropFilter: "blur(6px)",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 11,
                lineHeight: 1.2,
                color: "#e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                cursor: "pointer",
                userSelect: "none",
            }}
            title="Tap to collapse"
        >
            <span style={{ color: "#22c55e", fontWeight: 700, flexShrink: 0 }}>
                #{BUILD_ID}
            </span>
            <span style={{ color: "#94a3b8", flexShrink: 0 }}>
                built {relTime(BUILD_TIME)}
            </span>
            <span
                style={{
                    color: "#cbd5e1",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                }}
            >
                {BUILD_MSG}
            </span>
        </div>
    );
}