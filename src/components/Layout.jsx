import { useState, useEffect, useRef } from "react";
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
import { getPendingNotifications, getInboxUnread } from "../api/admin";
import { usePrivacy } from "../context/PrivacyContext";

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
function MobileHeader({ onSearchOpen, onAiOpen, pendingNotifs = 0, user, onInboxOpen, portfolioSummary, onMoreOpen }) {
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

    return (
        <header style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            background: "#0f172a",
            borderBottom: "1px solid rgba(51,65,85,0.6)",
            position: "sticky", top: 0, zIndex: 50,
            height: 56, flexShrink: 0,
        }}>
            {/* Logo + portfolio value */}
            <Link to="/stocks" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0 }}>
                <span style={{ color: "white", fontWeight: 900, fontSize: 18,
                    letterSpacing: "-0.5px" }}>FOLYO</span>
            </Link>

            {/* Portfolio value strip — shown only when data is loaded */}
            {totalValue > 0 && (
                <div style={{
                    marginLeft: 4, paddingLeft: 8,
                    borderLeft: "1px solid rgba(51,65,85,0.6)",
                    flexShrink: 0,
                }}>
                    <div style={{ color: "white", fontSize: 11, fontWeight: 700,
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
            <button onClick={onSearchOpen} style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", background: "#1e293b",
                border: "1px solid rgba(51,65,85,0.6)",
                borderRadius: 12, textAlign: "left", minWidth: 0,
            }}>
                <svg style={{ width: 16, height: 16, color: "#64748b", flexShrink: 0 }}
                     fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/>
                    <path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                </svg>
                <span style={{ color: "#64748b", fontSize: 14, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Search stocks...
                </span>
            </button>

            {/* AI */}
            <button onClick={onAiOpen} style={{
                width: 36, height: 36, flexShrink: 0,
                background: "rgba(147,51,234,0.2)",
                border: "1px solid rgba(147,51,234,0.4)",
                borderRadius: 10, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 18, cursor: "pointer",
            }}>✨</button>

            {/* Inbox bell with badge */}
            <button onClick={onInboxOpen} style={{
                width: 36, height: 36, flexShrink: 0,
                background: "transparent", border: "none",
                borderRadius: 10, display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative",
            }}>
                <svg style={{ width: 20, height: 20 }} fill="none"
                     stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                {pendingNotifs > 0 && (
                    <span style={{
                        position: "absolute", top: 2, right: 2,
                        minWidth: 16, height: 16, background: "#ef4444",
                        borderRadius: 8, fontSize: 9, fontWeight: 700,
                        color: "white", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        padding: "0 3px",
                    }}>
                        {pendingNotifs > 9 ? "9+" : pendingNotifs}
                    </span>
                )}
            </button>

            {/* Profile — tapping opens the More drawer (same as tapping More tab).
                Was a dead <div> before; changed to <button> so it's tappable,
                keyboard-accessible, and semantically correct. */}
            <button
                onClick={onMoreOpen}
                style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#7c3aed", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "white", fontWeight: 700, fontSize: 14, flexShrink: 0,
                    border: "none", cursor: "pointer",
                }}>
                {initial}
            </button>
        </header>
    );
}

