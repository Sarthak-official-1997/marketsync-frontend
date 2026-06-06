// src/components/MobileHeader.jsx
// Compact mobile header — logo + search tap + AI + profile only.
// No sidebar toggle, no portfolio value, no theme switcher.
// All those live in the bottom nav "More" drawer.

import { useState } from "react";
import { Link }     from "react-router-dom";
import { useAuth }  from "../context/AuthContext";
import AppLogo      from "./AppLogo";

export default function MobileHeader({
                                         onSearchOpen,
                                         onAiOpen,
                                         pendingNotifs = 0,
                                     }) {
    const { user } = useAuth();
    const initial  = (user?.fullName || user?.username || "?")[0].toUpperCase();

    return (
        <header className="flex items-center gap-2 px-3 py-2
                            bg-slate-900/95 backdrop-blur-md
                            border-b border-slate-700/60
                            sticky top-0 z-50 h-14">

            {/* Logo */}
            <Link to="/stocks" className="flex items-center gap-1.5 flex-shrink-0">
                <AppLogo className="w-7 h-7" />
                <span className="text-white font-bold text-sm tracking-tight">
                    FOLYO
                </span>
            </Link>

            {/* Search bar — full width tap target */}
            <button onClick={onSearchOpen}
                    className="flex-1 flex items-center gap-2 px-3 py-2
                               bg-slate-800 border border-slate-700/60
                               rounded-xl text-left min-w-0">
                <svg className="w-4 h-4 text-slate-500 flex-shrink-0"
                     fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/>
                    <path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                </svg>
                <span className="text-slate-500 text-sm truncate">Search stocks...</span>
            </button>

            {/* Ask AI */}
            <button onClick={onAiOpen}
                    className="flex items-center justify-center w-9 h-9
                               bg-purple-600/20 border border-purple-500/30
                               rounded-xl flex-shrink-0 active:bg-purple-600/40">
                <span className="text-base leading-none">✨</span>
            </button>

            {/* Notifications */}
            <Link to="/stocks/alerts"
                  className="relative flex items-center justify-center
                             w-9 h-9 flex-shrink-0">
                <svg className="w-5 h-5 text-slate-400"
                     fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round"
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                {pendingNotifs > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4
                                     bg-red-500 rounded-full text-[9px] font-bold
                                     text-white flex items-center justify-center">
                        {pendingNotifs > 9 ? "9+" : pendingNotifs}
                    </span>
                )}
            </Link>

            {/* Profile avatar */}
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center
                            justify-center text-white font-bold text-sm flex-shrink-0">
                {initial}
            </div>
        </header>
    );
}