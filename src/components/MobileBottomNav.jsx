// src/components/MobileBottomNav.jsx
// Native-feeling bottom tab bar for mobile.
// Shows 5 primary tabs — Market, Holdings, Transactions, Watchlist, More.
// "More" opens a drawer with secondary navigation (MF, Portfolio, Alerts, AI).
// Desktop: renders nothing (useMobile guard in Layout).

import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";

const TABS = [
    {
        id:    "market",
        label: "Market",
        to:    "/stocks",
        exact: true,
        icon:  ({ active }) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={active ? 2.5 : 2} className="w-6 h-6">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        id:    "holdings",
        label: "Holdings",
        to:    "/stocks/holdings",
        icon:  ({ active }) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={active ? 2.5 : 2} className="w-6 h-6">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4" strokeLinecap="round"/>
            </svg>
        ),
    },
    {
        id:    "transactions",
        label: "Trades",
        to:    "/stocks/transactions",
        icon:  ({ active }) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={active ? 2.5 : 2} className="w-6 h-6">
                <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        id:    "watchlist",
        label: "Watchlist",
        to:    "/stocks/watchlist",
        icon:  ({ active }) => (
            <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
                 stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
                <path d="M12 4.318C9.403.5 3 1.545 3 8c0 4.5 9 12 9 12s9-7.5 9-12c0-6.455-6.403-7.5-9-3.682z"
                      strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        id:   "more",
        label: "More",
        icon:  ({ active }) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={active ? 2.5 : 2} className="w-6 h-6">
                <circle cx="5"  cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
        ),
    },
];

// More drawer items
const MORE_ITEMS = [
    { label: "MF Market",         to: "/mf",               icon: "📊" },
    { label: "MF Holdings",       to: "/mf/holdings",      icon: "💼" },
    { label: "MF Transactions",   to: "/mf/transactions",  icon: "🔄" },
    { label: "MF Watchlist",      to: "/mf/watchlist",     icon: "👁" },
    { label: "Alerts",            to: "/stocks/alerts",    icon: "🔔" },
    { label: "Combined Portfolio",to: "/portfolio",         icon: "⊞" },
];

export default function MobileBottomNav() {
    const location  = useLocation();
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const [showMore, setShowMore] = useState(false);

    const path = location.pathname;

    const isActive = (tab) => {
        if (tab.exact) return path === tab.to;
        if (tab.id === "more") return false;
        return path.startsWith(tab.to);
    };

    const handleTab = (tab) => {
        if (tab.id === "more") {
            setShowMore(v => !v);
        } else {
            setShowMore(false);
            navigate(tab.to);
        }
    };

    return (
        <>
            {/* More drawer — slides up from bottom */}
            {showMore && createPortal(
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm"
                         onClick={() => setShowMore(false)} />
                    {/* Drawer */}
                    <div className="fixed bottom-16 left-0 right-0 z-[150]
                                    bg-slate-900 border-t border-slate-700/60
                                    rounded-t-2xl shadow-2xl pb-safe">
                        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-4" />
                        <p className="text-slate-500 text-[11px] font-bold uppercase
                                      tracking-widest px-5 pb-2">More</p>
                        <div className="grid grid-cols-3 gap-2 px-4 pb-6">
                            {MORE_ITEMS.map(item => (
                                <Link key={item.to} to={item.to}
                                      onClick={() => setShowMore(false)}
                                      className={`flex flex-col items-center gap-1.5
                                                  py-3 px-2 rounded-2xl text-center
                                                  transition-colors active:scale-95
                                                  ${path.startsWith(item.to)
                                          ? "bg-purple-900/30 text-purple-300"
                                          : "bg-slate-800 text-slate-300"}`}>
                                    <span className="text-2xl">{item.icon}</span>
                                    <span className="text-[11px] font-medium leading-tight">
                                        {item.label}
                                    </span>
                                </Link>
                            ))}
                        </div>
                        {/* Admin links if applicable */}
                        {(user?.role === "ADMIN" || user?.role === "CREATOR") && (
                            <div className="border-t border-slate-700/40 px-4 py-4">
                                <p className="text-slate-600 text-[10px] font-bold uppercase
                                              tracking-widest mb-3">
                                    {user.role === "CREATOR" ? "👑 Creator" : "Admin"}
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { to: "/admin",           label: "Dashboard" },
                                        { to: "/admin/clients",   label: "Clients"   },
                                        { to: "/admin/analytics", label: "Analytics" },
                                    ].map(l => (
                                        <Link key={l.to} to={l.to}
                                              onClick={() => setShowMore(false)}
                                              className="px-3 py-1.5 bg-slate-800 border
                                                         border-slate-700 rounded-xl text-xs
                                                         text-slate-300 active:bg-slate-700">
                                            {l.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}

            {/* Bottom tab bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-[130]
                            bg-slate-900/95 backdrop-blur-md
                            border-t border-slate-700/60
                            grid grid-cols-5
                            pb-safe">
                {TABS.map(tab => {
                    const active = isActive(tab) || (tab.id === "more" && showMore);
                    return (
                        <button key={tab.id}
                                onClick={() => handleTab(tab)}
                                className={`flex flex-col items-center justify-center
                                            gap-0.5 py-2 px-1 transition-colors
                                            active:bg-slate-800/60 select-none
                                            ${active
                                    ? "text-purple-400"
                                    : "text-slate-500"}`}>
                            <tab.icon active={active} />
                            <span className={`text-[10px] font-medium leading-none
                                              ${active ? "text-purple-400" : "text-slate-500"}`}>
                                {tab.label}
                            </span>
                            {active && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2
                                                w-8 h-0.5 bg-purple-400 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </>
    );
}