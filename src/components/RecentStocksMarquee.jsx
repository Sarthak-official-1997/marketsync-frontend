import { useState, useEffect, useRef } from "react";
import { getStockPrice } from "../api/portfolio";

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

// ── MF recently viewed ────────────────────────────────────────────────────────
const MF_RECENT_KEY = "ms_recently_viewed_mf";
const MAX_MF_RECENT = 20;

export function trackMfView(scheme) {
    try {
        const existing = JSON.parse(localStorage.getItem(MF_RECENT_KEY) || "[]");
        const filtered = existing.filter(s => s.schemeCode !== scheme.schemeCode);
        const updated  = [
            {
                schemeCode: scheme.schemeCode,
                schemeName: scheme.schemeName,
                fundHouse:  scheme.fundHouse  || "",
                nav:        scheme.nav        || null,
            },
            ...filtered,
        ].slice(0, MAX_MF_RECENT);
        localStorage.setItem(MF_RECENT_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event("ms_mf_recent_updated"));
    } catch {}
}

export function getRecentMf() {
    try { return JSON.parse(localStorage.getItem(MF_RECENT_KEY) || "[]"); }
    catch { return []; }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RecentStocksMarquee({ onStockClick }) {
    const [stocks,  setStocks]  = useState(getRecentStocks());
    const [paused,  setPaused]  = useState(false);
    const [hovered, setHovered] = useState(null);
    const fetchedRef = useRef(new Set()); // track which symbols we've fetched

    // ── Refresh when another part of the app tracks a view ───────────────────
    useEffect(() => {
        const handler = () => setStocks(getRecentStocks());
        window.addEventListener("ms_recent_updated", handler);
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener("ms_recent_updated", handler);
            window.removeEventListener("storage", handler);
        };
    }, []);

    // ── On mount + whenever stocks change: fill in missing changePercent ──────
    useEffect(() => {
        const missing = stocks.filter(
            s => s.changePercent == null && !fetchedRef.current.has(s.symbol)
        );
        if (missing.length === 0) return;

        // Mark as being fetched so we don't re-fetch on next render
        missing.forEach(s => fetchedRef.current.add(s.symbol));

        // Fetch all missing prices in parallel — max 15, fine to do this
        Promise.allSettled(
            missing.map(s =>
                getStockPrice(s.symbol)
                    .then(res => {
                        const p = res?.data || res;
                        if (p?.changePercent != null || p?.currentPrice != null) {
                            trackStockView({
                                ...s,
                                changePercent: p.changePercent
                                    ?? p.regularMarketChangePercent
                                    ?? null,
                                change: p.change
                                    ?? p.regularMarketChange
                                    ?? null,
                            });
                        }
                    })
                    .catch(() => {
                        // silently ignore — just won't show % for this stock
                    })
            )
        );
    }, [stocks]);

    if (stocks.length === 0) return null;

    // Triplicate for seamless loop
    const items = [...stocks, ...stocks, ...stocks];

    return (
        <div
            className="w-full overflow-hidden relative"
            style={{ height: "36px" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => { setPaused(false); setHovered(null); }}
        >
            {/* Fade edges */}
            <div className="absolute left-0 top-0 h-full w-16 z-10 pointer-events-none
                            bg-gradient-to-r from-slate-950 to-transparent" />
            <div className="absolute right-0 top-0 h-full w-16 z-10 pointer-events-none
                            bg-gradient-to-l from-slate-950 to-transparent" />

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
                                transform:  isHover
                                    ? "scale(1.35) translateY(-1px)"
                                    : "scale(1) translateY(0)",
                                transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                                opacity:    hovered && !isHover ? 0.4 : 1,
                                zIndex:     isHover ? 20 : 1,
                            }}
                        >
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

                            {stock.changePercent != null ? (
                                <span className={`text-xs font-semibold leading-none ${color}`}>
                                    {isPos ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                                </span>
                            ) : (
                                /* Loading shimmer for stocks awaiting price fetch */
                                <span className="text-[10px] text-slate-600 leading-none">
                                    …
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