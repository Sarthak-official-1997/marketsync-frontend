// src/components/StockInfoCard.jsx
// The reusable CORE of stock info display — name, live price/change, a
// real stats row (prev close / day high / day low / volume), and a chart
// with actual axis context (time range + high/low labels, not just an
// unlabeled squiggle). No Cancel/Confirm chrome — just the info itself.
//
// Used two ways across the app:
//   1. Wrapped by StockConfirmPreview.jsx, which adds Cancel/Confirm buttons
//      for flows that need a commit gate (alerts, trade setups, manual
//      transaction/holding entry — anywhere a wrong stock has real
//      consequences).
//   2. Used directly (read-only, just a close button) anywhere the app
//      wants to show quick info about an already-chosen/linked stock —
//      e.g. tapping a linked stock chip in a Note.

import { useState, useEffect } from "react";
import { getStockPrice, getStockChart } from "../api/portfolio";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export default function StockInfoCard({ stock }) {
    const [quote, setQuote] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [chartRange, setChartRange] = useState("Today");
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
                if (pts.length > 3) {
                    if (!cancelled) { setChartData(pts); setChartRange("Today"); }
                    return;
                }
                return getStockChart(stock.symbol, stock.exchange || "NSE", "1d", "5d")
                    .then(r2 => {
                        if (!cancelled) { setChartData(parse(r2)); setChartRange("Last 5 days"); }
                    });
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, [stock.symbol, stock.exchange]);

    const price = quote?.currentPrice != null ? parseFloat(quote.currentPrice) : 0;
    const chg   = quote?.changePercent != null ? parseFloat(quote.changePercent) : 0;
    const up    = chg >= 0;
    const color = up ? "#22c55e" : "#ef4444";

    const fmt = (v) => v == null ? null : parseFloat(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    const fmtVol = (v) => {
        if (v == null) return null;
        const n = Number(v);
        if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
        if (n >= 1e5) return (n / 1e5).toFixed(2) + " L";
        return n.toLocaleString("en-IN");
    };

    const chartValues = chartData.map(p => p.v);
    const chartHigh = chartValues.length ? Math.max(...chartValues) : null;
    const chartLow  = chartValues.length ? Math.min(...chartValues) : null;

    const stats = [
        { label: "Prev close", value: fmt(quote?.previousClose) },
        { label: "Day high",   value: fmt(quote?.dayHigh) },
        { label: "Day low",    value: fmt(quote?.dayLow) },
        { label: "Volume",     value: fmtVol(quote?.volume), noRupee: true },
    ].filter(s => s.value != null);

    return (
        <div>
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

            {!loading && stats.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                    {stats.map(s => (
                        <div key={s.label} className="bg-slate-800/60 rounded-lg px-1.5 py-2 text-center">
                            <p className="text-slate-500 text-[9px] mb-0.5">{s.label}</p>
                            <p className="text-white text-[11px] font-semibold">
                                {s.noRupee ? s.value : `₹${s.value}`}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 relative bg-slate-800/40 rounded-2xl border border-slate-700/40 overflow-hidden"
                 style={{ height: "180px" }}>
                {chartData.length > 1 ? (
                    <>
                        <div className="absolute top-2 left-3 z-10 text-[10px] text-slate-500 font-medium">
                            {chartRange}
                        </div>
                        <div className="absolute top-2 right-3 z-10 text-[10px] text-slate-400">
                            High ₹{fmt(chartHigh)}
                        </div>
                        <div className="absolute bottom-2 right-3 z-10 text-[10px] text-slate-400">
                            Low ₹{fmt(chartLow)}
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 24, right: 8, bottom: 4, left: 8 }}>
                                <defs>
                                    <linearGradient id="stockInfoChartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
                                      fill="url(#stockInfoChartGrad)" dot={false}
                                      isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </>
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
    );
}