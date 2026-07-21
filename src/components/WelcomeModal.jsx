import { useState } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";

// Persists as a floating card on dashboard until all steps done.
// STEPS_KEY is scoped per-user — without this, testing multiple accounts on
// the same device/browser would make every account inherit whichever steps
// the LAST account had already marked done (or fully complete), silently
// hiding the checklist for every subsequent fresh account on that device.
export function SetupChecklist({ user, onDismiss }) {
    const STEPS_KEY = `ms_setup_steps_${user?.id || user?.username || "anon"}`;

    const loadDone = () => {
        try { return JSON.parse(localStorage.getItem(STEPS_KEY) || "[]"); }
        catch { return []; }
    };

    const [done, setDone] = useState(loadDone);
    const isMobile = useMobile();
    // On mobile, start collapsed to a small pill so it never eats screen space
    // or fights the bottom nav / floating bubble for the same corner.
    const [expanded, setExpanded] = useState(!isMobile);

    const steps = [
        { id: "registered", label: "Account created",                  sub: "You're in",                            alwaysDone: true },
        { id: "board",      label: "Pin a stock to your board",        sub: "Search any stock → click Board"                        },
        { id: "transaction",label: "Add your first transaction (optional)", sub: "Manually or via AI import"                        },
        { id: "alert",      label: "Set a price alert",                sub: "Open any stock → tap the bell"                         },
        { id: "watchlist",  label: "Add a stock to your watchlist",    sub: "Open any stock → tap the star"                         },
    ];

    const markDone = (id) => {
        const next = [...new Set([...done, id])];
        setDone(next);
        try { localStorage.setItem(STEPS_KEY, JSON.stringify(next)); } catch {}
    };

    const isDone  = (id) => id === "registered" || done.includes(id);
    const allDone = steps.every(s => isDone(s.id));
    const doneCount = steps.filter(s => isDone(s.id)).length;

    if (allDone) return null;

    // ── Mobile, collapsed: a small pill on the LEFT (bottom nav sits below,
    // the floating bubble owns the right side) — tap to expand into the
    // full checklist. Never permanently occupies screen space on a phone. ──
    if (isMobile && !expanded) {
        return createPortal(
            <button
                onClick={() => setExpanded(true)}
                className="bg-slate-900 border border-amber-500/50 text-white"
                style={{
                    position: "fixed",
                    bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 10px)",
                    left: "12px", zIndex: 150,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 999,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    fontSize: 12, fontWeight: 600,
                }}>
                <span>✨</span>
                <span>Setup {doneCount}/{steps.length}</span>
            </button>,
            document.body
        );
    }

    return createPortal(
        <div className="bg-slate-900 border border-slate-700/60" style={isMobile ? {
            position: "fixed",
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 10px)",
            left: "12px", right: "12px", zIndex: 150,
            borderRadius: "16px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            overflow: "hidden",
        } : {
            position: "fixed", bottom: "24px", right: "24px",
            width: "250px", maxWidth: "calc(100vw - 32px)", zIndex: 150,
            borderRadius: "16px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            overflow: "hidden",
        }}>
            {/* Amber top line */}
            <div style={{ height: "2px", background: "linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)" }} />
            <div style={{ padding: "12px 14px" }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                    <div style={{ width:"26px", height:"26px", background:"#FAEEDA", borderRadius:"8px",
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px" }}>
                        ✨
                    </div>
                    <div style={{ flex:1 }}>
                        <div className="text-white" style={{ fontSize:"12px", fontWeight:500 }}>
                            Setup — {doneCount} of {steps.length} done
                        </div>
                    </div>
                    {isMobile && (
                        <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-white"
                                title="Minimize"
                                style={{ background:"none", border:"none", cursor:"pointer",
                                    fontSize:"12px", lineHeight:1, padding:"2px" }}>▼</button>
                    )}
                    <button onClick={onDismiss} className="text-slate-400 hover:text-white"
                            style={{ background:"none", border:"none", cursor:"pointer",
                                fontSize:"14px", lineHeight:1, padding:"2px" }}>✕</button>
                </div>

                {/* Progress bar */}
                <div className="bg-slate-700" style={{ height:"3px",
                    borderRadius:"2px", marginBottom:"10px" }}>
                    <div style={{ height:"100%", borderRadius:"2px", background:"#f59e0b",
                        width: `${(doneCount / steps.length) * 100}%`,
                        transition:"width .4s ease" }} />
                </div>

                {/* Steps */}
                {steps.map(s => {
                    const done = isDone(s.id);
                    return (
                        <div key={s.id}
                             onClick={() => !done && markDone(s.id)}
                             className="border-b border-slate-700/50 last:border-b-0"
                             style={{
                                 display:"flex", alignItems:"flex-start", gap:"8px",
                                 padding:"6px 0", cursor: done ? "default" : "pointer",
                             }}>
                            {/* Check circle */}
                            <div className={done ? "" : "bg-slate-800 border border-slate-600"} style={{
                                width:"18px", height:"18px", borderRadius:"50%", flexShrink:0, marginTop:"1px",
                                background: done ? "#EAF3DE" : undefined,
                                display:"flex", alignItems:"center", justifyContent:"center",
                            }}>
                                {done && <span style={{ fontSize:"10px", color:"#3B6D11" }}>✓</span>}
                            </div>
                            <div>
                                <div className={done ? "text-slate-500" : "text-white"}
                                     style={{ fontSize:"11px", fontWeight:500,
                                         textDecoration: done ? "line-through" : "none" }}>
                                    {s.label}
                                </div>
                                {!done && (
                                    <div className="text-slate-500" style={{ fontSize:"10px", marginTop:"1px" }}>
                                        {s.sub}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="text-slate-500" style={{ fontSize:"10px",
                    textAlign:"center", marginTop:"8px" }}>
                    Click a step to mark it done
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Main two-screen welcome modal ────────────────────────────────────────────

const SECURITY_FACTS = [
    { icon: "🔒", label: "Password encrypted",       detail: "Bcrypt hashing — we never store your raw password",        badge: "Active"    },
    { icon: "👁️", label: "No broker credentials",    detail: "AI import reads screenshots only — no logins ever touched", badge: "Read-only" },
    { icon: "🗄️", label: "Your data stays yours",    detail: "Not sold, not shared, not used for advertising",            badge: "Private"   },
    { icon: "🔑", label: "JWT-secured sessions",     detail: "Signed tokens — only you can access your account",          badge: "Secured"   },
    { icon: "🚫", label: "No ads, ever",              detail: "FOLYO is a tool for you — not an ad platform",              badge: "Ad-free"   },
];

export default function WelcomeModal({ user, onClose }) {
    const [screen, setScreen] = useState(1); // 1 = security, 2 = checklist preview
    const firstName = user?.fullName?.split(" ")[0] || user?.username || "there";

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>

            <div className="w-full max-w-md bg-slate-900 border border-slate-700
                            rounded-2xl shadow-2xl overflow-hidden">

                {/* Amber accent line */}
                <div className="h-0.5 w-full"
                     style={{ background: "linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)" }} />

                {/* Screen indicator */}
                <div className="flex items-center justify-between px-6 pt-5 pb-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/40
                                        rounded-xl flex items-center justify-center">
                            <span className="text-amber-400 font-black text-xs">915</span>
                        </div>
                        <div>
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">FOLYO</p>
                            <p className="text-slate-600 text-[10px]">by 915 creation</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        {[1,2].map(n => (
                            <div key={n}
                                 className={"h-1 rounded-full transition-all duration-300 " +
                                 (n === screen ? "w-6 bg-amber-400" : "w-2 bg-slate-700")} />
                        ))}
                    </div>
                </div>

                {/* ── Screen 1: Security ── */}
                {screen === 1 && (
                    <div className="px-6 py-5">
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-3">🔐</div>
                            <h2 className="text-white text-lg font-bold mb-1.5">
                                Welcome, {firstName} — your data is protected
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Before you start, here's exactly how FOLYO keeps your financial data secure.
                            </p>
                        </div>

                        <div className="space-y-0 border border-slate-700/60 rounded-xl overflow-hidden mb-5">
                            {SECURITY_FACTS.map((f, i) => (
                                <div key={i}
                                     className="flex items-center gap-3 px-4 py-3 bg-slate-800/40
                                                border-b border-slate-700/40 last:border-0">
                                    <span className="text-base flex-shrink-0">{f.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs font-semibold leading-none mb-0.5">
                                            {f.label}
                                        </p>
                                        <p className="text-slate-500 text-[10px] leading-snug">{f.detail}</p>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
                                                     flex-shrink-0 bg-green-900/40 text-green-400">
                                        {f.badge}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setScreen(2)}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white
                                       text-sm font-bold rounded-xl transition-colors">
                            Understood — show me what FOLYO can do →
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full mt-2.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
                            Skip intro
                        </button>
                    </div>
                )}

                {/* ── Screen 2: What FOLYO can do + checklist preview ── */}
                {screen === 2 && (
                    <div className="px-6 py-5">
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-3">🚀</div>
                            <h2 className="text-white text-lg font-bold mb-1.5">
                                Here's what you can do
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                A small setup guide will stay on your dashboard until you're fully set up.
                            </p>
                        </div>

                        <div className="space-y-0 border border-slate-700/60 rounded-xl overflow-hidden mb-5">
                            {[
                                { icon: "📌", title: "Pin stocks to your board",    sub: "Live prices, sparklines, fully customisable layout"  },
                                { icon: "🤖", title: "Import trades via AI",         sub: "Screenshot any broker — AI extracts every trade"     },
                                { icon: "📊", title: "Track P&L automatically",     sub: "FIFO-based unrealised and realised gains"             },
                                { icon: "🔔", title: "Set price alerts",             sub: "Get notified the moment your target is hit"          },
                                { icon: "💬", title: "Ask FOLYO AI anything",       sub: "Chat with AI about your holdings and returns"         },
                            ].map((f, i) => (
                                <div key={i}
                                     className="flex items-center gap-3 px-4 py-3 bg-slate-800/40
                                                border-b border-slate-700/40 last:border-0">
                                    <span className="text-base flex-shrink-0">{f.icon}</span>
                                    <div>
                                        <p className="text-white text-xs font-semibold leading-none mb-0.5">
                                            {f.title}
                                        </p>
                                        <p className="text-slate-500 text-[10px]">{f.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-start gap-2.5 bg-amber-900/20 border border-amber-700/30
                                        rounded-xl p-3 mb-4">
                            <span className="text-sm flex-shrink-0 mt-0.5">✨</span>
                            <p className="text-amber-300 text-xs leading-relaxed">
                                A setup checklist will appear in the bottom-right corner of your dashboard.
                                Complete 3 quick steps and it disappears.
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900
                                       text-sm font-bold rounded-xl transition-colors">
                            🚀 Start using FOLYO
                        </button>
                        <button
                            onClick={() => setScreen(1)}
                            className="w-full mt-2.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}