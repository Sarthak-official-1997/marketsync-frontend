// src/components/FloatingBubble.jsx
// Global floating launcher (FAB). Draggable, snaps to the nearest side, and
// reads per-device prefs (show + transparency) from bubblePrefs. Tapping it
// fans out two sub-bubbles: 📝 Notes and ✨ AI Folyo. Mounted once in Layout.

import { useState, useEffect, useRef, useCallback } from "react";
import AiChatModal from "./AiChatModal";
import { useToast } from "../context/ToastContext";
import {
    getBubblePrefs, setBubblePrefs, BUBBLE_PREFS_EVENT,
} from "../utils/bubblePrefs";

const POS_KEY = "folyo_bubble_pos";   // remembers where the user parked it (per device)
const SIZE    = 52;                    // bubble diameter (px)
const MARGIN  = 12;                    // min gap from screen edges

function loadPos() {
    try {
        const raw = localStorage.getItem(POS_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    // default: bottom-right, sitting above the mobile bottom-nav
    return { x: window.innerWidth - SIZE - MARGIN, y: window.innerHeight - SIZE - 96 };
}

export default function FloatingBubble() {
    const toast = useToast();
    const [prefs,    setPrefs]    = useState(getBubblePrefs());
    const [pos,      setPos]      = useState(loadPos);
    const [open,     setOpen]     = useState(false);   // sub-bubbles fanned out
    const [showAi,   setShowAi]   = useState(false);
    const [dragging, setDragging] = useState(false);

    const dragState = useRef({ active: false, moved: false, dx: 0, dy: 0 });

    // React to Settings changes live (show/transparency) without a reload.
    useEffect(() => {
        const onChange = (e) => setPrefs(e.detail || getBubblePrefs());
        window.addEventListener(BUBBLE_PREFS_EVENT, onChange);
        return () => window.removeEventListener(BUBBLE_PREFS_EVENT, onChange);
    }, []);

    // Keep the bubble on-screen if the viewport resizes (rotation, etc.).
    useEffect(() => {
        const onResize = () => setPos(p => clampToViewport(p));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const persistPos = useCallback((p) => {
        try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
    }, []);

    // -- Drag handling (pointer events cover mouse + touch) --------------------
    const onPointerDown = (e) => {
        const startX = e.clientX, startY = e.clientY;
        dragState.current = { active: true, moved: false, dx: startX - pos.x, dy: startY - pos.y };
        setDragging(true);

        const onMove = (ev) => {
            if (!dragState.current.active) return;
            const nx = ev.clientX - dragState.current.dx;
            const ny = ev.clientY - dragState.current.dy;
            if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
                dragState.current.moved = true;
                if (open) setOpen(false);   // collapse while dragging
            }
            setPos(clampToViewport({ x: nx, y: ny }));
        };
        const onUp = () => {
            dragState.current.active = false;
            setDragging(false);
            setPos(p => {
                // Snap horizontally to whichever side is nearer.
                const snapped = {
                    ...p,
                    x: (p.x + SIZE / 2) < window.innerWidth / 2
                        ? MARGIN
                        : window.innerWidth - SIZE - MARGIN,
                };
                persistPos(snapped);
                return snapped;
            });
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const onBubbleClick = () => {
        // A drag shouldn't count as a tap.
        if (dragState.current.moved) { dragState.current.moved = false; return; }
        setOpen(v => !v);
    };

    if (!prefs.show) return null;

    const opacity = Math.max(0.2, 1 - (prefs.transparency || 0));
    // Sub-bubbles fan upward; if the bubble is snapped low, they stack above it.
    const onLeft = pos.x < window.innerWidth / 2;

    return (
        <>
            {/* Sub-bubbles */}
            {open && (
                <>
                    <SubBubble
                        pos={{ x: pos.x, y: pos.y - 64 }}
                        emoji="✨" label="AI Folyo" color="#7c3aed" onLeft={onLeft}
                        opacity={opacity}
                        onClick={() => { setOpen(false); setShowAi(true); }}
                    />
                    <SubBubble
                        pos={{ x: pos.x, y: pos.y - 124 }}
                        emoji="📝" label="Notes" color="#0891b2" onLeft={onLeft}
                        opacity={opacity}
                        onClick={() => {
                            setOpen(false);
                            // Notes panel isn't built yet — stub until that unit lands.
                            toast.info("Notes are coming soon");
                        }}
                    />
                </>
            )}

            {/* Main bubble */}
            <button
                onPointerDown={onPointerDown}
                onClick={onBubbleClick}
                aria-label="Quick actions"
                style={{
                    position: "fixed",
                    left: pos.x, top: pos.y,
                    width: SIZE, height: SIZE,
                    borderRadius: "50%",
                    zIndex: 9500,
                    opacity,
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    border: "1px solid rgba(148,163,184,0.35)",
                    boxShadow: dragging
                        ? "0 8px 26px rgba(124,58,237,0.55)"
                        : "0 4px 16px rgba(0,0,0,0.45)",
                    color: "white", fontSize: 22, cursor: "grab",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    touchAction: "none",
                    transition: dragging ? "none" : "box-shadow .15s ease, opacity .15s ease",
                    userSelect: "none",
                }}
            >
                <span style={{
                    transition: "transform .2s ease",
                    transform: open ? "rotate(45deg)" : "rotate(0deg)",
                    lineHeight: 1,
                }}>
                    {open ? "✕" : "＋"}
                </span>
            </button>

            {showAi && <AiChatModal onClose={() => setShowAi(false)} />}
        </>
    );
}

// -- A single fan-out action bubble -------------------------------------------
function SubBubble({ pos, emoji, label, color, onClick, onLeft, opacity }) {
    return (
        <button
            onClick={onClick}
            style={{
                position: "fixed",
                left: pos.x, top: pos.y,
                zIndex: 9499,
                display: "flex", alignItems: "center", gap: 8,
                flexDirection: onLeft ? "row" : "row-reverse",
                background: "transparent", border: "none",
                cursor: "pointer", opacity,
                animation: "fabPop .16s ease",
            }}
        >
            <span style={{
                width: 44, height: 44, borderRadius: "50%",
                background: color, color: "white", fontSize: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)", flexShrink: 0,
            }}>
                {emoji}
            </span>
            <span style={{
                background: "#1e293b", color: "#e2e8f0",
                fontSize: 12, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                border: "1px solid rgba(51,65,85,0.6)",
                whiteSpace: "nowrap",
            }}>
                {label}
            </span>
        </button>
    );
}

// Clamp a position so the whole bubble stays within the viewport.
function clampToViewport(p) {
    const maxX = window.innerWidth  - SIZE - MARGIN;
    const maxY = window.innerHeight - SIZE - MARGIN;
    return {
        x: Math.max(MARGIN, Math.min(maxX, p.x)),
        y: Math.max(MARGIN, Math.min(maxY, p.y)),
    };
}