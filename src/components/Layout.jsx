import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme, THEMES } from "../context/ThemeContext";
import { useAuth }  from "../context/AuthContext";
import IndexTicker  from "./IndexTicker";
import ErrorBoundary, { SilentErrorBoundary } from "./ErrorBoundary";
import { searchStocks, searchMfSchemes, addToWatchlist, getStockPrice } from "../api/portfolio";
import { useToast } from "../context/ToastContext";
import StockDetailModal from "./StockDetailModal";
import ChangePasswordModal from "./ChangePasswordModal";
import RevealPasswordModal from "./RevealPasswordModal";
import { getRecentStocks, trackStockView, getRecentMf, trackMfView } from "./RecentStocksMarquee";
import AppLogo from "./AppLogo";
import MfSchemeDetailModal from "./MfSchemeDetailModal";
import AiChatModal from "./AiChatModal";
import { getAiCostSummary } from "../api/admin";
import FolyoBrand from "./FolyoBrand";
import CommandPalette from "./CommandPalette";
import { getBoardApi, addToBoardApi, removeFromBoardApi } from "../api/board";
import InboxPanel from "./InboxPanel";
import { InboxContext } from "../context/InboxContext";
import { useSwipeNav, indexForPath, getSwipeOrder } from "../hooks/useSwipeNav";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import haptics from "../utils/haptics";
import InstallAppButton from "./InstallAppButton";
import { getPendingNotifications, getInboxUnread } from "../api/admin";
import { usePrivacy } from "../context/PrivacyContext";
import FloatingBubble from "./FloatingBubble";
import PrivacyBlackoutOverlay from "./PrivacyBlackoutOverlay";
import { getDefaultView, DEFAULT_VIEW, DEFAULT_VIEW_EVENT, getHomePath } from "../utils/homePreference";
import { getNavOrder, BOTTOM_NAV_EVENT } from "../utils/bottomNavPrefs";

// ── Inline mobile hook — no external file dependency ──────────────────────────
function useMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const h  = (e) => setIsMobile(e.matches);
        mq.addEventListener("change", h);
        setIsMobile(mq.matches);
        return () => mq.removeEventListener("change", h);
    }, []);
    return isMobile;
}


