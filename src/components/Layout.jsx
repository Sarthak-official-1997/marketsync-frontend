import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme, THEMES } from "../context/ThemeContext";
import { useAuth }  from "../context/AuthContext";
import IndexTicker  from "./IndexTicker";
import { searchStocks, searchMfSchemes, addToWatchlist } from "../api/portfolio";
import { useToast } from "../context/ToastContext";
import StockDetailModal from "./StockDetailModal";
import { trackStockView } from "./RecentStocksMarquee";
import ChangePasswordModal from "./ChangePasswordModal";

import logo from "../assets/logo.png";

// ── Board helpers ─────────────────────────────────────────────────────────────
// The "board" is the market page's personal stock widget.
// Stored in localStorage so it persists across sessions.
const BOARD_KEY = "ms_board_stocks";
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
    { to: "/admin/users",    icon: "👤", label: "Users" },
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

// Amber-styled nav link for admin section
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

    const [stocksOpen,    setStocksOpen]    = useState(true);
    const [mfOpen,        setMfOpen]        = useState(true);
    const [selectedStock, setSelectedStock] = useState(null);

    const [userMenuOpen,       setUserMenuOpen]       = useState(false);
    const [showChangePw,       setShowChangePw]       = useState(false);
    const userMenuRef = useRef(null);

    const handleLogout = () => { logout(); navigate("/login"); };

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
            if (themeRef.current && !themeRef.current.contains(e.target)) setThemeOpen(false);
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

    return (
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
            {/* ── TOP NAVBAR ── */}
            <header className="flex-shrink-0 h-14 bg-slate-900 border-b
                               border-slate-700/60 flex items-center px-4 gap-4 z-30">
                <Link to="/stocks" className="flex items-center gap-2 flex-shrink-0">
                    <img
                        src={logo}
                        alt="MarketSync Logo"
                        className="w-8 h-8 rounded-lg object-cover"
                    />

                    <span className="font-bold text-white text-sm hidden sm:block">
                        915 CLUB MarketSync
                    </span>
                </Link>
                <div className="h-5 w-px bg-slate-700 flex-shrink-0" />

                <div className="flex-1 overflow-x-auto scrollbar-hide min-w-0">
                    <IndexTicker />
                </div>

                <GlobalSearch onStockSelect={setSelectedStock} />

                <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Role badge — CREATOR gets gold crown, ADMIN gets amber */}
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

                    {totalValue && (
                        <div className="hidden md:flex flex-col items-end bg-slate-800
                                        border border-slate-700 rounded-xl px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Portfolio</span>
                                <span className="text-sm font-bold text-white">{fmtCrore(totalValue)}</span>
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
                                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">🌙 Dark</p>
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
                                        {themeId === t.id && <span className="text-blue-400 text-xs">✓</span>}
                                    </button>
                                ))}
                                <div className="px-3 py-2 border-t border-b border-slate-700/50">
                                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">☀️ Light</p>
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
                                                <div key={i} className="w-3 h-3 rounded-sm border border-slate-600"
                                                     style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                        {themeId === t.id && <span className="text-blue-400 text-xs">✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div ref={userMenuRef} className="relative">
                        <button
                            onClick={() => setUserMenuOpen(v => !v)}
                            className="flex items-center gap-2 bg-slate-800 border border-slate-700
                   rounded-xl px-3 py-1.5 hover:bg-slate-700 transition-colors">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center
                        justify-center text-white text-xs font-bold flex-shrink-0">
                                {user?.username?.[0]?.toUpperCase() || "U"}
                            </div>
                            <span className="text-sm text-white hidden sm:block">{user?.username}</span>
                            <span className="text-slate-500 text-xs">▾</span>
                        </button>

                        {userMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border
                        border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                {/* User info header */}
                                <div className="px-4 py-3 border-b border-slate-700/50">
                                    <p className="text-white font-semibold text-sm">{user?.fullName || user?.username}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{user?.email || user?.username}</p>
                                    <span className={
                                        "inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-bold border " +
                                        (user?.role === "CREATOR"
                                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                            : user?.role === "ADMIN"
                                                ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                                : "bg-blue-500/20 text-blue-400 border-blue-500/30")
                                    }>
                    {user?.role === "CREATOR" ? "👑 CREATOR" : user?.role}
                </span>
                                </div>

                                {/* Change password */}
                                <button
                                    onClick={() => { setUserMenuOpen(false); setShowChangePw(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm
                           text-slate-300 hover:text-white hover:bg-slate-700/60
                           transition-colors text-left">
                                    <span>🔑</span> Change Password
                                </button>

                                {/* Logout */}
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

                    {/* Change password modal */}
                    {showChangePw && (
                        <ChangePasswordModal onClose={() => setShowChangePw(false)} />
                    )}
                </div>
            </header>

            {/* ── CONTENT AREA ── */}
            <div className="flex-1 flex overflow-hidden">
                {/* ── SIDEBAR ── */}
                <aside className="w-52 flex-shrink-0 bg-slate-900 border-r
                                  border-slate-700/60 flex flex-col overflow-y-auto">
                    <nav className="flex-1 p-3 space-y-1">
                        <SectionHeader icon="📈" label="Stocks"
                                       expanded={stocksOpen} onToggle={() => setStocksOpen(v => !v)} />
                        {stocksOpen && (
                            <div className="space-y-0.5 pl-1">
                                {STOCKS_LINKS.map(l => <NavLink key={l.to} {...l} />)}
                            </div>
                        )}

                        <div className="h-px bg-slate-700/40 my-2" />

                        <SectionHeader icon="📊" label="Mutual Funds"
                                       expanded={mfOpen} onToggle={() => setMfOpen(v => !v)} />
                        {mfOpen && (
                            <div className="space-y-0.5 pl-1">
                                {MF_LINKS.map(l => <NavLink key={l.to} {...l} />)}
                            </div>
                        )}

                        <div className="h-px bg-slate-700/40 my-2" />

                        <NavLink to="/portfolio" icon="⊞" label="Combined Portfolio" exact />

                        {/* Admin section — visible to ADMIN and CREATOR */}
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
                                    <AdminNavLink to="/admin"            icon="🏠" label="Dashboard" exact />
                                    <AdminNavLink to="/admin/clients"    icon="👥" label="Clients"            />
                                    <AdminNavLink to="/admin/analytics"  icon="📊" label="Analytics"          />
                                    {/* CREATOR-only links */}
                                    {isCreator && CREATOR_LINKS.map(l => (
                                        <AdminNavLink key={l.to} {...l} />
                                    ))}
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
                    <div className="p-6">{children}</div>
                </main>
            </div>

            {selectedStock && (
                <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />
            )}
        </div>
    );
}

// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
function GlobalSearch({ onStockSelect }) {
    const [query,   setQuery]   = useState("");
    const [results, setResults] = useState({ stocks: [], mf: [] });
    const [open,    setOpen]    = useState(false);
    const [loading, setLoading] = useState(false);
    const [tab,     setTab]     = useState("stocks");
    const debounceRef = useRef(null);
    const wrapRef     = useRef(null);
    const navigate    = useNavigate();
    const toast       = useToast();

    useEffect(() => {
        const h = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults({ stocks: [], mf: [] }); setOpen(false); return; }
        setLoading(true); setOpen(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const [sRes, mRes] = await Promise.allSettled([searchStocks(q), searchMfSchemes(q)]);
                const stocks = sRes.status === "fulfilled" ? (sRes.value?.content || sRes.value?.data?.content || []) : [];
                const mf     = mRes.status === "fulfilled" ? (mRes.value?.content || mRes.value?.data?.content || []) : [];
                setResults({ stocks, mf });
                setTab(stocks.length > 0 ? "stocks" : "mf");
            } catch {} finally { setLoading(false); }
        }, 300);
    };

    const handleAddWatchlist = async (stock) => {
        try {
            await addToWatchlist({ stockId: stock.id });
            toast.success(`${stock.symbol} added to watchlist`);
        } catch (err) {
            toast.error(err.response?.data?.message || "Already in watchlist");
        }
    };

    const activeList = tab === "stocks" ? results.stocks : results.mf;

    return (
        <div ref={wrapRef} className="relative flex-shrink-0">
            <div className="relative">
                <input type="text" value={query}
                       onChange={e => handleSearch(e.target.value)}
                       onFocus={() => query.length >= 2 && setOpen(true)}
                       placeholder="Search stocks & MF..."
                       className="w-56 bg-slate-800 border border-slate-700 rounded-xl
                                  px-4 py-2 text-white text-xs focus:outline-none
                                  focus:border-blue-500 focus:w-72 transition-all duration-200
                                  placeholder:text-slate-500" />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent
                                        rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {open && query.length >= 2 && (
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border
                                border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                     style={{ width: "360px" }}>
                    <div className="flex border-b border-slate-700">
                        {[
                            { id: "stocks", label: `📈 Stocks (${results.stocks.length})` },
                            { id: "mf",     label: `📊 MF (${results.mf.length})` },
                        ].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                    className={"flex-1 py-2.5 text-xs font-semibold transition-colors " +
                                    (tab === t.id
                                        ? "text-white border-b-2 border-blue-500 bg-slate-700/40"
                                        : "text-slate-400 hover:text-white")}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                        {activeList.length === 0 ? (
                            <p className="text-slate-500 text-xs text-center py-6">
                                No {tab === "stocks" ? "stocks" : "funds"} found
                            </p>
                        ) : activeList.map((item, idx) => {
                            const isStock = tab === "stocks";
                            return (
                                <div key={idx}
                                     className="flex items-center justify-between px-4 py-2.5
                                                border-b border-slate-700/40 last:border-0
                                                hover:bg-slate-700/40 transition-colors">
                                    <button className="text-left flex-1 min-w-0"
                                            onClick={() => {
                                                setOpen(false); setQuery("");
                                                if (isStock) {
                                                    trackStockView(item);
                                                    onStockSelect(item);
                                                } else {
                                                    navigate("/mf");
                                                }
                                            }}>
                                        {isStock ? (
                                            <>
                                                <p className="text-white text-xs font-bold">
                                                    {item.symbol}
                                                    <span className="text-slate-500 font-normal ml-1">{item.exchange}</span>
                                                </p>
                                                <p className="text-slate-400 text-xs truncate">{item.name}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-white text-xs font-semibold truncate leading-tight">
                                                    {item.schemeName}
                                                </p>
                                                <p className="text-slate-400 text-xs">
                                                    {item.fundHouse}{item.nav ? ` · NAV ₹${item.nav}` : ""}
                                                </p>
                                            </>
                                        )}
                                    </button>
                                    {isStock && (
                                        <div className="flex-shrink-0 ml-2 flex gap-1">
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddWatchlist(item);
                                            }}
                                                    className="text-xs px-2 py-1 bg-slate-700
                                                               hover:bg-blue-600 text-slate-400
                                                               hover:text-white rounded-lg
                                                               transition-colors">
                                                + Watch
                                            </button>
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                const added = addToBoard(item);
                                                toast[added ? "success" : "error"](
                                                    added
                                                        ? `${item.symbol} added to board`
                                                        : `${item.symbol} already on board`
                                                );
                                            }}
                                                    className="text-xs px-2 py-1 bg-slate-700
                                                               hover:bg-purple-600 text-slate-400
                                                               hover:text-white rounded-lg
                                                               transition-colors"
                                                    title="Add to market board">
                                                + Board
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {(results.stocks.length + results.mf.length) > 0 && (
                        <div className="px-4 py-2 border-t border-slate-700/40 bg-slate-800/60">
                            <p className="text-xs text-slate-600 text-center">
                                {results.stocks.length + results.mf.length} results — click to open chart
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}