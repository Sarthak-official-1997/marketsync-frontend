// src/pages/HomePage.jsx
// A genuine, dedicated landing page — separate from the Stocks Market page,
// which was doing double duty as both "browse stocks" and "home" (mobile
// didn't even show a greeting there at all, going straight into stock
// browsing). This is the seed for the fully customizable dashboard
// eventually — for now, a real greeting, both portfolio summaries, and
// quick-access tiles to everywhere else in the app.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePrivacy } from "../context/PrivacyContext";
import { getPortfolioSummary, getMfPortfolioSummary } from "../api/portfolio";
import { getDefaultView, DEFAULT_VIEW } from "../utils/homePreference";

function getMarketStatus() {
    const now  = new Date();
    const ist  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day  = ist.getDay();
    const mins = ist.getHours() * 60 + ist.getMinutes();
    const open    = day >= 1 && day <= 5 && mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
    const preOpen = day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 9 * 60 + 15;
    if (preOpen) return { label: "Pre-Open",     color: "text-amber-400", dot: "bg-amber-400" };
    if (open)    return { label: "Market Open",  color: "text-green-400", dot: "bg-green-400 animate-pulse" };
    return         { label: "Market Closed", color: "text-red-400",   dot: "bg-red-400" };
}

function getGreeting() {
    const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

const fmt = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(2) + "Cr";
    if (n >= 100_000)    return "₹" + (n / 100_000).toFixed(2) + "L";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

function QuickTile({ icon, label, sub, onClick }) {
    return (
        <button onClick={onClick}
                className="flex flex-col items-start gap-1 p-4 bg-slate-800/60 hover:bg-slate-800
                           border border-slate-700/60 rounded-2xl transition-colors text-left">
            <span className="text-2xl">{icon}</span>
            <span className="text-white font-semibold text-sm mt-1">{label}</span>
            {sub && <span className="text-slate-500 text-xs">{sub}</span>}
        </button>
    );
}

export default function HomePage() {
    const navigate = useNavigate();
    const { user, isCreator } = useAuth();
    const { hidden: valuesHidden } = usePrivacy();

    const [status, setStatus] = useState(getMarketStatus());
    const [now,    setNow]    = useState(new Date());
    const [stockSummary, setStockSummary] = useState(null);
    const [mfSummary,    setMfSummary]    = useState(null);
    const [loading,      setLoading]      = useState(true);

    useEffect(() => {
        const t = setInterval(() => { setStatus(getMarketStatus()); setNow(new Date()); }, 60_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        Promise.allSettled([getPortfolioSummary(), getMfPortfolioSummary()])
            .then(([s, m]) => {
                if (s.status === "fulfilled") setStockSummary(s.value.data);
                if (m.status === "fulfilled") setMfSummary(m.value.data);
            })
            .finally(() => setLoading(false));
    }, []);

    const firstName = user?.fullName?.split(" ")[0] || user?.username || "there";
    const dateStr = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const stockValue = parseFloat(stockSummary?.currentValue || 0);
    const stockDayPL = parseFloat(stockSummary?.dayPL || 0);
    const mfValue     = parseFloat(mfSummary?.currentValue || 0);
    const mfDayChange = mfSummary?.dayChangeAmount != null ? parseFloat(mfSummary.dayChangeAmount) : null;
    const combinedValue = stockValue + mfValue;

    // Which fund type gets top billing on this page mirrors the Settings
    // preference — a Mutual-Funds-first user shouldn't see Stocks tiles
    // leading the page just because Home itself is fund-type-agnostic.
    const mfFirst = getDefaultView() === DEFAULT_VIEW.MUTUAL_FUNDS;

    const stocksTiles = [
        { icon: "📈", label: "Market",     sub: "Browse & your board", onClick: () => navigate("/stocks") },
        { icon: "💼", label: "Holdings",   sub: "What you own",        onClick: () => navigate("/stocks/holdings") },
        { icon: "🔄", label: "Trades",     sub: "Transaction history", onClick: () => navigate("/stocks/transactions") },
        { icon: "👁", label: "Watchlist",  sub: "Stocks you're tracking", onClick: () => navigate("/stocks/watchlist") },
    ];
    const mfTiles = [
        { icon: "📊", label: "MF Market",    sub: "Browse schemes",      onClick: () => navigate("/mf") },
        { icon: "💼", label: "MF Holdings",  sub: "What you own",        onClick: () => navigate("/mf/holdings") },
        { icon: "🔄", label: "MF Trades",    sub: "Transaction history", onClick: () => navigate("/mf/transactions") },
        { icon: "👁", label: "MF Watchlist", sub: "Funds you're tracking", onClick: () => navigate("/mf/watchlist") },
    ];
    const tiles = [
        ...(mfFirst ? mfTiles : stocksTiles),
        ...(mfFirst ? stocksTiles : mfTiles),
        { icon: "🔔", label: "Alerts",   sub: "Your price alerts", onClick: () => navigate("/stocks/alerts") },
        { icon: "⊞",  label: "Combined", sub: "Everything together", onClick: () => navigate("/portfolio") },
        ...(isCreator ? [{ icon: "📋", label: "Client Tracker", sub: "Your clients' portfolios", onClick: () => navigate("/creator/client-tracker") }] : []),
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Greeting + market status */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-white font-bold text-lg leading-tight">
                            {getGreeting()}, {firstName} 👋
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">{dateStr}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-700/40">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                    <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
                    <span className="text-slate-600 text-xs">· NSE / BSE · 9:15 AM – 3:30 PM IST</span>
                </div>
            </div>

            {/* Combined portfolio snapshot */}
            {!loading && (stockSummary || mfSummary) && (
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="flex divide-x divide-slate-700/60">
                        <div className="flex-1 px-4 py-3">
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Total Value</p>
                            <p className="text-xl font-bold text-white mt-0.5">
                                {valuesHidden ? "••••••" : fmt(combinedValue)}
                            </p>
                        </div>
                        {stockSummary && (
                            <div className="flex-1 px-4 py-3">
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Stocks Today</p>
                                <p className={"text-xl font-bold mt-0.5 " + (stockDayPL >= 0 ? "text-green-400" : "text-red-400")}>
                                    {valuesHidden ? "••••" : (stockDayPL >= 0 ? "+" : "") + fmt(stockDayPL)}
                                </p>
                            </div>
                        )}
                        {mfDayChange != null && (
                            <div className="flex-1 px-4 py-3">
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">MF Today</p>
                                <p className={"text-xl font-bold mt-0.5 " + (mfDayChange >= 0 ? "text-green-400" : "text-red-400")}>
                                    {valuesHidden ? "••••" : (mfDayChange >= 0 ? "+" : "") + fmt(mfDayChange)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick access */}
            <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Quick access</p>
                <div className="grid grid-cols-2 gap-2.5">
                    {tiles.map(t => <QuickTile key={t.label} {...t} />)}
                </div>
            </div>
        </div>
    );
}