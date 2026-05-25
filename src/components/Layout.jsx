import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme, THEMES } from "../context/ThemeContext";
import { useAuth }  from "../context/AuthContext";
import IndexTicker  from "./IndexTicker";
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

// ── Board helpers ─────────────────────────────────────────────────────────────
const BOARD_KEY = `ms_board_stocks`;   // keep export working
export function addToBoard(stock) {
    try {
        const existing = JSON.parse(localStorage.getItem(BOARD_KEY) || "[]");
        if (existing.some(s => s.symbol === stock.symbol)) return false;
        const updated = [...existing, {
            id: stock.id,
            symbol: stock.symbol,
            name: stock.name,
            exchange: stock.exchange
        }];
        localStorage.setItem(BOARD_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event("ms_board_updated"));
        return true;
    } catch { return false; }
}
export function getBoardStocks() {
    try { return JSON.parse(localStorage.getItem(BOARD_KEY) || "[]"); }
    catch { return []; }
}
export function removeFromBoard(symbol) {
    try {
        const existing = JSON.parse(localStorage.getItem(BOARD_KEY) || "[]");
        localStorage.setItem(BOARD_KEY, JSON.stringify(existing.filter(s => s.symbol !== symbol)));
        window.dispatchEvent(new Event("ms_board_updated"));
    } catch {}
}

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
    const navigate = useNavigate();

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

    const handleLogout = () => {
        // Clear all user-specific localStorage on logout
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

    return (
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">

            {/* ── TOP NAVBAR ── */}
            <header className="flex-shrink-0 h-16 bg-slate-900 border-b
                   border-slate-700/60 flex items-center px-3 sm:px-4
                   gap-2 sm:gap-3 z-30 relative">

                {/* Hamburger — mobile only */}
                <button
                    onClick={() => setSidebarOpen(v => !v)}
                    className="md:hidden flex-shrink-0 p-2 rounded-lg text-slate-400
                               hover:text-white hover:bg-slate-700 transition-colors"
                    aria-label="Toggle menu">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor"
                         strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>

                {/* ── Brand logo — single Link, properly closed ── */}
                <Link to="/stocks" className="flex items-center gap-2 flex-shrink-0">
                    <AppLogo className="w-8 h-8" />
                    <div className="hidden sm:block">
                        <FolyoBrand size="xs" />
                    </div>
                </Link>

                <div className="h-5 w-px bg-slate-700 flex-shrink-0 hidden sm:block" />

                {/* ✨ FOLYO AI — prominent, always labeled, pulsing glow */}
                <button
                    onClick={() => setShowAiChat(true)}
                    className="ai-glow flex-shrink-0 flex items-center gap-1.5
                               px-3 py-2
                               bg-gradient-to-r from-blue-600 to-purple-600
                               hover:from-blue-500 hover:to-purple-500
                               border border-blue-400/40 rounded-xl
                               transition-all duration-200 text-white">
                    <span className="text-base leading-none">✨</span>
                    <span className="text-xs font-bold tracking-wide">FOLYO AI</span>
                </button>

                {/* Creator live cost badge */}
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

                {/* Search trigger — command palette */}
                {/* Search trigger — absolutely centered in header */}
                <button
                    onClick={() => setSearchOpen(true)}
                    className="absolute left-1/2 -translate-x-1/2
                               w-[36%] min-w-[220px] max-w-[480px]
                               flex items-center gap-3 px-4 py-2
                               bg-slate-800/70 hover:bg-slate-800
                               border border-slate-700 hover:border-slate-600
                               rounded-xl text-left transition-all duration-150 group">
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

                {/* Right side items */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">

                    {/* Role badge */}
                    {isCreator && (
                        <span className="hidden md:inline-flex text-xs bg-amber-500/20
                                         text-amber-400 border border-amber-500/40
                                         px-2.5 py-1 rounded-full font-bold">
                            👑 CREATOR
                        </span>
                    )}
                    {isAdmin && !isCreator && (
                        <span className="hidden md:inline-flex text-xs bg-amber-500/20
                                         text-amber-400 border border-amber-500/30
                                         px-2.5 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                    )}

                    {/* Portfolio value */}
                    {totalValue && (
                        <div className="hidden md:flex flex-col items-end bg-slate-800
                                        border border-slate-700 rounded-xl px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Portfolio</span>
                                <span className="text-sm font-bold text-white">
                                    {fmtCrore(totalValue)}
                                </span>
                            </div>
                            {totalPL && (
                                <span className={"text-xs font-semibold " +
                                (isPLPos ? "text-green-400" : "text-red-400")}>
                                    P&L {isPLPos ? "+" : ""}{fmtCrore(totalPL)}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Theme dropdown */}
                    <div ref={themeRef} className="relative">
                        <button onClick={() => setThemeOpen(v => !v)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-800
                                           hover:bg-slate-700 border border-slate-700
                                           rounded-xl text-sm transition-colors">
                            <span className="text-base leading-none">{theme.emoji}</span>
                            <span className="text-slate-300 text-xs hidden md:block font-medium">
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
                            className="flex items-center gap-2 bg-slate-800 border border-slate-700
                                       rounded-xl px-3 py-1.5 hover:bg-slate-700 transition-colors">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center
                                            justify-center text-white text-xs font-bold flex-shrink-0">
                                {user?.username?.[0]?.toUpperCase() || "U"}
                            </div>
                            <span className="text-sm text-white hidden sm:block">
                                {user?.username}
                            </span>
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

            {/* ── INDEX BAR   Indices ── */}
            <div className="flex-shrink-0 bg-slate-900/80 border-b border-slate-700/40 overflow-x-auto scrollbar-hide">
                <IndexTicker />
            </div>

            {/* ── CONTENT AREA ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Mobile backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* ── SIDEBAR ── */}
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

                {/* ── MAIN CONTENT ── */}
                <main className="flex-1 overflow-y-auto bg-slate-950">
                    <div className="p-3 sm:p-4 md:p-6">{children}</div>
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
            <CommandPalette
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                onStockSelect={(s) => { setSearchOpen(false); setSelectedStock(s); }}
                onMfSelect={(m) => { setSearchOpen(false); setSelectedMf(m); }}
            />
        </div>
    );
}

// // ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
// function GlobalSearch({ onStockSelect, onMfSelect }) {
//     const [query,    setQuery]    = useState("");
//     const [results,  setResults]  = useState({ stocks: [], mf: [] });
//     const [open,     setOpen]     = useState(false);
//     const [loading,  setLoading]  = useState(false);
//     const [tab,      setTab]      = useState("stocks");
//     const [recent,   setRecent]   = useState([]);
//     const [recentMf, setRecentMf] = useState([]);
//     const debounceRef = useRef(null);
//     const wrapRef     = useRef(null);
//     const navigate    = useNavigate();
//     const toast       = useToast();
//
//     useEffect(() => {
//         const h = (e) => {
//             if (wrapRef.current && !wrapRef.current.contains(e.target))
//                 setOpen(false);
//         };
//         document.addEventListener("mousedown", h);
//         return () => document.removeEventListener("mousedown", h);
//     }, []);
//
//     useEffect(() => {
//         const refresh = () => {
//             setRecent(getRecentStocks().slice(0, 20));
//             setRecentMf(getRecentMf().slice(0, 20));
//         };
//         refresh();
//         window.addEventListener("ms_recent_updated",    refresh);
//         window.addEventListener("ms_mf_recent_updated", refresh);
//         window.addEventListener("storage",              refresh);
//         return () => {
//             window.removeEventListener("ms_recent_updated",    refresh);
//             window.removeEventListener("ms_mf_recent_updated", refresh);
//             window.removeEventListener("storage",              refresh);
//         };
//     }, []);
//
//     const handleSearch = (q) => {
//         setQuery(q);
//         clearTimeout(debounceRef.current);
//         if (q.length < 2) {
//             setResults({ stocks: [], mf: [] });
//             setOpen(true);
//             return;
//         }
//         setLoading(true);
//         setOpen(true);
//         debounceRef.current = setTimeout(async () => {
//             try {
//                 const [sRes, mRes] = await Promise.allSettled([
//                     searchStocks(q), searchMfSchemes(q)
//                 ]);
//                 const stocks = sRes.status === "fulfilled"
//                     ? (sRes.value?.content || sRes.value?.data?.content || []) : [];
//                 const mf     = mRes.status === "fulfilled"
//                     ? (mRes.value?.content || mRes.value?.data?.content || []) : [];
//                 setResults({ stocks, mf });
//                 setTab(stocks.length > 0 ? "stocks" : "mf");
//             } catch {}
//             finally { setLoading(false); }
//         }, 300);
//     };
//
//     const selectStock = async (item) => {
//         setOpen(false);
//         setQuery("");
//         trackStockView(item);
//         onStockSelect(item);
//         try {
//             const res = await getStockPrice(item.symbol);
//             const p   = res?.data || res;
//             if (p?.changePercent != null || p?.currentPrice != null) {
//                 trackStockView({
//                     ...item,
//                     changePercent: p.changePercent ?? p.regularMarketChangePercent ?? null,
//                     change:        p.change        ?? p.regularMarketChange        ?? null,
//                 });
//             }
//         } catch {}
//     };
//
//     const handleAddWatchlist = async (stock) => {
//         try {
//             await addToWatchlist({ stockId: stock.id });
//             toast.success(`${stock.symbol} added to watchlist`);
//         } catch (err) {
//             toast.error(err.response?.data?.message || "Already in watchlist");
//         }
//     };
//
//     const activeList     = tab === "stocks" ? results.stocks : results.mf;
//     const isTyping       = query.length >= 2;
//     const searchSymbols  = new Set(results.stocks.map(s => s.symbol));
//     const filteredRecent = recent.filter(s => !searchSymbols.has(s.symbol));
//     const showRecent     = !isTyping && recent.length > 0;
//     const showResults    = isTyping;
//
//     return (
//         <div ref={wrapRef} className="relative w-full">
//             <div className="relative">
//                 <input
//                     type="text"
//                     value={query}
//                     onChange={e => handleSearch(e.target.value)}
//                     onFocus={() => {
//                         setOpen(true);
//                         setTab("stocks");
//                         setRecent(getRecentStocks().slice(0, 20));
//                     }}
//                     placeholder="Search stocks & MF..."
//                     className="w-full bg-slate-800 border border-slate-700 rounded-xl
//                                px-4 py-2 text-white text-xs focus:outline-none
//                                focus:border-blue-500 transition-all duration-200
//                                placeholder:text-slate-500"
//                 />
//                 {loading && (
//                     <div className="absolute right-3 top-1/2 -translate-y-1/2">
//                         <div className="w-3 h-3 border-2 border-blue-400
//                                         border-t-transparent rounded-full animate-spin" />
//                     </div>
//                 )}
//             </div>
//
//             {open && (
//                 <div className="absolute left-0 top-full mt-1 bg-slate-800 border
//                 border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
//                      style={{ width: "360px", maxWidth: "calc(100vw - 32px)" }}>
//
//                     {/* Recently viewed */}
//                     {showRecent && (
//                         <>
//                             <div className="flex border-b border-slate-700">
//                                 {[
//                                     { id: "stocks", label: `🕐 Stocks (${filteredRecent.length})` },
//                                     { id: "mf",     label: `📊 MF (${recentMf.length})` },
//                                 ].map(t => (
//                                     <button key={t.id} onClick={() => setTab(t.id)}
//                                             className={"flex-1 py-2.5 text-xs font-semibold " +
//                                             "transition-colors " +
//                                             (tab === t.id
//                                                 ? "text-white border-b-2 border-blue-500 bg-slate-700/40"
//                                                 : "text-slate-400 hover:text-white")}>
//                                         {t.label}
//                                     </button>
//                                 ))}
//                             </div>
//
//                             {tab === "stocks" && (
//                                 <div className="max-h-72 overflow-y-auto">
//                                     {filteredRecent.length === 0 ? (
//                                         <p className="text-slate-500 text-xs text-center py-6">
//                                             No recently viewed stocks
//                                         </p>
//                                     ) : filteredRecent.map((stock, i) => {
//                                         const pct   = parseFloat(stock.changePercent ?? 0);
//                                         const isPos = pct >= 0;
//                                         return (
//                                             <div key={i}
//                                                  className="flex items-center justify-between
//                                                             px-4 py-2.5 border-b border-slate-700/30
//                                                             last:border-0 hover:bg-slate-700/40
//                                                             transition-colors cursor-pointer"
//                                                  onClick={() => selectStock(stock)}>
//                                                 <div className="flex-1 min-w-0">
//                                                     <div className="flex items-center gap-2">
//                                                         <p className="text-white text-xs font-bold">
//                                                             {stock.symbol}
//                                                         </p>
//                                                         <span className="text-slate-600 text-[10px]">
//                                                             {stock.exchange}
//                                                         </span>
//                                                     </div>
//                                                     <p className="text-slate-400 text-xs truncate">
//                                                         {stock.name}
//                                                     </p>
//                                                 </div>
//                                                 {stock.changePercent != null && (
//                                                     <span className={`text-xs font-semibold ml-3
//                                                         flex-shrink-0 ${isPos
//                                                         ? "text-green-400" : "text-red-400"}`}>
//                                                         {isPos ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
//                                                     </span>
//                                                 )}
//                                             </div>
//                                         );
//                                     })}
//                                 </div>
//                             )}
//
//                             {tab === "mf" && (
//                                 <div className="max-h-72 overflow-y-auto">
//                                     {recentMf.length === 0 ? (
//                                         <p className="text-slate-500 text-xs text-center py-6">
//                                             No recently viewed funds
//                                         </p>
//                                     ) : recentMf.map((mf, i) => (
//                                         <div key={i}
//                                              className="flex items-center justify-between
//                                                         px-4 py-2.5 border-b border-slate-700/30
//                                                         last:border-0 hover:bg-slate-700/40
//                                                         transition-colors cursor-pointer"
//                                              onClick={() => {
//                                                  setOpen(false);
//                                                  setQuery("");
//                                                  onMfSelect({
//                                                      schemeCode: mf.schemeCode,
//                                                      schemeName: mf.schemeName,
//                                                      fundHouse:  mf.fundHouse,
//                                                      nav:        mf.nav,
//                                                  });
//                                              }}>
//                                             <div className="flex-1 min-w-0">
//                                                 <p className="text-white text-xs font-semibold truncate">
//                                                     {mf.schemeName}
//                                                 </p>
//                                                 <p className="text-slate-400 text-xs">
//                                                     {mf.fundHouse}
//                                                     {mf.nav ? ` · NAV ₹${mf.nav}` : ""}
//                                                 </p>
//                                             </div>
//                                         </div>
//                                     ))}
//                                 </div>
//                             )}
//                         </>
//                     )}
//
//                     {/* Search results */}
//                     {showResults && (
//                         <>
//                             <div className="flex border-b border-slate-700">
//                                 {[
//                                     { id: "stocks", label: `📈 Stocks (${results.stocks.length})` },
//                                     { id: "mf",     label: `📊 MF (${results.mf.length})` },
//                                 ].map(t => (
//                                     <button key={t.id} onClick={() => setTab(t.id)}
//                                             className={"flex-1 py-2.5 text-xs font-semibold " +
//                                             "transition-colors " +
//                                             (tab === t.id
//                                                 ? "text-white border-b-2 border-blue-500 bg-slate-700/40"
//                                                 : "text-slate-400 hover:text-white")}>
//                                         {t.label}
//                                     </button>
//                                 ))}
//                             </div>
//                             <div className="max-h-72 overflow-y-auto">
//                                 {activeList.length === 0 ? (
//                                     <p className="text-slate-500 text-xs text-center py-6">
//                                         No {tab === "stocks" ? "stocks" : "funds"} found
//                                     </p>
//                                 ) : activeList.map((item, idx) => {
//                                     const isStock = tab === "stocks";
//                                     return (
//                                         <div key={idx}
//                                              className="flex items-center justify-between px-4
//                                                         py-2.5 border-b border-slate-700/40
//                                                         last:border-0 hover:bg-slate-700/40
//                                                         transition-colors">
//                                             <button className="text-left flex-1 min-w-0"
//                                                     onClick={() => {
//                                                         if (isStock) {
//                                                             trackStockView(item);
//                                                             selectStock(item);
//                                                         } else {
//                                                             trackMfView(item);
//                                                             setOpen(false);
//                                                             setQuery("");
//                                                             onMfSelect({
//                                                                 schemeCode: item.schemeCode,
//                                                                 schemeName: item.schemeName,
//                                                                 fundHouse:  item.fundHouse,
//                                                                 nav:        item.nav,
//                                                             });
//                                                         }
//                                                     }}>
//                                                 {isStock ? (
//                                                     <>
//                                                         <p className="text-white text-xs font-bold">
//                                                             {item.symbol}
//                                                             <span className="text-slate-500 font-normal ml-1">
//                                                                 {item.exchange}
//                                                             </span>
//                                                         </p>
//                                                         <p className="text-slate-400 text-xs truncate">
//                                                             {item.name}
//                                                         </p>
//                                                     </>
//                                                 ) : (
//                                                     <>
//                                                         <p className="text-white text-xs font-semibold
//                                                                       truncate leading-tight">
//                                                             {item.schemeName}
//                                                         </p>
//                                                         <p className="text-slate-400 text-xs">
//                                                             {item.fundHouse}
//                                                             {item.nav ? ` · NAV ₹${item.nav}` : ""}
//                                                         </p>
//                                                     </>
//                                                 )}
//                                             </button>
//                                             {isStock && (
//                                                 <div className="flex-shrink-0 ml-2 flex gap-1">
//                                                     <button
//                                                         onClick={e => {
//                                                             e.stopPropagation();
//                                                             handleAddWatchlist(item);
//                                                         }}
//                                                         className="text-xs px-2 py-1 bg-slate-700
//                                                                    hover:bg-blue-600 text-slate-400
//                                                                    hover:text-white rounded-lg
//                                                                    transition-colors">
//                                                         + Watch
//                                                     </button>
//                                                     <button
//                                                         onClick={e => {
//                                                             e.stopPropagation();
//                                                             const added = addToBoard(item);
//                                                             toast[added ? "success" : "error"](
//                                                                 added
//                                                                     ? `${item.symbol} added to board`
//                                                                     : `${item.symbol} already on board`
//                                                             );
//                                                         }}
//                                                         className="text-xs px-2 py-1 bg-slate-700
//                                                                    hover:bg-purple-600 text-slate-400
//                                                                    hover:text-white rounded-lg
//                                                                    transition-colors"
//                                                         title="Add to market board">
//                                                         + Board
//                                                     </button>
//                                                 </div>
//                                             )}
//                                         </div>
//                                     );
//                                 })}
//                             </div>
//                             {(results.stocks.length + results.mf.length) > 0 && (
//                                 <div className="px-4 py-2 border-t border-slate-700/40
//                                                 bg-slate-800/60">
//                                     <p className="text-xs text-slate-600 text-center">
//                                         {results.stocks.length + results.mf.length} results
//                                         — click to open chart
//                                     </p>
//                                 </div>
//                             )}
//                         </>
//                     )}
//                 </div>
//             )}
//         </div>
//     );
// }