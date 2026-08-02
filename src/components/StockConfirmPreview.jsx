// src/components/StockConfirmPreview.jsx
// A lightweight "is this the right stock?" checkpoint — shown after picking a
// result from SearchPickerModal, before committing to an alert/trade-setup
// flow. Prevents fat-finger mismatches (similar-looking names, wrong
// exchange, etc.) by showing name + live price + a small chart, with
// nothing else — no board/watchlist/TradingView/alert buttons, since none
// of those apply when you've arrived here by directly searching for a
// stock to act on. Cancel returns to search; Confirm proceeds.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { getStockPrice, getStockChart } from "../api/portfolio";
import {
    AreaChart, Area, XAxis, ResponsiveContainer,
} from "recharts";

export default function StockConfirmPreview({ stock, onConfirm, onCancel }) {
    const isMobile = useMobile();
    const [quote, setQuote] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        getStockPrice(stock.symbol)
            .then(res => { if (!cancelled) setQuote(res.data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });

        const parse = (r) => (r?.data?.dataPoints || [])
            .filter(p => p.close != null)
            .map(p => ({ v: parseFloat(p.close) }))
            .filter(p => p.v > 0);

        getStockChart(stock.symbol, stock.exchange || "NSE", "5m", "1d")
            .then(r => {
                const pts = parse(r);
                if (pts.length > 3) { if (!cancelled) setChartData(pts); return; }
                return getStockChart(stock.symbol, stock.exchange || "NSE", "1d", "5d")
                    .then(r2 => { if (!cancelled) setChartData(parse(r2)); });
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, [stock.symbol, stock.exchange]);

    const price = parseFloat(quote?.currentPrice || quote?.regularMarketPrice || 0);
    const chg   = parseFloat(quote?.changePercent || quote?.regularMarketChangePercent || 0);
    const up    = chg >= 0;
    const color = up ? "#22c55e" : "#ef4444";

    return createPortal(
        <div className="fixed inset-0 z-[9660] flex items-end sm:items-center justify-center"
             onClick={onCancel}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9661] bg-slate-900 flex flex-col"
                 style={isMobile ? {
                     width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
                     borderRadius: 0, border: "none",
                     paddingTop: "env(safe-area-inset-top, 0px)",
                     paddingBottom: "env(safe-area-inset-bottom, 0px)",
                     overflowX: "hidden",
                 } : {
                     width: "calc(100vw - 32px)", maxWidth: "420px",
                     height: "480px",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <p className="text-slate-400 text-xs">Confirm this is the right stock</p>
                    <button onClick={onCancel}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <p className="text-white font-bold text-xl">{stock.symbol}</p>
                            <p className="text-slate-500 text-xs truncate max-w-[220px]">{stock.name}</p>
                        </div>
                        {stock.exchange && (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex-shrink-0">
                                {stock.exchange}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="h-8 w-32 bg-slate-800 rounded animate-pulse mt-2" />
                    ) : price > 0 ? (
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-white font-bold text-2xl">
                                ₹{price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                            <span className={"text-sm font-semibold " + (up ? "text-green-400" : "text-red-400")}>
                                {up ? "▲ +" : "▼ "}{Math.abs(chg).toFixed(2)}%
                            </span>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm mt-2">Price unavailable right now</p>
                    )}

                    <div className="mt-4 bg-slate-800/40 rounded-2xl border border-slate-700/40 overflow-hidden"
                         style={{ height: "180px" }}>
                        {chartData.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
                                    <defs>
                                        <linearGradient id="confirmChartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
                                          fill="url(#confirmChartGrad)" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                {loading ? (
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <p className="text-slate-600 text-xs">No chart data available</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/60 flex gap-2">
                    <button onClick={onCancel}
                            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white
                                       text-sm font-semibold rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                       text-sm font-semibold rounded-xl transition-colors">
                        Confirm
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}