// src/components/RecentStocksMarquee.jsx
// Shows last 15 viewed stocks as a scrolling marquee at the top of Market page.
// Hover stops movement. Click opens the stock detail modal.

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "ms_recently_visited"; // matches StocksMarketPage.addToRecentlyVisited
const MAX_RECENT  = 15;

// ── Public helpers ────────────────────────────────────────────────────────────
// Call trackStockView(stock) whenever a user opens a stock detail modal.
// stock = { symbol, name, exchange, changePercent, change }

export function trackStockView(stock) {
    try {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        // Remove duplicate if already present, then prepend
        const filtered = existing.filter(s => s.symbol !== stock.symbol);
        const updated  = [
            {
                symbol:        stock.symbol,
                name:          stock.name          || stock.companyName || stock.symbol,
                exchange:      stock.exchange       || "NSE",
                changePercent: stock.changePercent  ?? null,
                change:        stock.change         ?? null,
            },
            ...filtered,
        ].slice(0, MAX_RECENT);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        // Trigger storage event for same-tab listeners
        window.dispatchEvent(new Event("ms_recent_updated"));
    } catch {}
}

export function getRecentStocks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecentStocksMarquee({ onStockClick }) {
    const [stocks, setStocks]   = useState(getRecentStocks());
    const [paused, setPaused]   = useState(false);
    const [hovered, setHovered] = useState(null); // symbol of hovered stock

    // Refresh when another part of the app tracks a view
    useEffect(() => {
        const handler = () => setStocks(getRecentStocks());
        window.addEventListener("ms_recent_updated", handler);
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener("ms_recent_updated", handler);
            window.removeEventListener("storage", handler);
        };
    }, []);

    if (stocks.length === 0) return null;

    // Duplicate list so the scroll loops seamlessly
    const items = [...stocks, ...stocks];

    return (
        <div className="w-full bg-slate-900/60 border-b border-slate-800
                        overflow-hidden relative"
             style={{ height: "34px" }}>

            {/* Fade edges */}
            <div className="absolute left-0 top-0 h-full w-12 z-10
                            bg-gradient-to-r from-slate-900/60 to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 h-full w-12 z-10
                            bg-gradient-to-l from-slate-900/60 to-transparent pointer-events-none" />

            <div
                className="flex items-center h-full gap-6 px-4"
                style={{
                    animation: paused ? "none" : "marqueeScroll 40s linear infinite",
                    width:     "max-content",
                }}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => { setPaused(false); setHovered(null); }}
            >
                {items.map((stock, i) => {
                    const pct   = parseFloat(stock.changePercent ?? 0);
                    const isPos = pct >= 0;
                    const color = stock.changePercent == null
                        ? "text-slate-400"
                        : isPos ? "text-green-400" : "text-red-400";

                    return (
                        <button
                            key={`${stock.symbol}-${i}`}
                            onClick={() => onStockClick(stock)}
                            onMouseEnter={() => setHovered(`${stock.symbol}-${i}`)}
                            onMouseLeave={() => setHovered(null)}
                            className={`flex items-center gap-2 flex-shrink-0 transition-all
                                       ${hovered === `${stock.symbol}-${i}`
                                ? "opacity-100 scale-105"
                                : "opacity-80 hover:opacity-100"}`}
                        >
                            <span className="text-xs font-bold text-white">{stock.symbol}</span>
                            {stock.changePercent != null && (
                                <span className={`text-xs font-semibold ${color}`}>
                                    {isPos ? "▲ +" : "▼ "}{Math.abs(pct).toFixed(2)}%
                                </span>
                            )}
                            <span className="text-slate-700 text-xs">·</span>
                        </button>
                    );
                })}
            </div>

            <style>{`
                @keyframes marqueeScroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}