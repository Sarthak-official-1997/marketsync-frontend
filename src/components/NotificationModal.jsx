// src/components/NotificationModal.jsx
// Shown to clients when they have unacknowledged notifications from the Creator.
// The backdrop is NOT dismissible — client must acknowledge each message.
// Shown immediately on app load via App.jsx.

import { useState } from "react";
import { acknowledgeNotification } from "../api/admin";

export default function NotificationModal({ notifications, onAllAcknowledged }) {
    const [list, setList]   = useState(notifications);
    const [busy, setBusy]   = useState(null);    // recipientId currently being acked
    const [idx,  setIdx]    = useState(0);       // which message is on screen

    if (list.length === 0) return null;

    const current = list[idx];
    const total   = list.length;

    const handleAcknowledge = async () => {
        setBusy(current.recipientId);
        try {
            await acknowledgeNotification(current.recipientId);
            // Same immediate bell-refresh signal as the lightweight toast —
            // keeps the badge count in sync right away instead of waiting
            // for Layout.jsx's own next 30s poll.
            window.dispatchEvent(new Event("ms_notification_acknowledged"));
            const remaining = list.filter(n => n.recipientId !== current.recipientId);
            if (remaining.length === 0) {
                onAllAcknowledged();
            } else {
                setList(remaining);
                setIdx(0);
            }
        } catch (err) {
            console.error("Acknowledge failed:", err);
        } finally {
            setBusy(null);
        }
    };

    return (
        /* Full-screen backdrop — pointer-events blocks all app interaction */
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
             style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(0,0,0,0.75)" }}>

            <div className="w-full max-w-lg bg-slate-900 border border-slate-700
                            rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4
                                flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center
                                    justify-center flex-shrink-0">
                        <span className="text-amber-400 text-lg">📢</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-amber-400 font-bold text-sm">
                            Message from Sarthak
                        </p>
                        {total > 1 && (
                            <p className="text-amber-600 text-xs">
                                {idx + 1} of {total} messages
                            </p>
                        )}
                    </div>
                    {/* Progress dots for multiple messages */}
                    {total > 1 && (
                        <div className="flex gap-1.5 flex-shrink-0">
                            {list.map((_, i) => (
                                <div key={i}
                                     className={"w-2 h-2 rounded-full transition-colors " +
                                     (i === idx ? "bg-amber-400" : "bg-slate-700")} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Message body */}
                <div className="px-6 py-6">
                    <h2 className="text-white font-bold text-xl mb-3">{current.title}</h2>
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {current.message}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        disabled={busy === current.recipientId}
                        onClick={handleAcknowledge}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600
                                   text-slate-900 font-bold text-sm rounded-xl
                                   transition-colors disabled:opacity-60
                                   disabled:cursor-not-allowed">
                        {busy === current.recipientId
                            ? "Acknowledging…"
                            : idx < total - 1
                                ? "I Acknowledge — Next Message →"
                                : "I Acknowledge"}
                    </button>
                    <p className="text-slate-600 text-xs text-center mt-3">
                        You must acknowledge {total > 1 ? "all messages" : "this message"} to continue
                    </p>
                </div>
            </div>
        </div>
    );
}