// ── Inline MobileBottomNav ────────────────────────────────────────────────────
function MobileBottomNav({ currentPath, onShowMore, showMore, onHideMore }) {
    const navigate = useNavigate();
    const tabs = [
        { id: "market",       label: "Market",    to: "/stocks",              exact: true,
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round"/></svg> },
        { id: "holdings",     label: "Holdings",  to: "/stocks/holdings",
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" strokeLinecap="round"/></svg> },
        { id: "transactions", label: "Trades",    to: "/stocks/transactions",
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
        { id: "watchlist",    label: "Watchlist", to: "/stocks/watchlist",
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M12 4.318C9.403.5 3 1.545 3 8c0 4.5 9 12 9 12s9-7.5 9-12c0-6.455-6.403-7.5-9-3.682z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
        { id: "more",         label: "More",      to: null,
            icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg> },
    ];
    const isActive = (tab) => {
        if (tab.id === "more") return showMore;
        if (tab.exact) return currentPath === tab.to;
        return currentPath.startsWith(tab.to);
    };
    return (
        <nav style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: 9000,
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
            backgroundColor: "#0f172a",
            borderTop: "1px solid rgba(51,65,85,0.6)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
            {tabs.map(tab => {
                const active = isActive(tab);
                return (
                    <button key={tab.id}
                            onClick={() => {
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
    const items = [
        { label: "MF Market",          to: "/mf",               icon: "📊" },
        { label: "MF Holdings",        to: "/mf/holdings",      icon: "💼" },
        { label: "MF Transactions",    to: "/mf/transactions",  icon: "🔄" },
        { label: "MF Watchlist",       to: "/mf/watchlist",     icon: "👁" },
        { label: "Alerts",             to: "/stocks/alerts",    icon: "🔔" },
        { label: "Combined Portfolio", to: "/portfolio",         icon: "⊞" },
    ];
    return (
        <>
            <div onClick={onClose}
                 style={{
                     position: "fixed", inset: 0, zIndex: 8998,
                     backgroundColor: "rgba(0,0,0,0.6)",
                 }} />
            <div style={{
                position: "fixed", bottom: 64, left: 0, right: 0,
                zIndex: 8999,
                backgroundColor: "#0f172a",
                borderTop: "1px solid rgba(51,65,85,0.6)",
                borderRadius: "16px 16px 0 0",
                padding: "16px",
            }}>
                <div style={{ width: 40, height: 4, background: "#334155",
                    borderRadius: 2, margin: "0 auto 16px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {items.map(item => (
                        <button key={item.to} onClick={() => go(item.to)}
                                style={{
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", gap: 6,
                                    padding: "12px 8px",
                                    background: "#1e293b",
                                    border: "1px solid rgba(51,65,85,0.6)",
                                    borderRadius: 12, cursor: "pointer",
                                    color: "#cbd5e1",
                                }}>
                            <span style={{ fontSize: 22 }}>{item.icon}</span>
                            <span style={{ fontSize: 11, fontWeight: 500,
                                textAlign: "center", lineHeight: 1.3 }}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
                {isAdmin && (
                    <div style={{ marginTop: 12, paddingTop: 12,
                        borderTop: "1px solid rgba(51,65,85,0.4)" }}>
                        <p style={{ fontSize: 10, color: "#475569", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.08em",
                            marginBottom: 8 }}>
                            {isCreator ? "👑 Creator" : "Admin"}
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {[
                                { to: "/admin",           label: "Dashboard" },
                                { to: "/admin/clients",   label: "Clients"   },
                                { to: "/admin/analytics", label: "Analytics" },
                            ].map(l => (
                                <button key={l.to} onClick={() => go(l.to)}
                                        style={{
                                            padding: "6px 12px",
                                            background: "#1e293b",
                                            border: "1px solid rgba(51,65,85,0.6)",
                                            borderRadius: 8, cursor: "pointer",
                                            color: "#94a3b8", fontSize: 12,
                                        }}>
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// -- Board helpers ------------------------------------------------------------

export async function addToBoard(stock) {
    try {
        await addToBoardApi({
            symbol:   stock.symbol,
            name:     stock.name     || stock.companyName || stock.symbol,
            exchange: stock.exchange || "NSE",
        });
        window.dispatchEvent(new Event("ms_board_updated"));
        return true;
    } catch {
        return false;
    }
}

export async function removeFromBoard(symbol) {
    try {
        await removeFromBoardApi(symbol);
        window.dispatchEvent(new Event("ms_board_updated"));
    } catch {}
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
    { to: "/admin/notifications", icon: "🔔", label: "Notifications" },
    { to: "/admin/users",         icon: "👤", label: "Users"         },
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

export default function Layout({ children, portfolioSummary }) {
    const { theme, themeId, setThemeId } = useTheme();
    const [themeOpen, setThemeOpen] = useState(false);
    const themeRef = useRef(null);
    const { user, logout, isAdmin, isCreator } = useAuth();
    const { hidden: valuesHidden, toggle: togglePrivacy } = usePrivacy();
    const navigate  = useNavigate();
    const location  = useLocation();
    const isMobile  = useMobile();

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
        return () => clearInterval(t);
    }, [isCreator]);

    return (
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">

            {/* ── Mobile header — shown only on small screens ── */}
            {isMobile && (
                <MobileHeader
                    onSearchOpen={() => setSearchOpen(true)}
                    onAiOpen={() => setShowAiChat(true)}
                    pendingNotifs={inboxUnread}
                    user={user}
                    onInboxOpen={() => setShowInbox(true)}
                    portfolioSummary={portfolioSummary}
                    onMoreOpen={() => setShowMore(true)}
                />
            )}

            {/* ── Desktop header — hidden on mobile ── */}
            {!isMobile && (
                <header className="flex-shrink-0 h-16 bg-slate-900 border-b
                       border-slate-700/60 flex items-center px-3 sm:px-4
                       gap-2 sm:gap-3 z-30">

                    <Link to="/stocks" className="flex items-center gap-2 flex-shrink-0">
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

                        {showChangePw && (
                            <ChangePasswordModal onClose={() => setShowChangePw(false)} />
                        )}
                        {showRevealPw && (
                            <RevealPasswordModal onClose={() => setShowRevealPw(false)} />
                        )}
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
                                        <AdminNavLink to="/admin/clients"   icon="👥" label="Clients"   />
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

                {/* -- MAIN CONTENT -- */}
                <main className="flex-1 overflow-y-auto bg-slate-950">
                    <div className={isMobile ? "p-3 pb-24" : "p-3 sm:p-4 md:p-6"}>
                        <InboxContext.Provider value={{
                            openInbox:  () => setShowInbox(true),
                            closeInbox: () => setShowInbox(false),
                        }}>
                            {children}
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
                    />
                </>
            )}
        </div>
    );
}