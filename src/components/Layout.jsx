import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth }  from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import StockSearchBar    from "./StockSearchBar";
import NavPortfolioValue from "./NavPortfolioValue";

export default function Layout() {
    const { user, logout } = useAuth();
    const { isDark, toggle } = useTheme();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate("/login"); };

    const navClass = ({ isActive }) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }`;

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white">
            {/* Top navbar */}
            <header className="flex items-center justify-between px-6 py-3
                               bg-slate-800 border-b border-slate-700 flex-shrink-0 gap-4">
                {/* Left */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <h1 className="text-lg font-bold text-blue-400">📈 MarketSync</h1>
                    <span className="text-slate-600 hidden md:block">|</span>
                    <span className="text-slate-400 text-sm hidden md:block">{user?.username}</span>
                </div>

                {/* Portfolio value */}
                <NavPortfolioValue />

                {/* Search */}
                <StockSearchBar />

                {/* Right */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={toggle}
                        title="Toggle theme"
                        className="text-slate-400 hover:text-white transition-colors
                                   px-2 py-1.5 rounded-lg hover:bg-slate-700 text-lg"
                    >
                        {isDark ? "☀️" : "🌙"}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="text-sm text-slate-400 hover:text-white transition-colors
                                   px-3 py-1.5 rounded-lg hover:bg-slate-700"
                    >
                        🚪 Logout
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-48 flex-shrink-0 bg-slate-800 border-r border-slate-700">
                    <nav className="p-3 space-y-1">
                        <NavLink to="/dashboard"    className={navClass}>🏠 Dashboard</NavLink>
                        <NavLink to="/holdings"     className={navClass}>💼 Holdings</NavLink>
                        <NavLink to="/transactions" className={navClass}>🔄 Transactions</NavLink>
                        <NavLink to="/watchlist"    className={navClass}>👁 Watchlist</NavLink>
                        <NavLink to="/mutual-funds" className={navClass}>📊 Mutual Funds</NavLink>
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}