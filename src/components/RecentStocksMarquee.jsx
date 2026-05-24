import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "ms_recently_visited";
const MAX_RECENT  = 15;

export function trackStockView(stock) {
    try {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
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
        window.dispatchEvent(new Event("ms_recent_updated"));
    } catch {}
}

export function getRecentStocks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
}

export default function RecentStocksMarquee({ onStockClick }) {
    const [stocks,  setStocks]  = useState(getRecentStocks());
    const [paused,  setPaused]  = useState(false);
    const [hovered, setHovered] = useState(null); // symbol

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

    // Triplicate so loop is seamless at any pause point
    const items = [...stocks, ...stocks, ...stocks];

    return (
        <div
            className="w-full bg-slate-900/60 border-b border-slate-800
                       overflow-hidden relative"
            style={{ height: "36px" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => { setPaused(false); setHovered(null); }}
        >
            {/* Fade edges */}
            <div className="absolute left-0 top-0 h-full w-16 z-10 pointer-events-none
                            bg-gradient-to-r from-slate-950 to-transparent" />
            <div className="absolute right-0 top-0 h-full w-16 z-10 pointer-events-none
                            bg-gradient-to-l from-slate-950 to-transparent" />

            {/* ── KEY FIX: animationPlayState instead of toggling animation on/off ── */}
            <div
                className="flex items-center h-full gap-6 px-4"
                style={{
                    width:              "max-content",
                    animation:          "marqueeScroll 45s linear infinite",
                    animationPlayState: paused ? "paused" : "running",
                }}
            >
                {items.map((stock, i) => {
                    const pct     = parseFloat(stock.changePercent ?? 0);
                    const isPos   = pct >= 0;
                    const isHover = hovered === `${stock.symbol}-${i}`;
                    const color   = stock.changePercent == null
                        ? "text-slate-400"
                        : isPos ? "text-green-400" : "text-red-400";

                    return (
                        <button
                            key={`${stock.symbol}-${i}`}
                            onClick={() => onStockClick(stock)}
                            onMouseEnter={() => setHovered(`${stock.symbol}-${i}`)}
                            onMouseLeave={() => setHovered(null)}
                            className="flex items-center gap-2 flex-shrink-0 relative"
                            style={{
                                // ── Magnifying glass zoom effect ──
                                transform:  isHover
                                    ? "scale(1.35) translateY(-1px)"
                                    : "scale(1) translateY(0)",
                                transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                                // Dim non-hovered items when something is hovered
                                opacity:    hovered && !isHover ? 0.4 : 1,
                                zIndex:     isHover ? 20 : 1,
                            }}
                        >
                            {/* Glow backdrop on hover */}
                            {isHover && (
                                <div className="absolute inset-0 -mx-2 rounded-lg
                                                bg-slate-700/60 border border-slate-500/40
                                                shadow-[0_0_12px_rgba(148,163,184,0.15)]"
                                     style={{ zIndex: -1 }} />
                            )}

                            <span className={`text-xs font-bold leading-none ${
                                isHover ? "text-white" : "text-slate-200"
                            }`}>
                                {stock.symbol}
                            </span>

                            {stock.changePercent != null && (
                                <span className={`text-xs font-semibold leading-none ${color}`}>
                                    {isPos ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
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
                    100% { transform: translateX(-33.333%); }
                }
            `}</style>
        </div>
    );
}