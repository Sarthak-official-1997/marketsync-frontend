// src/components/PortfolioValueChart.jsx
// Google Finance-style value chart with range tabs (1D/5D/1M/6M/1Y/MAX) —
// reused for tracked-client detail pages now, and intended to be reusable
// for "my own portfolio" wherever that eventually gets its own detail view.
//
// Ranges are limited to what the backend's getPortfolioHistory actually
// supports (1d/5d/1m/6m/1y/all) — YTD and 5Y aren't distinct backend
// ranges, so rather than show tabs that silently fall back to something
// else, only the genuinely-supported ranges are offered.

import { useState, useEffect } from "react";
import { usePrivacy } from "../context/PrivacyContext";

const RANGES = [
    { id: "1d", label: "1D" },
    { id: "5d", label: "5D" },
    { id: "1m", label: "1M" },
    { id: "6m", label: "6M" },
    { id: "1y", label: "1Y" },
    { id: "all", label: "MAX" },
];

const fmt = (v) => {
    const n = parseFloat(v || 0);
    if (Math.abs(n) >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(2) + "Cr";
    if (Math.abs(n) >= 100_000)    return "₹" + (n / 100_000).toFixed(2) + "L";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

function Sparkline({ dates, values }) {
    const w = 380, h = 190, pad = 8;
    if (!values || values.length < 2) {
        return (
            <div className="flex items-center justify-center text-slate-600 text-sm" style={{ height: h }}>
                Not enough history yet for this range
            </div>
        );
    }
    const nums = values.map(v => parseFloat(v));
    const min = Math.min(...nums), max = Math.max(...nums);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / (nums.length - 1);
    const coords = nums.map((v, i) => [
        pad + i * stepX,
        pad + (1 - (v - min) / range) * (h - pad * 2),
    ]);
    const line = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
    const area = line + ` L${coords[coords.length - 1][0]},${h} L${coords[0][0]},${h} Z`;
    const last = coords[coords.length - 1];

    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
            <defs>
                <linearGradient id="pvc-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
            </defs>
            <line x1="0" y1={pad} x2={w} y2={pad} stroke="rgba(71,85,105,0.5)" strokeDasharray="3,4" />
            <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(71,85,105,0.5)" strokeDasharray="3,4" />
            <line x1="0" y1={h - pad} x2={w} y2={h - pad} stroke="rgba(71,85,105,0.5)" strokeDasharray="3,4" />
            <path d={area} fill="url(#pvc-grad)" />
            <path d={line} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last[0]} cy={last[1]} r="5" fill="#7c3aed" />
        </svg>
    );
}

/**
 * fetchHistory: (range) => Promise<{dates, values, totalInvested, pointCount}>
 * Caller supplies the fetch function so this stays agnostic to WHICH
 * backend endpoint is used — the admin per-client one, or eventually a
 * "my own portfolio" one.
 */
export default function PortfolioValueChart({ fetchHistory, currentValue }) {
    const { hidden: valuesHidden } = usePrivacy();
    const [range, setRange] = useState("1m");
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchHistory(range)
            .then(setHistory)
            .catch(() => setHistory(null))
            .finally(() => setLoading(false));
    }, [range]);

    const values = history?.values || [];
    const firstVal = values.length > 0 ? parseFloat(values[0]) : null;
    const lastVal = values.length > 0 ? parseFloat(values[values.length - 1]) : parseFloat(currentValue || 0);
    const changeAmt = firstVal != null ? lastVal - firstVal : 0;
    const changePct = firstVal ? (changeAmt / firstVal) * 100 : 0;
    const isPos = changeAmt >= 0;
    const rangeLabel = RANGES.find(r => r.id === range)?.label || range;

    return (
        <div>
            <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-2xl font-bold text-white">
                    {valuesHidden ? "••••••" : fmt(lastVal)}
                </p>
            </div>
            {!loading && values.length > 0 && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={"inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full " +
                        (isPos ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                        {isPos ? "▲" : "▼"} {valuesHidden ? "••••" : Math.abs(changePct).toFixed(2) + "%"}
                    </span>
                    <span className="text-slate-500 text-sm">
                        {valuesHidden ? "" : `(${isPos ? "+" : ""}${fmt(changeAmt)}) `}{rangeLabel}
                    </span>
                </div>
            )}

            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center justify-center" style={{ height: 190 }}>
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <Sparkline dates={history?.dates} values={values} />
                )}
            </div>

            <div className="flex gap-1 overflow-x-auto mt-3 pb-1 border-b border-slate-700/60" style={{ scrollbarWidth: "none" }}>
                {RANGES.map(r => (
                    <button key={r.id} onClick={() => setRange(r.id)}
                            className={"flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors " +
                                (range === r.id ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}>
                        {r.label}
                    </button>
                ))}
            </div>
        </div>
    );
}