// ── Inline MobileHeader ───────────────────────────────────────────────────────
function MobileHeader({ onSearchOpen, onAiOpen, pendingNotifs = 0, user, onInboxOpen, portfolioSummary, onChangePw, onRevealPw, onLogout, isCreator }) {
    const navigate = useNavigate();
    const { theme, themeId, setThemeId } = useTheme();
    const { hidden: valuesHidden, toggle: togglePrivacy } = usePrivacy();
    const [acctOpen,      setAcctOpen]      = useState(false);
    const [themeExpanded, setThemeExpanded] = useState(false);
    const [creatorOpen,   setCreatorOpen]   = useState(false);
    const acctRef = useRef(null);

    useEffect(() => {
        if (!acctOpen) return;
        const h = (e) => {
            if (acctRef.current && !acctRef.current.contains(e.target)) {
                // Creator is now an expandable row INSIDE this same dropdown
                // (used to be its own separate dropdown with its own ref —
                // that's gone now, this one effect covers everything nested
                // in here, same as it already did for Theme).
                setAcctOpen(false); setThemeExpanded(false); setCreatorOpen(false);
            }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [acctOpen]);

    const creatorLinks = [
        { to: "/admin",                      icon: "🏠", label: "Dashboard"      },
        // "Clients" removed — Client Tracker below now carries the same
        // real portfolio data (value, day change, P&L) that this page
        // used to be the only place to see, so having both here just
        // presented two destinations for the same thing.
        { to: "/admin/analytics",            icon: "📊", label: "Analytics"      },
        { to: "/admin/notifications",        icon: "🔔", label: "Notifications"  },
        { to: "/admin/users",                icon: "👤", label: "Users"          },
        { to: "/admin/ai-report",            icon: "🤖", label: "AI Report"      },
        { to: "/creator/client-tracker",     icon: "📋", label: "Client Tracker" },
    ];

    const menuRow = {
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px", background: "transparent", border: "none",
        cursor: "pointer", color: "#e2e8f0", fontSize: 13, textAlign: "left",
    };
    const initial    = (user?.fullName || user?.username || "?")[0].toUpperCase();
    const totalValue = parseFloat(portfolioSummary?.totalValue || 0);
    const totalPL    = parseFloat(portfolioSummary?.totalPL    || 0);
    const plPos      = totalPL >= 0;

    const fmtShort = (v) => {
        if (!v) return null;
        const n = parseFloat(v);
        if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + "Cr";
        if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + "L";
        return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    };

    // bg-slate-900 + border-slate-700/60 — Tailwind classes, not inline
    // styles, so the theme CSS overrides (styles/themes.css) can actually
    // reach them. This was hardcoded to #0f172a via inline style before,
    // which no theme (light or dark) could ever change — that's what made
    // light themes look broken at the top of the app.
    return (
        <header className="bg-slate-900 border-b border-slate-700/60"
                style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px",
                    position: "sticky", top: 0, zIndex: 50,
                    height: 56, flexShrink: 0,
                }}>
            {/* Logo + portfolio value — was hardcoded to "/stocks", so tapping
                the logo always went to Stocks regardless of the Settings
                preference. Same bug as the "/" route had before it read
                getHomePath(). */}
            <Link to={getHomePath(isCreator)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0 }}>
                <span className="text-white" style={{ fontWeight: 900, fontSize: 18,
                    letterSpacing: "-0.5px" }}>FOLYO</span>
            </Link>

            {/* Portfolio value strip — shown only when data is loaded */}
            {totalValue > 0 && (
                <div style={{
                    marginLeft: 4, paddingLeft: 8,
                    borderLeft: "1px solid rgba(51,65,85,0.6)",
                    flexShrink: 0,
                }}>
                    <div className="text-white" style={{ fontSize: 11, fontWeight: 700,
                        fontVariantNumeric: "tabular-nums", lineHeight: 1.2,
                        whiteSpace: "nowrap" }}>
                        {fmtShort(totalValue)}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.2,
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                        color: plPos ? "#10b981" : "#ef4444" }}>
                        {plPos ? "+" : ""}{fmtShort(Math.abs(totalPL))}
                    </div>
                </div>
            )}

            {/* Search — takes all available space */}
            <button onClick={onSearchOpen} className="bg-slate-800"
                    style={{
                        flex: 1, display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px",
                        border: "1px solid rgba(51,65,85,0.6)",
                        borderRadius: 12, textAlign: "left", minWidth: 0,
                    }}>
                <svg className="text-slate-500" style={{ width: 16, height: 16, flexShrink: 0 }}
                     fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/>
                    <path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                </svg>
                <span className="text-slate-500" style={{ fontSize: 14, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Search stocks...
                </span>
            </button>

            {/* Privacy shield — one tap blacks out the entire screen (see
                PrivacyBlackoutOverlay), not just the numeric values. */}
            <button onClick={togglePrivacy} title={valuesHidden ? "Show your screen" : "Hide your screen"}
                    style={{
                        width: 36, height: 36, flexShrink: 0,
                        background: valuesHidden ? "rgba(245,158,11,0.15)" : "transparent",
                        border: valuesHidden ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(51,65,85,0.6)",
                        borderRadius: 10, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                    }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke={valuesHidden ? "#fbbf24" : "#94a3b8"} strokeWidth="2">
                    {valuesHidden ? (
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                    ) : (
                        <>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </>
                    )}
                </svg>
            </button>

            {/* AI, Creator, and Inbox all moved into the account dropdown
                below (Ask AI / Creator / Inbox rows) — the main row now
                shows only Search, the privacy eye, and the avatar, exactly
                as requested. Nothing was removed, just relocated: every one
                of these three still does exactly what it did before, one
                tap further in via the avatar menu. */}

            {/* Profile avatar — opens the account dropdown (Settings, password,
                theme, logout). Phone-app style; does NOT open the More drawer. */}
            <div ref={acctRef} style={{ position: "relative", flexShrink: 0 }}>
                <button
                    onClick={() => setAcctOpen(v => !v)}
                    style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "#7c3aed", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        color: "white", fontWeight: 700, fontSize: 14,
                        border: "none", cursor: "pointer", position: "relative",
                    }}>
                    {initial}
                    {/* A quiet presence dot — the Inbox bell (with its full
                        count) moved inside the dropdown below, but losing
                        ALL at-a-glance awareness of unread items felt like
                        a real functional loss, not just a visual tidy-up. */}
                    {pendingNotifs > 0 && (
                        <span style={{
                            position: "absolute", top: -1, right: -1,
                            width: 10, height: 10, borderRadius: "50%",
                            background: "#ef4444", border: "2px solid #0f172a",
                        }} />
                    )}
                </button>

                {acctOpen && (
                    <div className="bg-slate-900 border border-slate-700/60"
                         style={{
                             position: "absolute", top: 42, right: 0, width: 236,
                             borderRadius: 14, boxShadow: "0 14px 44px rgba(0,0,0,0.6)",
                             zIndex: 60, overflow: "hidden",
                         }}>
                        {/* User header */}
                        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(51,65,85,0.5)" }}>
                            <div className="text-white" style={{ fontWeight: 700, fontSize: 13 }}>
                                {user?.fullName || user?.username}
                            </div>
                            <div className="text-slate-500" style={{ fontSize: 11, marginTop: 2, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {user?.email || user?.username}
                            </div>
                        </div>

                        {/* Settings */}
                        <button style={menuRow}
                                onClick={() => { setAcctOpen(false); navigate("/settings"); }}>
                            <span>⚙️</span> Settings
                        </button>

                        {/* Creator — expandable, same pattern as Theme below.
                            Only rendered for creators at all. Was its own
                            separate crown icon + dropdown in the main row;
                            same functionality, now living here instead. */}
                        {isCreator && (
                            <>
                                <button style={{ ...menuRow, borderTop: "1px solid rgba(51,65,85,0.4)" }}
                                        onClick={() => setCreatorOpen(v => !v)}>
                                    <span>👑</span>
                                    <span style={{ flex: 1 }}>Creator</span>
                                    <span className="text-slate-500" style={{ fontSize: 10,
                                        transform: creatorOpen ? "rotate(180deg)" : "none",
                                        transition: "transform .15s" }}>▼</span>
                                </button>
                                {creatorOpen && (
                                    <div style={{ background: "#0b1220" }}>
                                        {creatorLinks.map(l => (
                                            <button key={l.to}
                                                    onClick={() => { setAcctOpen(false); setCreatorOpen(false); navigate(l.to); }}
                                                    style={{
                                                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                                                        padding: "9px 14px 9px 30px", background: "transparent",
                                                        border: "none", cursor: "pointer", textAlign: "left",
                                                        color: "#cbd5e1", fontSize: 12.5,
                                                    }}>
                                                <span>{l.icon}</span> {l.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Ask AI — was its own sparkles icon in the main row;
                            same AI chat, now one tap further in. */}
                        <button style={{ ...menuRow, borderTop: "1px solid rgba(51,65,85,0.4)" }}
                                onClick={() => { setAcctOpen(false); onAiOpen(); }}>
                            <span>✨</span> Ask AI
                        </button>

                        {/* Inbox — was its own bell icon with a badge in the
                            main row; the avatar's small red dot now covers
                            "something's unread", the exact count shows here. */}
                        <button style={menuRow}
                                onClick={() => { setAcctOpen(false); onInboxOpen(); }}>
                            <span>🔔</span>
                            <span style={{ flex: 1, textAlign: "left" }}>Inbox</span>
                            {pendingNotifs > 0 && (
                                <span style={{
                                    minWidth: 18, height: 18, background: "#ef4444",
                                    borderRadius: 9, fontSize: 10, fontWeight: 700,
                                    color: "white", display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                    padding: "0 5px",
                                }}>
                                    {pendingNotifs > 9 ? "9+" : pendingNotifs}
                                </span>
                            )}
                        </button>

                        {/* Change password */}
                        <button style={menuRow}
                                onClick={() => { setAcctOpen(false); onChangePw && onChangePw(); }}>
                            <span>🔒</span> Change password
                        </button>

                        {/* View / recover password */}
                        <button style={menuRow}
                                onClick={() => { setAcctOpen(false); onRevealPw && onRevealPw(); }}>
                            <span>🔓</span> View / recover password
                        </button>

                        {/* Theme — expands inline */}
                        <button style={{ ...menuRow, borderTop: "1px solid rgba(51,65,85,0.4)" }}
                                onClick={() => setThemeExpanded(v => !v)}>
                            <span>🎨</span>
                            <span style={{ flex: 1 }}>Theme</span>
                            <span style={{ fontSize: 12 }}>{theme?.emoji}</span>
                            <span className="text-slate-500" style={{ fontSize: 10,
                                transform: themeExpanded ? "rotate(180deg)" : "none",
                                transition: "transform .15s" }}>▼</span>
                        </button>
                        {themeExpanded && (
                            <div style={{ maxHeight: 220, overflowY: "auto", background: "#0b1220" }}>
                                {THEMES.map(t => (
                                    <button key={t.id}
                                            onClick={() => setThemeId(t.id)}
                                            style={{
                                                width: "100%", display: "flex", alignItems: "center", gap: 10,
                                                padding: "9px 14px 9px 30px", background: "transparent",
                                                border: "none", cursor: "pointer", textAlign: "left",
                                                color: themeId === t.id ? "#a78bfa" : "#cbd5e1", fontSize: 12.5,
                                            }}>
                                        <span>{t.emoji}</span>
                                        <span style={{ flex: 1 }}>{t.name}</span>
                                        {themeId === t.id && <span style={{ color: "#a78bfa" }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Logout */}
                        <button style={{ ...menuRow, color: "#f87171",
                            borderTop: "1px solid rgba(51,65,85,0.4)" }}
                                onClick={() => { setAcctOpen(false); onLogout && onLogout(); }}>
                            <span>🚪</span> Logout
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

// ── Inline MobileBottomNav ────────────────────────────────────────────────────
function MobileBottomNav({ currentPath, onShowMore, showMore, onHideMore, isCreator }) {
    const navigate = useNavigate();
    const [navOrder, setNavOrderState] = useState(() => getNavOrder(isCreator));

    useEffect(() => {
        const onChange = () => setNavOrderState(getNavOrder(isCreator));
        window.addEventListener(BOTTOM_NAV_EVENT, onChange);
        return () => window.removeEventListener(BOTTOM_NAV_EVENT, onChange);
    }, [isCreator]);

    const homeIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    const marketIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    const holdingsIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" strokeLinecap="round"/></svg>;
    const tradesIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    const watchlistIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M12 4.318C9.403.5 3 1.545 3 8c0 4.5 9 12 9 12s9-7.5 9-12c0-6.455-6.403-7.5-9-3.682z" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    const trackerIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    const moreIcon = <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;

    // Icons keyed by candidate id — labels/paths come from getNavOrder(),
    // which is plain data (no JSX) so it can live in a shared util both
    // this nav and the Settings reorder screen import.
    const ICONS = {
        "home": homeIcon, "market": marketIcon, "holdings": holdingsIcon,
        "trades": tradesIcon, "watchlist": watchlistIcon,
        "mf-market": marketIcon, "mf-holdings": holdingsIcon,
        "mf-trades": tradesIcon, "mf-watchlist": watchlistIcon,
        "client-tracker": trackerIcon,
    };
    // Root-level destinations need exact matching — /stocks would otherwise
    // startsWith-match its own children like /stocks/holdings too.
    const EXACT_ROOTS = new Set(["home", "market", "mf-market"]);
    // "Home" isn't a fixed destination — it's a live proxy for whatever the
    // user picked in Settings (Home dashboard / Stocks / Mutual Funds /
    // Client Tracker). Resolved once here rather than baked into the
    // candidate list, since it depends on isCreator and the preference,
    // neither of which the plain-data candidate list can know about.
    const resolvedHomePath = getHomePath(isCreator);

    const tabs = [
        ...navOrder.slice(0, 4).map(c => {
            const to = c.dynamicHome ? resolvedHomePath : c.path;
            return {
                id: c.id, label: c.label, to,
                exact: EXACT_ROOTS.has(c.id) || to === "/stocks" || to === "/mf",
                icon: ICONS[c.id],
            };
        }),
        { id: "more", label: "More", to: null, icon: moreIcon },
    ];
    const isActive = (tab) => {
        if (tab.id === "more") return showMore;
        if (tab.exact) return currentPath === tab.to;
        return currentPath.startsWith(tab.to);
    };
    return (
        <nav className="bg-slate-900 border-t border-slate-700/60"
             style={{
                 position: "fixed", bottom: 0, left: 0, right: 0,
                 zIndex: 9000,
                 display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                 paddingBottom: "env(safe-area-inset-bottom, 0px)",
             }}>
            {tabs.map(tab => {
                const active = isActive(tab);
                return (
                    <button key={tab.id}
                            onClick={() => {
                                haptics.tap();
                                if (tab.id === "more") {
                                    showMore ? onHideMore() : onShowMore();
                                } else {
                                    onHideMore();
                                    navigate(tab.to);
                                }
                            }}
                            style={{
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                gap: "2px", padding: "8px 4px",
                                color: active ? "#a855f7" : "#64748b",
                                background: "none", border: "none", cursor: "pointer",
                            }}>
                        {tab.icon}
                        <span style={{ fontSize: "10px", fontWeight: 500 }}>{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

// ── Inline More Drawer ────────────────────────────────────────────────────────
function MobileMoreDrawer({ onClose, isAdmin, isCreator }) {
    const navigate = useNavigate();
    const go = (to) => { onClose(); navigate(to); };

    // Whatever falls beyond the top 4 in the user's own custom nav order —
    // no more "demoted fund type" concept now that ordering is fully free-
    // form (Home/Stocks/MF/Client Tracker can mix in any order the user
    // wants), so each leftover destination gets its own direct tile here
    // instead of being grouped behind one expandable "the other fund type"
    // tile the way it worked before.
    const EMOJI = {
        "home": "🏠", "market": "📈", "holdings": "💼", "trades": "🔄", "watchlist": "👁",
        "mf-market": "📊", "mf-holdings": "💼", "mf-trades": "🔄", "mf-watchlist": "👁",
        "client-tracker": "📋",
    };
    const overflowNav = getNavOrder(isCreator).slice(4)
        .map(c => ({ label: c.label, to: c.dynamicHome ? getHomePath(isCreator) : c.path, icon: EMOJI[c.id] || "•" }));

    // Creator / Admin links intentionally NOT here — they live in Settings now.
    const mainTiles = [
        ...overflowNav,
        { label: "Alerts",             to: "/stocks/alerts", icon: "🔔" },
        { label: "Combined Portfolio", to: "/portfolio",     icon: "⊞"  },
        { label: "Settings",           to: "/settings",      icon: "⚙️" },
    ];

    // Colours moved into a companion className (bg-slate-800/border-slate-700/
    // text-slate-300 are all theme-overridden in styles/themes.css) — tileStyle
    // itself keeps only layout properties now, since inline "background"/"color"
    // here was the same unreachable-by-theming problem as everywhere else in
    // this file.
    const tileStyle = {
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 6,
        padding: "12px 8px",
        border: "1px solid rgba(51,65,85,0.6)",
        borderRadius: 12, cursor: "pointer",
    };
    const tileClassName = "bg-slate-800 text-slate-300";
    const labelStyle = { fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.3 };

    return (
        <>
            <div onClick={onClose}
                 style={{
                     position: "fixed", inset: 0, zIndex: 8998,
                     backgroundColor: "rgba(0,0,0,0.6)",
                 }} />
            <div className="bg-slate-900 border-t border-slate-700/60"
                 style={{
                     position: "fixed", bottom: 64, left: 0, right: 0,
                     zIndex: 8999,
                     borderRadius: "16px 16px 0 0",
                     padding: "16px",
                     maxHeight: "70vh", overflowY: "auto",
                 }}>
                <div className="bg-slate-700" style={{ width: 40, height: 4,
                    borderRadius: 2, margin: "0 auto 16px" }} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {mainTiles.map(item => (
                        <button key={item.to} onClick={() => go(item.to)} className={tileClassName} style={tileStyle}>
                            <span style={{ fontSize: 22 }}>{item.icon}</span>
                            <span style={labelStyle}>{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Install-to-home-screen shortcut (+ enables alert notifications) */}
                <InstallAppButton />
            </div>
        </>
    );
}

// -- Board helpers ------------------------------------------------------------
// The backend is now authoritative: POST is idempotent and returns
// { added, alreadyPresent, ... }; DELETE returns { removed }. These helpers
// pass that truth back to callers so the UI never guesses or retries.

export async function addToBoard(stock) {
    try {
        const res = await addToBoardApi({
            symbol:   stock.symbol,
            name:     stock.name     || stock.companyName || stock.symbol,
            exchange: stock.exchange || "NSE",
        });
        window.dispatchEvent(new Event("ms_board_updated"));
        // { added: bool, alreadyPresent: bool, ...row }
        return res.data || { added: true, alreadyPresent: false };
    } catch {
        return null;   // genuine failure (network / auth)
    }
}

export async function removeFromBoard(symbol) {
    try {
        const res = await removeFromBoardApi(symbol);
        window.dispatchEvent(new Event("ms_board_updated"));
        // { removed: bool, symbol }
        return res.data || { removed: true };
    } catch {
        return null;   // genuine failure
    }
}

export function getBoardStocks() { return []; }


const STOCKS_LINKS = [
    { to: "/stocks",              icon: "📊", label: "Market"       },
    { to: "/stocks/holdings",     icon: "💼", label: "Holdings"     },
    { to: "/stocks/transactions", icon: "🔄", label: "Transactions" },
    { to: "/stocks/watchlist",    icon: "👁", label: "Watchlist"    },
    { to: "/stocks/alerts",       icon: "🔔", label: "Alerts"       },
];

const MF_LINKS = [
    { to: "/mf",               icon: "📊", label: "Market"       },
    { to: "/mf/holdings",      icon: "💼", label: "Holdings"     },
    { to: "/mf/transactions",  icon: "🔄", label: "Transactions" },
    { to: "/mf/watchlist",     icon: "👁", label: "Watchlist"    },
];

const CREATOR_LINKS = [
    { to: "/admin/notifications",         icon: "🔔", label: "Notifications"  },
    { to: "/admin/users",                 icon: "👤", label: "Users"          },
    { to: "/creator/client-tracker",      icon: "📋", label: "Client Tracker" },
];

function NavLink({ to, icon, label, exact = false }) {
    const location = useLocation();
    const active   = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
        <Link to={to} className={
            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all " +
            (active
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                : "text-slate-400 hover:text-white hover:bg-slate-700/60")
        }>
            <span className="text-base">{icon}</span>{label}
        </Link>
    );
}

function AdminNavLink({ to, icon, label, exact = false }) {
    const location = useLocation();
    const active   = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
        <Link to={to} className={
            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all " +
            (active
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-700/60")
        }>
            <span className="text-base">{icon}</span>{label}
        </Link>
    );
}

function SectionHeader({ icon, label, expanded, onToggle }) {
    return (
        <button onClick={onToggle}
                className="w-full flex items-center justify-between px-3 py-2
                           text-xs font-bold text-slate-500 uppercase tracking-widest
                           hover:text-slate-400 transition-colors">
            <span className="flex items-center gap-2"><span>{icon}</span>{label}</span>
            <span className={"text-slate-600 transition-transform text-xs " +
                (expanded ? "rotate-180" : "")}>▼</span>
        </button>
    );
}

// -- Directional page transition ---------------------------------------------
// Slides the incoming page in from the right when moving to a later tab, from
// the left when moving back, and plain-fades for everything else. Direction is
// derived from tab order, so swipes AND bottom-nav taps animate consistently.
function PageTransition({ children, isCreator }) {
    const location = useLocation();
    const prevIdx  = useRef(indexForPath(location.pathname, getSwipeOrder(isCreator)));
    const [dir,     setDir]     = useState("fade");
    const [animKey, setAnimKey] = useState(location.key || location.pathname);

    useEffect(() => {
        const cur  = indexForPath(location.pathname, getSwipeOrder(isCreator));
        const prev = prevIdx.current;
        let d = "fade";
        if (cur >= 0 && prev >= 0 && cur !== prev) d = cur > prev ? "next" : "prev";
        setDir(d);
        setAnimKey(location.key || location.pathname);
        prevIdx.current = cur;
    }, [location.pathname, location.key, isCreator]);

    return (
        <div key={animKey} className={"page-anim page-anim-" + dir}>
            {children}
        </div>
    );
}

export default function Layout({ children, portfolioSummary }) {
    const { theme, themeId, setThemeId } = useTheme();
    const [themeOpen, setThemeOpen] = useState(false);
    const themeRef = useRef(null);
    const { user, logout, isAdmin, isCreator } = useAuth();
    const { hidden: valuesHidden, toggle: togglePrivacy } = usePrivacy();
    const navigate  = useNavigate();
    const location  = useLocation();
    const isMobile  = useMobile();

    // Swipe left/right between the main tabs (mobile only). The hook guards
    // against horizontal scrollers so it won't hijack pill rows / tables / charts.
    const mainRef = useRef(null);
    useSwipeNav(mainRef, isMobile, isCreator);

    // Pull-to-refresh: dispatching visibilitychange makes every page's existing
    // "refetch when visible" handler fire — so one gesture refreshes all data with
    // no per-page wiring. Brief delay so the spinner is visible, not a flicker.
    const onPullRefresh = useCallback(async () => {
        haptics.tap();
        document.dispatchEvent(new Event("visibilitychange"));
        await new Promise(r => setTimeout(r, 850));
    }, []);
    const { distance: ptrDist, refreshing: ptrBusy, threshold: ptrThreshold } =
        usePullToRefresh(mainRef, onPullRefresh);

    const [stocksOpen,  setStocksOpen]  = useState(true);
    const [mfOpen,      setMfOpen]      = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState(null);
    const [selectedMf,    setSelectedMf]    = useState(null);

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showChangePw, setShowChangePw] = useState(false);
    const [showRevealPw, setShowRevealPw] = useState(false);
    const userMenuRef = useRef(null);

    const [showAiChat, setShowAiChat] = useState(false);
    const [aiCost,     setAiCost]     = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [showInbox,   setShowInbox]   = useState(false);
    const [inboxUnread, setInboxUnread] = useState(0);
    const [showMore,    setShowMore]    = useState(false);
    // Which fund type leads the bottom nav — live-reactive to the Settings
    // toggle via a custom event, so switching it applies immediately with
    // no reload (same pattern as bubble prefs).
    const [defaultView, setDefaultViewState] = useState(getDefaultView());
    useEffect(() => {
        const onChange = (e) => setDefaultViewState(e.detail);
        window.addEventListener(DEFAULT_VIEW_EVENT, onChange);
        return () => window.removeEventListener(DEFAULT_VIEW_EVENT, onChange);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("ms_board_stocks");
        localStorage.removeItem("ms_recently_visited");
        localStorage.removeItem("ms_recently_viewed_mf");
        logout();
        navigate("/login");
    };

    const totalValue = portfolioSummary?.totalValue;
    const totalPL    = portfolioSummary?.totalPL;
    const isPLPos    = parseFloat(totalPL || 0) >= 0;

    const fmtCrore = (v) => {
        if (!v) return "—";
        const n = parseFloat(v);
        if (n >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(2) + "Cr";
        if (n >= 100_000)    return "₹" + (n / 100_000).toFixed(2) + "L";
        return new Intl.NumberFormat("en-IN", {
            style: "currency", currency: "INR", maximumFractionDigits: 0,
        }).format(n);
    };

    useEffect(() => {
        const h = (e) => {
            if (themeRef.current && !themeRef.current.contains(e.target))
                setThemeOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    useEffect(() => {
        const h = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target))
                setUserMenuOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    useEffect(() => {
        if (!isCreator) return;
        const fetch = () => getAiCostSummary().then(setAiCost).catch(() => {});
        fetch();
        const t = setInterval(fetch, 30_000);
        return () => clearInterval(t);
    }, [isCreator]);

    useEffect(() => {
        const poll = async () => {
            try {
                const pend = await getPendingNotifications().catch(() => []);
                let count  = (pend || []).length;
                if (isCreator) {
                    const data = await getInboxUnread().catch(() => ({}));
                    count += data?.messages || 0;
                }
                setInboxUnread(count);
            } catch {}
        };
        poll();
        const t = setInterval(poll, 30_000);
        // Re-poll IMMEDIATELY whenever a notification is acknowledged anywhere
        // in the app (blocking modal or the lightweight reminder/alert toast) —
        // without this, the bell badge only caught up on its own next 30s
        // tick, so tapping "OK" on a reminder didn't visibly update the count
        // for up to half a minute, looking like it was stuck/out of sync.
        window.addEventListener("ms_notification_acknowledged", poll);
        return () => {
            clearInterval(t);
            window.removeEventListener("ms_notification_acknowledged", poll);
        };
    }, [isCreator]);

    return (
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">

            {/* Global floating launcher — Notes + AI Folyo. Respects Settings prefs. */}
            <FloatingBubble />

            {/* Full-screen privacy shield — the eye icon now blacks out the
                ENTIRE app, not just numeric values, when active. Rendered at
                this top level (same tier as FloatingBubble) so it works no
                matter which page or which header (mobile/desktop) triggered
                it, and sits above every other modal in the app. */}
            <PrivacyBlackoutOverlay />

            {/* ── Mobile header — shown only on small screens ── */}
            {isMobile && (
                <MobileHeader
                    onSearchOpen={() => setSearchOpen(true)}
                    onAiOpen={() => setShowAiChat(true)}
                    pendingNotifs={inboxUnread}
                    user={user}
                    onInboxOpen={() => setShowInbox(true)}
                    portfolioSummary={portfolioSummary}
                    onChangePw={() => setShowChangePw(true)}
                    onRevealPw={() => setShowRevealPw(true)}
                    onLogout={handleLogout}
                    isCreator={isCreator}
                />
            )}

            {/* ── Desktop header — hidden on mobile ── */}
            {!isMobile && (
                <header className="flex-shrink-0 h-16 bg-slate-900 border-b
                       border-slate-700/60 flex items-center px-3 sm:px-4
                       gap-2 sm:gap-3 z-30">

                    <Link to={getHomePath(isCreator)} className="flex items-center gap-2 flex-shrink-0">
                        <AppLogo className="w-8 h-8" />
                        <div className="hidden sm:block">
                            <FolyoBrand size="xs" />
                        </div>
                    </Link>

                    <div className="h-5 w-px bg-slate-700 flex-shrink-0 hidden sm:block" />

                    {isCreator && aiCost && (
                        <button
                            onClick={() => navigate("/admin/ai-report")}
                            className="flex-shrink-0 hidden md:flex flex-col items-end
                                       bg-amber-900/20 border border-amber-500/20
                                       hover:border-amber-500/40 rounded-xl px-3 py-1.5
                                       transition-colors">
                            <span className="text-amber-400 text-xs font-bold">
                                Rs.{parseFloat(aiCost.todayCostInr || 0).toFixed(2)} today
                            </span>
                            <span className="text-slate-600 text-[10px]">
                                Rs.{parseFloat(aiCost.totalCostInr || 0).toFixed(2)} total
                            </span>
                        </button>
                    )}

                    {/* Search + Ask AI unified bar */}
                    <div className="flex-1 min-w-0 flex items-center
                                    bg-slate-800/70 hover:bg-slate-800
                                    border border-slate-700 hover:border-slate-600
                                    rounded-xl transition-all duration-150 overflow-hidden">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center gap-3 px-4 py-2 flex-1 min-w-0
                                       text-left group bg-transparent border-none">
                            <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-400
                                            flex-shrink-0 transition-colors"
                                 fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"/>
                                <path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                            </svg>
                            <span className="text-slate-500 group-hover:text-slate-400 text-sm
                                             flex-1 transition-colors truncate">
                                Search stocks & MF...
                            </span>
                        </button>
                        <div className="h-5 w-px bg-slate-700 flex-shrink-0" />
                        <button
                            onClick={() => setShowAiChat(true)}
                            className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0
                                       text-purple-400 hover:text-purple-300
                                       hover:bg-purple-500/10 transition-all duration-150 group/ai">
                            <span className="text-sm leading-none
                                             group-hover/ai:scale-110 transition-transform">✨</span>
                            <span className="text-xs font-semibold hidden sm:block">Ask AI</span>
                        </button>
                    </div>

                    {/* Right side items */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">

                        {totalValue && (
                            <div className="hidden md:flex flex-col items-end bg-slate-800
                                            border border-slate-700 rounded-xl px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">Portfolio</span>
                                    <span className="text-sm font-bold text-white">
                                        {valuesHidden ? "••••••" : fmtCrore(totalValue)}
                                    </span>
                                </div>
                                {totalPL && (
                                    <span className={"text-xs font-semibold " +
                                        (isPLPos ? "text-green-400" : "text-red-400")}>
                                        {valuesHidden ? "••••" : `P&L ${isPLPos ? "+" : ""}${fmtCrore(totalPL)}`}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Privacy toggle */}
                        <button
                            onClick={togglePrivacy}
                            title={valuesHidden ? "Show financial values" : "Hide financial values"}
                            className={"relative flex items-center justify-center w-9 h-9 rounded-xl " +
                                "border transition-colors flex-shrink-0 " +
                                (valuesHidden
                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                                    : "bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700")}>
                            {valuesHidden ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                </svg>
                            )}
                        </button>

                        {/* Inbox bell */}
                        <button
                            onClick={() => setShowInbox(v => !v)}
                            className="relative flex items-center gap-1.5 px-3 py-2
                                       text-slate-400 hover:text-white hover:bg-slate-700
                                       rounded-xl transition-colors flex-shrink-0
                                       border border-slate-700/60 hover:border-slate-600"
                            title="Inbox">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                 strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118
                                         14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0
                                         10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                                         .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3
                                         0 11-6 0v-1m6 0H9"/>
                            </svg>
                            <span className="text-xs font-medium hidden sm:inline">Inbox</span>
                            {inboxUnread > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4
                                                 bg-red-500 text-white text-[10px] font-bold
                                                 rounded-full flex items-center justify-center
                                                 px-1 leading-none">
                                    {inboxUnread > 99 ? "99+" : inboxUnread}
                                </span>
                            )}
                        </button>

                        {/* Theme dropdown */}
                        <div ref={themeRef} className="relative">
                            <button onClick={() => setThemeOpen(v => !v)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-800
                                               hover:bg-slate-700 border border-slate-700
                                               rounded-xl text-sm transition-colors">
                                <span className="text-base leading-none">{theme.emoji}</span>
                                <span className="text-slate-300 text-xs hidden md:block font-medium max-w-[80px] truncate">
                                    {theme.name}
                                </span>
                                <span className="text-slate-500 text-xs">▾</span>
                            </button>
                            {themeOpen && (
                                <div className="absolute right-0 top-full mt-2 bg-slate-800
                                                border border-slate-700 rounded-2xl shadow-2xl
                                                z-50 overflow-hidden w-56">
                                    <div className="px-3 py-2 border-b border-slate-700/50">
                                        <p className="text-slate-500 text-xs font-semibold
                                                      uppercase tracking-wide">🌙 Dark</p>
                                    </div>
                                    {THEMES.filter(t => t.type === "dark").map(t => (
                                        <button key={t.id}
                                                onClick={() => { setThemeId(t.id); setThemeOpen(false); }}
                                                className={"w-full flex items-center gap-3 px-4 py-2.5 " +
                                                    "hover:bg-slate-700/60 transition-colors text-left " +
                                                    (themeId === t.id ? "bg-slate-700/80" : "")}>
                                            <span className="text-base">{t.emoji}</span>
                                            <span className="text-sm text-white flex-1">{t.name}</span>
                                            <div className="flex gap-0.5">
                                                {t.preview.map((c, i) => (
                                                    <div key={i} className="w-3 h-3 rounded-sm"
                                                         style={{ backgroundColor: c }} />
                                                ))}
                                            </div>
                                            {themeId === t.id && (
                                                <span className="text-blue-400 text-xs">✓</span>
                                            )}
                                        </button>
                                    ))}
                                    <div className="px-3 py-2 border-t border-b border-slate-700/50">
                                        <p className="text-slate-500 text-xs font-semibold
                                                      uppercase tracking-wide">☀️ Light</p>
                                    </div>
                                    {THEMES.filter(t => t.type === "light").map(t => (
                                        <button key={t.id}
                                                onClick={() => { setThemeId(t.id); setThemeOpen(false); }}
                                                className={"w-full flex items-center gap-3 px-4 py-2.5 " +
                                                    "hover:bg-slate-700/60 transition-colors text-left " +
                                                    (themeId === t.id ? "bg-slate-700/80" : "")}>
                                            <span className="text-base">{t.emoji}</span>
                                            <span className="text-sm text-white flex-1">{t.name}</span>
                                            <div className="flex gap-0.5">
                                                {t.preview.map((c, i) => (
                                                    <div key={i} className="w-3 h-3 rounded-sm
                                                                            border border-slate-600"
                                                         style={{ backgroundColor: c }} />
                                                ))}
                                            </div>
                                            {themeId === t.id && (
                                                <span className="text-blue-400 text-xs">✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* User menu */}
                        <div ref={userMenuRef} className="relative">
                            <button
                                onClick={() => setUserMenuOpen(v => !v)}
                                className="flex items-center gap-1.5 bg-slate-800 border border-slate-700
                                           rounded-xl px-2.5 py-1.5 hover:bg-slate-700 transition-colors">
                                <div className="relative flex-shrink-0">
                                    <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center
                                                    justify-center text-white text-xs font-bold">
                                        {user?.username?.[0]?.toUpperCase() || "U"}
                                    </div>
                                    {isCreator && (
                                        <span className="absolute -top-2 left-1/2 -translate-x-1/2
                                                         text-[11px] leading-none select-none"
                                              title="Creator">
                                            👑
                                        </span>
                                    )}
                                </div>
                                <span className="text-slate-500 text-xs">▾</span>
                            </button>

                            {userMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800
                                                border border-slate-700 rounded-2xl shadow-2xl
                                                z-50 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-700/50">
                                        <p className="text-white font-semibold text-sm">
                                            {user?.fullName || user?.username}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-0.5">
                                            {user?.email || user?.username}
                                        </p>
                                        <span className={
                                            "inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full " +
                                            "font-bold border " +
                                            (user?.role === "CREATOR"
                                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                : user?.role === "ADMIN"
                                                    ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                                    : "bg-blue-500/20 text-blue-400 border-blue-500/30")
                                        }>
                                            {user?.role === "CREATOR" ? "👑 CREATOR" : user?.role}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => { setUserMenuOpen(false); navigate("/settings"); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm
                                                   text-slate-300 hover:text-white hover:bg-slate-700/60
                                                   transition-colors text-left border-b border-slate-700/30">
                                        <span>⚙️</span> Settings
                                    </button>
                                    <button
                                        onClick={() => { setUserMenuOpen(false); setShowChangePw(true); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm
                                                   text-slate-300 hover:text-white hover:bg-slate-700/60
                                                   transition-colors text-left">
                                        <span>🔒</span> Change Password
                                    </button>
                                    <button
                                        onClick={() => { setUserMenuOpen(false); setShowRevealPw(true); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm
                                                   text-amber-400 hover:text-amber-300 hover:bg-amber-900/20
                                                   transition-colors text-left border-t border-slate-700/30">
                                        <span>🔓</span> View / Recover Password
                                    </button>
                                    <button
                                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm
                                                   text-red-400 hover:text-red-300 hover:bg-red-900/20
                                                   transition-colors text-left border-t border-slate-700/50">
                                        <span>🚪</span> Logout
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </header>
            )}

            {/* Index ticker — desktop only */}
            {!isMobile && (
                <div className="flex-shrink-0 bg-slate-900/80 border-b border-slate-700/40 overflow-x-auto scrollbar-hide">
                    <SilentErrorBoundary>
                        <IndexTicker />
                    </SilentErrorBoundary>
                </div>
            )}

            {/* -- CONTENT AREA -- */}
            <div className="flex-1 flex overflow-hidden">

                {/* Mobile backdrop for sidebar (kept for desktop hamburger fallback) */}
                {sidebarOpen && !isMobile && (
                    <div
                        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* -- SIDEBAR — desktop only -- */}
                {!isMobile && (
                    <aside className={
                        "flex-col bg-slate-900 border-r border-slate-700/60 overflow-y-auto z-40 " +
                        "transition-transform duration-200 " +
                        "fixed inset-y-0 left-0 w-64 " +
                        (sidebarOpen ? "flex translate-x-0" : "flex -translate-x-full ") +
                        "md:relative md:flex md:translate-x-0 md:w-52 md:flex-shrink-0"
                    }>
                        <nav className="flex-1 p-3 space-y-1">
                            <SectionHeader icon="📈" label="Stocks"
                                           expanded={stocksOpen}
                                           onToggle={() => setStocksOpen(v => !v)} />
                            {stocksOpen && (
                                <div className="space-y-0.5 pl-1">
                                    {STOCKS_LINKS.map(l => <NavLink key={l.to} {...l} />)}
                                </div>
                            )}

                            <div className="h-px bg-slate-700/40 my-2" />

                            <SectionHeader icon="📊" label="Mutual Funds"
                                           expanded={mfOpen}
                                           onToggle={() => setMfOpen(v => !v)} />
                            {mfOpen && (
                                <div className="space-y-0.5 pl-1">
                                    {MF_LINKS.map(l => <NavLink key={l.to} {...l} />)}
                                </div>
                            )}

                            <div className="h-px bg-slate-700/40 my-2" />

                            <NavLink to="/portfolio" icon="⊞" label="Combined Portfolio" exact />
                            <NavLink to="/settings" icon="⚙️" label="Settings" exact />

                            {isAdmin && (
                                <>
                                    <div className="h-px bg-slate-700/40 my-2" />
                                    <div className="px-3 py-1">
                                        <p className="text-[10px] text-slate-600 font-semibold
                                                      uppercase tracking-widest">
                                            {isCreator ? "👑 Creator" : "Admin"}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5 pl-1">
                                        <AdminNavLink to="/admin"           icon="🏠" label="Dashboard" exact />
                                        {/* Only shown to regular Admins, not Creator — Creator has
                                            Client Tracker instead, which now carries the same real
                                            portfolio data this page shows. Admins have no Client
                                            Tracker access at all (it's hasRole('CREATOR') on the
                                            backend), so this stays their only way to see clients. */}
                                        {!isCreator && (
                                            <AdminNavLink to="/admin/clients" icon="👥" label="Clients" />
                                        )}
                                        <AdminNavLink to="/admin/analytics" icon="📊" label="Analytics" />
                                        {isCreator && CREATOR_LINKS.map(l => (
                                            <AdminNavLink key={l.to} {...l} />
                                        ))}
                                        {isCreator && (
                                            <AdminNavLink to="/admin/ai-report" icon="🤖" label="AI Report" />
                                        )}
                                    </div>
                                </>
                            )}
                        </nav>

                        <div className="p-3 border-t border-slate-700/40">
                            <p className="text-xs text-slate-600 text-center">NSE · BSE · AMFI</p>
                        </div>
                    </aside>
                )}

                {/* -- MAIN CONTENT -- overflow-x-hidden clips the page-slide's off-screen
                    travel at the viewport edge; the pages' full-bleed rows sit AT the edge
                    so they stay uncut. Never put overflow-x on the inner page wrapper. */}
                <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-950">
                    {/* Pull-to-refresh spinner — slides down with the pull, spins while refreshing */}
                    {isMobile && (ptrDist > 0 || ptrBusy) && (
                        <div style={{
                            position: "fixed", top: 56, left: "50%", zIndex: 40, pointerEvents: "none",
                            transform: `translateX(-50%) translateY(${(ptrBusy ? ptrThreshold : ptrDist) - 24}px)`,
                            transition: ptrBusy ? "none" : "transform .15s ease-out",
                            opacity: Math.min(1, (ptrBusy ? ptrThreshold : ptrDist) / 40),
                        }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: "50%",
                                background: "#0f1626", border: "1px solid rgba(134,59,255,0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                            }}>
                                <div className={ptrBusy ? "ptr-spin" : ""} style={{
                                    width: 16, height: 16, borderRadius: "50%",
                                    border: "2px solid rgba(148,163,184,0.3)",
                                    borderTopColor: "#863bff",
                                    transform: ptrBusy ? undefined : `rotate(${ptrDist * 3}deg)`,
                                }} />
                            </div>
                        </div>
                    )}
                    <div className={isMobile ? "p-3 pb-24" : "p-3 sm:p-4 md:p-6"}>
                        <InboxContext.Provider value={{
                            openInbox:  () => setShowInbox(true),
                            closeInbox: () => setShowInbox(false),
                        }}>
                            <PageTransition isCreator={isCreator}>{children}</PageTransition>
                        </InboxContext.Provider>
                    </div>
                </main>
            </div>

            {selectedStock && (
                <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />
            )}
            {selectedMf && (
                <MfSchemeDetailModal
                    scheme={selectedMf}
                    onClose={() => setSelectedMf(null)}
                    onTransact={() => { setSelectedMf(null); navigate("/mf"); }}
                />
            )}

            {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
            {showRevealPw && <RevealPasswordModal onClose={() => setShowRevealPw(false)} />}
            {showAiChat && <AiChatModal onClose={() => setShowAiChat(false)} />}
            {showInbox && (
                <InboxPanel
                    onClose={() => setShowInbox(false)}
                    onUnreadChange={() => setInboxUnread(prev => Math.max(0, prev - 1))}
                />
            )}

            <CommandPalette
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                onStockSelect={(s) => { setSearchOpen(false); setSelectedStock(s); }}
                onMfSelect={(m) => { setSearchOpen(false); setSelectedMf(m); }}
            />

            {/* Mobile bottom navigation */}
            {isMobile && (
                <>
                    {showMore && (
                        <MobileMoreDrawer
                            onClose={() => setShowMore(false)}
                            isAdmin={isAdmin}
                            isCreator={isCreator}
                        />
                    )}
                    <MobileBottomNav
                        currentPath={location.pathname}
                        showMore={showMore}
                        onShowMore={() => setShowMore(true)}
                        onHideMore={() => setShowMore(false)}
                        isCreator={isCreator}
                    />
                </>
            )}
        </div>
    );
}