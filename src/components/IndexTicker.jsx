import { useState, useEffect, useCallback } from "react";
import { getIndices } from "../api/portfolio";

const isMarketHours = () => {
    const ist  = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day  = ist.getDay();
    if (day === 0 || day === 6) return false;
    const mins = ist.getHours() * 60 + ist.getMinutes();
    return mins >= 9 * 60 && mins <= 15 * 60 + 30;
};

const fmtVal = (v) => {
    if (v == null) return "—";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v);
};

// Map backend Yahoo symbols → TradingView chart URLs
const TV_URL = {
    "^NSEI":      "https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY50",
    "^BSESN":     "https://www.tradingview.com/chart/?symbol=BSE%3ASENSEX",
    "^NSEBANK":   "https://www.tradingview.com/chart/?symbol=NSE%3ABANKNIFTY",
    "^NSEMDCP50": "https://www.tradingview.com/chart/?symbol=NSE%3ANIFTYMIDCAP50",
    "^INDIAVIX":  "https://www.tradingview.com/chart/?symbol=NSE%3AINDIAVIX",
};

// ── Index Modal — clean info + redirect, no broken embed ─────────────
function IndexModal({ idx, onClose }) {
    const up     = parseFloat(idx.changePercent || 0) >= 0;
    const tvUrl  = TV_URL[idx.symbol] || "https://www.tradingview.com";

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative z-50 bg-slate-900 border border-slate-700
                           rounded-2xl shadow-2xl w-full max-w-sm"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 border border-blue-500/40
                                        rounded-xl px-3 py-2 text-center">
                            <p className="text-sm font-bold text-white leading-tight">
                                {idx.displayName}
                            </p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {fmtVal(idx.value)}
                            </p>
                            <p className={"text-sm font-semibold " +
                            (up ? "text-green-400" : "text-red-400")}>
                                {up ? "▲" : "▼"}{" "}
                                {Math.abs(parseFloat(idx.changePercent || 0)).toFixed(2)}%
                                {" today"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700
                                   rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-4">
                    <div className={"w-full rounded-xl px-4 py-3 border text-center " +
                    (up
                        ? "bg-green-900/20 border-green-800/40"
                        : "bg-red-900/20 border-red-800/40")}>
                        <p className={"text-xs mb-1 " +
                        (up ? "text-green-500" : "text-red-500")}>
                            {up ? "Trading Higher" : "Trading Lower"} today
                        </p>
                        <p className={"text-3xl font-bold " +
                        (up ? "text-green-400" : "text-red-400")}>
                            {up ? "+" : ""}{parseFloat(idx.changePercent || 0).toFixed(2)}%
                        </p>
                    </div>

                    <p className="text-slate-500 text-xs text-center">
                        Live index charts are available on TradingView.
                        Click below to view the full interactive chart.
                    </p>

                    <a href={tvUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2 w-full
                                   py-3 bg-blue-600 hover:bg-blue-700 text-white
                                   text-sm font-bold rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        View {idx.displayName} Chart on TradingView
                    </a>
                </div>
            </div>
        </div>
    );
}

// ====================================================================
export default function IndexTicker() {
// ====================================================================
    const [indices,   setIndices]  = useState([]);
    const [loading,   setLoading]  = useState(true);
    const [activeIdx, setActiveIdx]= useState(null);

    const fetchData = useCallback(() => {
        getIndices()
            .then(res => setIndices(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, isMarketHours() ? 60_000 : 300_000);
        return () => clearInterval(t);
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex gap-4">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-8 w-24 bg-slate-700 rounded animate-pulse" />
                ))}
            </div>
        );
    }
    if (indices.length === 0) return null;

    return (
        <>
            {/* Index bar — spread items across full width, bigger text */}
            <div className="flex items-stretch w-full min-h-[75px]">
                {indices.map((idx, i) => {
                    const up = parseFloat(idx.changePercent || 0) >= 0;
                    return (
                        <button
                            key={idx.symbol}
                            onClick={() => setActiveIdx(idx)}
                            title={`Click to view ${idx.displayName}`}
                            className={
                                "flex flex-col items-center justify-center flex-1 " +
                                "px-2 py-2 hover:bg-slate-700/50 transition-colors " +
                                (i < indices.length - 1
                                    ? "border-r border-slate-700/60"
                                    : "")
                            }
                        >
                            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                <span className="text-xs sm:text-sm font-semibold text-slate-300 whitespace-nowrap">
                                    {idx.displayName}
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                                    {fmtVal(idx.value)}
                                </span>
                            </div>
                            <span className={"text-xs sm:text-sm font-semibold whitespace-nowrap " +
                            (up ? "text-green-400" : "text-red-400")}>
                                {up ? "▲" : "▼"}{" "}
                                {Math.abs(parseFloat(idx.changePercent || 0)).toFixed(2)}%
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeIdx && (
                <IndexModal idx={activeIdx} onClose={() => setActiveIdx(null)} />
            )}
        </>
    );
}