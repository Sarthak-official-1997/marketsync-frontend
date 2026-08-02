// src/pages/SettingsPage.jsx
// Dedicated settings surface. Every section is collapsible and starts collapsed,
// so the page opens compact instead of one long scroll.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme, THEMES } from "../context/ThemeContext";
import { usePrivacy } from "../context/PrivacyContext";
import { useAuth } from "../context/AuthContext";
import { getBubblePrefs, setBubblePrefs } from "../utils/bubblePrefs";

// Collapsible section. Header is a toggle; body only renders when open.
function Section({ icon, title, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
            <button type="button" onClick={() => setOpen(v => !v)}
                    className="w-full px-4 py-3.5 flex items-center gap-2 hover:bg-slate-700/30 transition-colors">
                <span className="text-base">{icon}</span>
                <p className="text-sm font-bold text-white flex-1 text-left">{title}</p>
                <span className={"text-slate-500 text-xs transition-transform " + (open ? "rotate-180" : "")}>▼</span>
            </button>
            {open && <div className="p-3 space-y-1 border-t border-slate-700/50">{children}</div>}
        </div>
    );
}

// A single tappable row (label + optional right-side control/hint).
function Row({ icon, label, sub, onClick, right, danger }) {
    const base = "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors";
    const tone = danger
        ? "text-red-400 hover:bg-red-900/20"
        : "text-slate-200 hover:bg-slate-700/50";
    return (
        <button onClick={onClick} className={base + " " + tone} type="button">
            {icon && <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>}
            <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                {sub && <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>}
            </span>
            {right}
        </button>
    );
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const { theme, themeId, setThemeId } = useTheme();
    const { hidden: valuesHidden, toggle: togglePrivacy } = usePrivacy();
    const { user, isCreator } = useAuth();

    const [bubble, setBubble] = useState(getBubblePrefs());
    const updateBubble = (patch) => setBubble(setBubblePrefs(patch));

    const transparencyPct = Math.round((bubble.transparency / 0.8) * 100);

    const creatorLinks = [
        { to: "/admin",               icon: "🏠", label: "Dashboard"     },
        { to: "/admin/clients",       icon: "👥", label: "Clients"       },
        { to: "/admin/analytics",     icon: "📊", label: "Analytics"     },
        { to: "/admin/notifications", icon: "🔔", label: "Notifications" },
        { to: "/admin/users",         icon: "👤", label: "Users"         },
        { to: "/admin/ai-report",     icon: "🤖", label: "AI Report"     },
        { to: "/creator/client-tracker", icon: "📋", label: "Client Tracker" },
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-3">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-xs text-slate-500 mt-1">
                    {user?.fullName || user?.username}
                    {user?.role ? ` · ${user.role === "CREATOR" ? "👑 Creator" : user.role}` : ""}
                </p>
            </div>

            {/* Appearance */}
            <Section icon="🎨" title="Appearance">
                <div className="px-3 py-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Theme</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {THEMES.map(t => (
                            <button key={t.id} onClick={() => setThemeId(t.id)} type="button"
                                    className={"flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors text-left " +
                                    (themeId === t.id
                                        ? "border-purple-500 bg-purple-500/10"
                                        : "border-slate-700 hover:bg-slate-700/40")}>
                                <span className="text-base">{t.emoji}</span>
                                <span className="text-sm text-white flex-1 truncate">{t.name}</span>
                                {themeId === t.id && <span className="text-purple-400 text-xs">✓</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <Row
                    icon={valuesHidden ? "🙈" : "👁"}
                    label="Hide financial values"
                    sub="Mask portfolio amounts and P&L on screen"
                    onClick={togglePrivacy}
                    right={
                        <span className={"w-10 h-6 rounded-full flex items-center transition-colors flex-shrink-0 " +
                        (valuesHidden ? "bg-amber-500" : "bg-slate-600")}>
                            <span className={"w-5 h-5 bg-white rounded-full mx-0.5 transition-transform " +
                            (valuesHidden ? "translate-x-4" : "translate-x-0")} />
                        </span>
                    }
                />
            </Section>

            {/* Floating bubble */}
            <Section icon="💬" title="Floating bubble">
                <Row
                    icon="👁"
                    label="Show floating bubble"
                    sub="Quick access to Notes and AI Folyo on every screen"
                    onClick={() => updateBubble({ show: !bubble.show })}
                    right={
                        <span className={"w-10 h-6 rounded-full flex items-center transition-colors flex-shrink-0 " +
                        (bubble.show ? "bg-purple-600" : "bg-slate-600")}>
                            <span className={"w-5 h-5 bg-white rounded-full mx-0.5 transition-transform " +
                            (bubble.show ? "translate-x-4" : "translate-x-0")} />
                        </span>
                    }
                />
                <div className={"px-3 py-3 " + (bubble.show ? "" : "opacity-40 pointer-events-none")}>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-slate-200">Transparency</p>
                        <span className="text-xs text-slate-500 tabular-nums">{transparencyPct}% see-through</span>
                    </div>
                    <input
                        type="range" min="0" max="0.8" step="0.05"
                        value={bubble.transparency}
                        onChange={(e) => updateBubble({ transparency: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-[11px] text-slate-600 mt-2">
                        Higher transparency lets you see content behind the bubble. Saved on this device only.
                    </p>
                </div>
            </Section>

            {/* Creator menu — only for CREATOR role */}
            {isCreator && (
                <Section icon="👑" title="Creator">
                    {creatorLinks.map(l => (
                        <Row key={l.to} icon={l.icon} label={l.label}
                             onClick={() => navigate(l.to)}
                             right={<span className="text-slate-600 text-sm">→</span>} />
                    ))}
                </Section>
            )}

        </div>
    );
}