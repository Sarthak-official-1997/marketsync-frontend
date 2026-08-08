// src/components/PrivacyBlackoutOverlay.jsx
// Full-screen privacy shield — clicking the eye icon anywhere in the app now
// hides EVERYTHING, not just the numeric values. A heavy blur + near-opaque
// layer covers the entire viewport at the highest z-index in the app (above
// every existing modal), leaving only the eye icon itself visible.
//
// Restoring the screen requires clicking THAT SPECIFIC ICON — not tapping
// anywhere on the overlay. This is deliberate: the whole point of this
// feature is that someone else might be looking at the screen right now,
// so an accidental tap anywhere reopening everything would defeat the
// purpose. Only a precise click on the eye undoes the blackout.

import { usePrivacy } from "../context/PrivacyContext";

export default function PrivacyBlackoutOverlay() {
    const { hidden, toggle } = usePrivacy();

    if (!hidden) return null;

    return (
        <div
            style={{
                position: "fixed", inset: 0,
                zIndex: 999999, // above BuildBadge, above every modal — this must win every stacking fight
                background: "rgba(5,8,15,0.97)",
                backdropFilter: "blur(40px) saturate(0%)",
                WebkitBackdropFilter: "blur(40px) saturate(0%)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 16,
                // No onClick, no cursor:pointer here — the backdrop itself is
                // deliberately inert. Only the icon below is interactive.
            }}
        >
            <button
                onClick={toggle}
                title="Click to show your screen again"
                style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                     stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
            </button>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500 }}>
                Click the eye to show your screen
            </p>
        </div>
    );
}