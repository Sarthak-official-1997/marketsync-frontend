import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // NavLink automatically adds "active" class when the route matches
    const navClass = ({ isActive }) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }`;

    return (
        <div className="flex h-screen bg-slate-900 text-white">
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 bg-slate-800 flex flex-col border-r border-slate-700">
                {/* Logo */}
                <div className="p-5 border-b border-slate-700">
                    <h1 className="text-lg font-bold text-blue-400">
                        📈 MarketSync
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {user?.username}
                    </p>
                </div>

                {/* Nav links */}
                <nav className="flex-1 p-3 space-y-1">
                    <NavLink to="/dashboard"    className={navClass}>🏠 Dashboard</NavLink>
                    <NavLink to="/holdings"     className={navClass}>💼 Holdings</NavLink>
                    <NavLink to="/transactions" className={navClass}>🔄 Transactions</NavLink>
                    <NavLink to="/watchlist"    className={navClass}>👁 Watchlist</NavLink>
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-slate-700">
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-sm text-slate-300
                                   hover:bg-slate-700 hover:text-white rounded-lg
                                   transition-colors text-left"
                    >
                        🚪 Logout
                    </button>
                </div>
            </aside>

            {/* Main content area */}
            <main className="flex-1 overflow-auto p-6">
                <Outlet />  {/* This is where page content renders */}
            </main>
        </div>
    );
}