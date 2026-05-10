import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth }  from "../context/AuthContext";
import IndexTicker  from "./IndexTicker";

// ── Nav sections ─────────────────────────────────────────────────────
const STOCKS_LINKS = [
    { to: "/stocks",              icon: "📊", label: "Market"       },
    { to: "/stocks/holdings",     icon: "💼", label: "Holdings"     },
    { to: "/stocks/transactions", icon: "🔄", label: "Transactions" },
    { to: "/stocks/watchlist",    icon: "👁", label: "Watchlist"    },
];

const MF_LINKS = [
    { to: "/mf",              icon: "📊", label: "Market"       },
    { to: "/mf/holdings",    icon: "💼", label: "Holdings"     },
    { to: "/mf/transactions",icon: "🔄", label: "Transactions" },
    { to: "/mf/watchlist",   icon: "👁", label: "Watchlist"    },
];

// ── NavLink helper ────────────────────────────────────────────────────
function NavLink({ to, icon, label, exact = false }) {
    const location = useLocation();
    const active   = exact
        ? location.pathname === to
        : location.pathname.startsWith(to);
    return (
        <Link
            to={to}
            className={
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm " +
                "font-medium transition-all " +
                (active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/60")
            }
        >
            <span className="text-base">{icon}</span>
            {label}
        </Link>
    );
}

// ── Section header ────────────────────────────────────────────────────
function SectionHeader({ icon, label, expanded, onToggle }) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2
                       text-xs font-bold text-slate-500 uppercase tracking-widest
                       hover:text-slate-400 transition-colors"
        >
            <span className="flex items-center gap-2">
                <span>{icon}</span>
                {label}
            </span>
            <span className={
                "text-slate-600 transition-transform text-xs " +
                (expanded ? "rotate-180" : "")
            }>▼</span>
        </button>
    );
}

// ── Main Layout ───────────────────────────────────────────────────────
export default function Layout({ children, portfolioSummary }) {
    const { isDark, toggle: toggleTheme } = useTheme();
    const { user, logout }               = useAuth();
    const navigate = useNavigate();

    const [stocksOpen, setStocksOpen] = useState(true);
    const [mfOpen,     setMfOpen]     = useState(true);

    const handleLogout = () => { logout(); navigate("/login"); };

    const totalValue = portfolioSummary?.totalValue;
    const totalPL    = portfolioSummary?.totalPL;
    const isPLPos    = parseFloat(totalPL || 0) >= 0;

    const fmtCrore = (v) => {
        if (!v) return "—";
        const n = parseFloat(v);
        if (n >= 10_000_000) {
            return "₹" + (n / 10_000_000).toFixed(2) + "Cr";
        }
        if (n >= 100_000) {
            return "₹" + (n / 100_000).toFixed(2) + "L";
        }
        return new Intl.NumberFormat("en-IN", {
            style: "currency", currency: "INR", maximumFractionDigits: 0,
        }).format(n);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">

            {/* ── TOP NAVBAR ── */}
            <header className="flex-shrink-0 h-14 bg-slate-900 border-b
                               border-slate-700/60 flex items-center px-4 gap-4 z-30">

                {/* Brand */}
                <Link to="/stocks"
                      className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex
                                    items-center justify-center text-white
                                    font-bold text-sm">M</div>
                    <span className="font-bold text-white text-sm hidden sm:block">
                        MarketSync
                    </span>
                </Link>
                <div className="h-5 w-px bg-slate-700 flex-shrink-0" />

                {/* Index ticker — takes most space */}
                <div className="flex-1 overflow-x-auto scrollbar-hide">
                    <IndexTicker />
                </div>

                {/* Right section */}
                <div className="flex items-center gap-3 flex-shrink-0">

                    {/* Portfolio summary pill */}
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
                                <span className={
                                    "text-xs font-semibold " +
                                    (isPLPos ? "text-green-400" : "text-red-400")
                                }>
                                    P&L{" "}
                                    {isPLPos ? "+" : ""}
                                    {fmtCrore(totalPL)}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        title={isDark ? "Light mode" : "Dark mode"}
                        className="w-9 h-9 flex items-center justify-center
                                   bg-slate-800 hover:bg-slate-700 border
                                   border-slate-700 rounded-xl text-lg
                                   transition-colors"
                    >
                        {isDark ? "🌙" : "☀️"}
                    </button>

                    {/* User + logout */}
                    <div className="flex items-center gap-2 bg-slate-800
                                    border border-slate-700 rounded-xl px-3 py-1.5">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex
                                        items-center justify-center text-white
                                        text-xs font-bold flex-shrink-0">
                            {user?.username?.[0]?.toUpperCase() || "U"}
                        </div>
                        <span className="text-sm text-white hidden sm:block">
                            {user?.username}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-red-400
                                       transition-colors text-xs ml-1
                                       hover:underline"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* ── CONTENT AREA ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── SIDEBAR ── */}
                <aside className="w-52 flex-shrink-0 bg-slate-900 border-r
                                  border-slate-700/60 flex flex-col
                                  overflow-y-auto">
                    <nav className="flex-1 p-3 space-y-1">

                        {/* STOCKS SECTION */}
                        <SectionHeader
                            icon="📈"
                            label="Stocks"
                            expanded={stocksOpen}
                            onToggle={() => setStocksOpen(v => !v)}
                        />
                        {stocksOpen && (
                            <div className="space-y-0.5 pl-1">
                                {STOCKS_LINKS.map(l => (
                                    <NavLink key={l.to} {...l} />
                                ))}
                            </div>
                        )}

                        <div className="h-px bg-slate-700/40 my-2" />

                        {/* MF SECTION */}
                        <SectionHeader
                            icon="📊"
                            label="Mutual Funds"
                            expanded={mfOpen}
                            onToggle={() => setMfOpen(v => !v)}
                        />
                        {mfOpen && (
                            <div className="space-y-0.5 pl-1">
                                {MF_LINKS.map(l => (
                                    <NavLink key={l.to} {...l} />
                                ))}
                            </div>
                        )}

                        <div className="h-px bg-slate-700/40 my-2" />

                        {/* COMBINED */}
                        <NavLink
                            to="/portfolio"
                            icon="⊞"
                            label="Combined Portfolio"
                            exact
                        />

                    </nav>

                    {/* Sidebar footer */}
                    <div className="p-3 border-t border-slate-700/40">
                        <p className="text-xs text-slate-600 text-center">
                            NSE · BSE · AMFI
                        </p>
                    </div>
                </aside>

                {/* ── MAIN CONTENT ── */}
                <main className="flex-1 overflow-y-auto bg-slate-950">
                    <div className="p-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}