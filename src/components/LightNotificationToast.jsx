// src/components/LightNotificationToast.jsx
// Non-blocking notification card for things that DON'T require acknowledgment
// (personal note reminders, price alerts). Unlike NotificationModal (which is
// deliberately blocking, for genuine Creator broadcasts), these stack quietly
// in a corner, dismiss with one tap ("OK" / "Dismiss" — never "I Acknowledge"),
// and never demand attention before the app is usable.

import { useState } from "react";
import { useMobile } from "../hooks/useMobile";
import { acknowledgeNotification } from "../api/admin";

// Picks an icon based on simple heuristics in the title — reminders and
// price alerts already prefix their titles distinctly (⏰ for note reminders,
// 🎯/🎉/⚠️ for trade-setup levels, [Alert] for simple alerts).
function iconFor(title) {
    if (!title) return "🔔";
    if (title.startsWith("⏰")) return "⏰";
    if (title.startsWith("🎯") || title.startsWith("🎉") || title.startsWith("⚠️")) return "";
    return "🔔";
}

export default function LightNotificationToast({ notifications, onDismissed }) {
    const isMobile = useMobile();
    const [dismissing, setDismissing] = useState(null);

    if (!notifications || notifications.length === 0) return null;

    const dismiss = async (recipientId) => {
        setDismissing(recipientId);
        try {
            await acknowledgeNotification(recipientId);
        } catch {
            // Even if the network call fails, remove it from view locally —
            // a lightweight reminder isn't worth blocking on a retry loop.
        } finally {
            onDismissed(recipientId);
            setDismissing(null);
        }
    };

    // Show at most the 3 most recent stacked; older ones queue silently.
    const visible = notifications.slice(0, 3);

    return (
        <div className="fixed z-[9400] flex flex-col gap-2 pointer-events-none"
             style={isMobile ? {
                 top: "calc(env(safe-area-inset-top, 0px) + 64px)",
                 left: "12px", right: "12px",
             } : {
                 top: "76px", right: "20px", width: "340px",
             }}>
            {visible.map(n => (
                <div key={n.recipientId}
                     className="pointer-events-auto bg-slate-800 border border-slate-700/70
                                rounded-2xl shadow-2xl overflow-hidden"
                     style={{ animation: "toastSlideIn .25s ease" }}>
                    <style>{"@keyframes toastSlideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}"}</style>
                    <div className="flex items-start gap-2.5 px-3.5 py-3">
                        <span className="text-lg flex-shrink-0">{iconFor(n.title)}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold leading-snug">{n.title}</p>
                            {n.message && (
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                                    {n.message}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="px-3.5 pb-3 flex justify-end">
                        <button
                            disabled={dismissing === n.recipientId}
                            onClick={() => dismiss(n.recipientId)}
                            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50
                                       text-slate-200 text-xs font-semibold rounded-lg transition-colors">
                            {dismissing === n.recipientId ? "…" : "OK"}
                        </button>
                    </div>
                </div>
            ))}
            {notifications.length > visible.length && (
                <p className="pointer-events-none text-center text-slate-500 text-[11px]">
                    +{notifications.length - visible.length} more
                </p>
            )}
        </div>
    );
}