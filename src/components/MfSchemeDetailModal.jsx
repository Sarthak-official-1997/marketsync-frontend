import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { getMfNavHistory, getMfHoldings } from "../api/portfolio";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

// -- Helpers ----------------------------------------------------------

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtUnits = (val) => parseFloat(val || 0).toFixed(4);

const fmtDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
        const [y, m, d] = dateStr.split("-");
        if (d) return `${d}/${m}/${y}`;
        return dateStr;
    } catch { return dateStr; }
};

const fmtPct = (val) => {
    if (val == null) return null;
    const n = parseFloat(val);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

const pctColor = (val) => {
    if (val == null) return "text-slate-400";
    return parseFloat(val) >= 0 ? "text-green-400" : "text-red-400";
};

const fmtChartTick = (d) => {
    if (!d) return "";
    const parts = d.toString().split("T")[0].split("-");
    return parts.length >= 3 ? `${parts[2]}/${parts[1]}/${parts[0].slice(2)}` : d;
};

const RANGES = ["1M", "2M", "3M", "6M", "1Y", "3Y", "5Y", "All"];
const MULTI_YEAR = new Set(["3Y", "5Y", "All"]);
const PERIOD_LABEL = {
    "1M": "1 Month",   "2M": "2 Months",  "3M": "3 Months",
    "6M": "6 Months",  "1Y": "1 Year",    "3Y": "3 Years",
    "5Y": "5 Years",   "All": "Since inception",
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 border border-slate-600
                        rounded-xl px-4 py-2.5 shadow-2xl">
            <p className="text-slate-400 text-xs mb-1">{fmtDate(label)}</p>
            <p className="text-white font-bold text-base">
                {fmt(payload[0].value)}
            </p>
        </div>
    );
};

// -- Component --------------------------------------------------------

export default function MfSchemeDetailModal({ scheme, onClose, onTransact }) {
    const isMobile = useMobile();
    const [range,         setRange]         = useState("1Y");
    const [data,          setData]          = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState(false);
    const [attemptNum,    setAttemptNum]    = useState(0);
    const [holding,       setHolding]       = useState(null);
    const [holdingLoaded, setHoldingLoaded] = useState(false);
    const [showReturns,   setShowReturns]   = useState(false);

    const MAX_AUTO_RETRIES = 2;

    const loadData = (rangeVal, retryCount = 0) => {
        setLoading(true);
        setError(false);
        setAttemptNum(retryCount + 1);
        getMfNavHistory(scheme.schemeCode, rangeVal)
            .then(res => { setData(res.data); setLoading(false); })
            .catch(() => {
                if (retryCount < MAX_AUTO_RETRIES) {
                    setTimeout(() => loadData(rangeVal, retryCount + 1), 800);
                } else {
                    setError(true);
                    setLoading(false);
                }
            });
    };

    useEffect(() => {
        if (!scheme) return;
        setData(null); setError(false);
        loadData(range);

        getMfHoldings()
            .then(res => {
                const found = (res.data || []).find(
                    h => h.schemeCode === scheme.schemeCode);
                setHolding(found || null);
            })
            .catch(() => setHolding(null))
            .finally(() => setHoldingLoaded(true));
    }, [scheme?.schemeCode, range]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    if (!scheme) return null;

    const currentRet = data?.returns?.[range];
    const currentAbs = currentRet?.absoluteReturn;

    const chartData = (data?.navHistory || []).map(p => ({
        date: p.date,
        nav:  parseFloat(p.nav),
    }));

    const isUp      = chartData.length >= 2
        && chartData[chartData.length - 1].nav >= chartData[0].nav;
    const lineColor = isUp ? "#22c55e" : "#ef4444";
    const firstNav  = chartData.length > 0 ? chartData[0].nav : null;

    const periodChange = chartData.length >= 2
        ? (((chartData[chartData.length-1].nav - chartData[0].nav)
            / chartData[0].nav) * 100).toFixed(2)
        : null;

    const holdingPL    = holding ? parseFloat(holding.unrealizedPnl || 0) : 0;
    const holdingPLPct = holding ? parseFloat(holding.unrealizedPnlPercent || 0) : 0;
    const holdingColor = holdingPL >= 0 ? "text-green-400" : "text-red-400";

    const investLabel = holding ? "Invest More / Redeem" : "Start Investing";

    return createPortal(
        <div
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div
                className="relative z-50 bg-slate-900 flex flex-col"
                style={isMobile ? {
                    width: "100vw",
                    height: "100dvh",
                    maxWidth: "100vw",
                    maxHeight: "100dvh",
                    borderRadius: 0,
                    border: "none",
                    paddingTop: "env(safe-area-inset-top, 0px)",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    overflowX: "hidden",
                } : {
                    width: "calc(100vw - 32px)",
                    height: "calc(100vh - 32px)",
                    maxWidth: "1200px",
                    maxHeight: "960px",
                    borderRadius: "20px",
                    border: "1px solid rgba(71,85,105,0.6)",
                    boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* -- HEADER -- */}
                {isMobile ? (
                    <div className="flex-shrink-0 border-b border-slate-700/60 px-3 pt-3 pb-2">
                        {/* Row 1: name + NAV + close */}
                        <div className="flex items-start gap-2 mb-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-bold text-sm leading-tight"
                                   style={{ display: "-webkit-box", WebkitLineClamp: 2,
                                       WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                    {scheme.schemeName}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {scheme.fundHouse && (
                                        <span className="text-[10px] text-slate-400">{scheme.fundHouse}</span>
                                    )}
                                    {holding && (
                                        <span className="text-[9px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded-full">
                                            ✓ Held
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!loading && data?.currentNav && (
                                <div className="text-right flex-shrink-0">
                                    <p className="text-white font-bold text-base tabular-nums leading-none">
                                        {fmt(data.currentNav)}
                                    </p>
                                    {currentAbs != null && (
                                        <p className={"text-[11px] font-semibold mt-0.5 " + pctColor(currentAbs)}>
                                            {fmtPct(currentAbs)}
                                        </p>
                                    )}
                                </div>
                            )}
                            <button onClick={onClose}
                                    className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-800
                                               flex items-center justify-center text-slate-400
                                               active:bg-slate-700 text-sm">
                                ✕
                            </button>
                        </div>
                        {/* Row 2: prominent action */}
                        <button onClick={() => { onTransact(scheme); onClose(); }}
                                className="w-full text-xs font-bold px-3 py-2.5 rounded-lg
                                           bg-blue-600 active:bg-blue-700 text-white">
                            💰 {investLabel}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-7 py-4
                                    border-b border-slate-700/60 flex-shrink-0">
                        <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-3 flex-wrap">
                                <p className="text-white font-bold text-xl leading-tight">
                                    {scheme.schemeName}
                                </p>
                                {holding && (
                                    <span className="text-xs bg-green-900/40 text-green-400
                                                     px-2.5 py-1 rounded-full flex-shrink-0">
                                        ✓ In your portfolio
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {scheme.fundHouse && (
                                    <span className="text-sm text-slate-400">{scheme.fundHouse}</span>
                                )}
                                {scheme.schemeCategory && (
                                    <span className="text-xs bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full">
                                        {scheme.schemeCategory}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                            {!loading && data?.currentNav && (
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-white tracking-tight">
                                        {fmt(data.currentNav)}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        NAV as of {fmtDate(data.navDate)}
                                    </p>
                                    {currentAbs != null && (
                                        <p className={"text-sm font-semibold mt-0.5 " + pctColor(currentAbs)}>
                                            {fmtPct(currentAbs)} ({PERIOD_LABEL[range]})
                                        </p>
                                    )}
                                </div>
                            )}
                            {/* Prominent action button — header level, like the stock modal */}
                            <button
                                onClick={() => { onTransact(scheme); onClose(); }}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                           font-semibold text-sm rounded-xl transition-colors whitespace-nowrap">
                                💰 {investLabel}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white
                                           hover:bg-slate-700 rounded-xl transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg"
                                     className="w-5 h-5" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor"
                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* -- SCROLLABLE BODY -- */}
                <div style={{
                    flex: "1 1 0",
                    overflowY: "auto",
                    overflowX: "hidden",
                    minHeight: 0,
                    paddingBottom: isMobile ? "calc(24px + env(safe-area-inset-bottom, 0px))" : 0,
                }}>

                    {/* -- SCHEME INFO STRIP -- */}
                    {scheme.schemeCode && (
                        <div className={
                            "gap-px bg-slate-800/40 border-b border-slate-700/40 flex-shrink-0 " +
                            (isMobile ? "grid grid-cols-2" : "grid grid-cols-4")
                        }>
                            {[
                                ["Scheme Code", scheme.schemeCode],
                                ["Fund House",  scheme.fundHouse  || "—"],
                                ["Category",    scheme.schemeCategory || "—"],
                                ["Type",        scheme.schemeType || "—"],
                            ].map(([label, value]) => (
                                <div key={label} className={`bg-slate-900 py-3 ${isMobile ? "px-3" : "px-5"}`}>
                                    <p className="text-xs text-slate-500">{label}</p>
                                    <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* -- CHART SECTION -- */}
                    <div className={`flex flex-col flex-shrink-0 pt-4 pb-2 ${isMobile ? "px-2" : "px-6"}`}>
                        <div className="flex items-center justify-between mb-3 flex-shrink-0" style={{ minWidth: 0 }}>
                            <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                                <p className="text-sm font-semibold text-white">NAV Chart</p>
                                {periodChange && !loading && (
                                    <span className={
                                        "text-xs font-semibold px-2.5 py-1 rounded-full " +
                                        (parseFloat(periodChange) >= 0
                                            ? "bg-green-900/40 text-green-400"
                                            : "bg-red-900/40 text-red-400")
                                    }>
                                        {parseFloat(periodChange) >= 0 ? "+" : ""}{periodChange}% this period
                                    </span>
                                )}
                            </div>

                            {/* Range selector — its own horizontal scroller on mobile */}
                            <div className={"flex gap-0.5 bg-slate-800 p-1 rounded-xl " + (isMobile ? "overflow-x-auto" : "")}
                                 style={isMobile ? { scrollbarWidth: "none", maxWidth: "60%" } : {}}>
                                {RANGES.map(r => (
                                    <button key={r} onClick={() => setRange(r)}
                                            className={
                                                "flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all " +
                                                (range === r
                                                    ? "bg-blue-600 text-white shadow"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-700")
                                            }>
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chart canvas — fixed clamp height so the body scrolls, never overflows */}
                        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/40 overflow-hidden"
                             style={{ height: "clamp(220px, 42vh, 520px)" }}>
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-slate-500 text-sm">
                                        {attemptNum === 1 ? "Loading NAV history..." : `Retrying... (${attemptNum} of 3)`}
                                    </p>
                                </div>
                            ) : error ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3">
                                    <p className="text-4xl">📡</p>
                                    <p className="text-slate-300 text-sm font-medium">mfapi.in is unreachable</p>
                                    <button onClick={() => loadData(range)}
                                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-colors">
                                        Retry
                                    </button>
                                </div>
                            ) : chartData.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 16, right: isMobile ? 4 : 24, bottom: 8, left: 0 }}>
                                        <defs>
                                            <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35}/>
                                                <stop offset="100%" stopColor={lineColor} stopOpacity={0.02}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.8)" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }}
                                               tickFormatter={fmtChartTick} interval="preserveStartEnd"
                                               axisLine={false} tickLine={false} dy={8} />
                                        <YAxis tick={{ fill: "#475569", fontSize: 11 }}
                                               tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0))}
                                               domain={["auto", "auto"]} width={isMobile ? 48 : 64}
                                               axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        {firstNav && (
                                            <ReferenceLine y={firstNav} stroke="#334155" strokeDasharray="6 4" strokeWidth={1.5} />
                                        )}
                                        <Area type="monotone" dataKey="nav" stroke={lineColor} strokeWidth={2.5}
                                              fill="url(#navGrad)" dot={false}
                                              activeDot={{ r: 6, fill: lineColor, stroke: "#0f172a", strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-slate-400 text-sm">No chart data for this range</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* -- RETURNS + HOLDINGS -- */}
                    <div className={`pb-5 flex-shrink-0 space-y-2 ${isMobile ? "px-2" : "px-6"}`} style={{ minWidth: 0 }}>

                        {/* Returns — collapsible */}
                        {!loading && !error && data?.returns && (
                            <div>
                                <button onClick={() => setShowReturns(v => !v)}
                                        className="w-full flex items-center justify-between px-5 py-3
                                                   bg-slate-800/60 hover:bg-slate-800 rounded-2xl
                                                   border border-slate-700/40 transition-colors">
                                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                                        <p className="text-sm font-semibold text-white flex-shrink-0">Historical Returns</p>
                                        {RANGES.filter(r => !MULTI_YEAR.has(r) || r === "3Y").map(r => {
                                            const ret = data.returns?.[r];
                                            if (!ret) return null;
                                            const abs = ret.absoluteReturn ?? ret;
                                            const v   = parseFloat(abs);
                                            return (
                                                <span key={r}
                                                      className={"text-xs font-medium px-2 py-0.5 rounded-full " +
                                                      (v >= 0 ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                                                    {r}: {v >= 0 ? "+" : ""}{v.toFixed(1)}%
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <span className={"text-slate-400 text-xs transition-transform flex-shrink-0 " +
                                    (showReturns ? "rotate-180" : "")}>▼</span>
                                </button>

                                {showReturns && (
                                    <div className="mt-1 bg-slate-800/60 rounded-2xl border border-slate-700/40 overflow-hidden">
                                        {RANGES.map(period => {
                                            const ret = data.returns?.[period];
                                            if (ret == null) return null;
                                            const abs  = ret.absoluteReturn ?? ret;
                                            const cagr = ret.annualizedReturn;
                                            const isMulti = MULTI_YEAR.has(period);
                                            return (
                                                <div key={period}
                                                     className={"flex items-center justify-between gap-3 px-4 py-3 " +
                                                     "border-b border-slate-700/30 last:border-b-0 " +
                                                     (range === period ? "bg-blue-900/10" : "")}>
                                                    <p className="text-white text-sm font-semibold min-w-0 truncate">
                                                        {PERIOD_LABEL[period] || period}
                                                    </p>
                                                    <div className="flex-shrink-0 text-right">
                                                        <p className={"text-[15px] font-bold leading-tight " + pctColor(abs)}>
                                                            {fmtPct(abs)}
                                                        </p>
                                                        {isMulti && cagr != null ? (
                                                            <p className={"text-[10px] leading-tight " + pctColor(cagr)}>
                                                                {fmtPct(cagr)} p.a.
                                                            </p>
                                                        ) : (
                                                            <p className="text-[10px] leading-tight text-slate-600">= absolute</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Holdings */}
                        {holdingLoaded && holding ? (
                            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 px-5 py-3">
                                <p className="text-xs text-slate-500 mb-2">Your Holdings</p>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                    {[
                                        ["Units",    fmtUnits(holding.units)],
                                        ["Avg NAV",  fmt(holding.avgCostNav)],
                                        ["Invested", fmt(holding.totalInvested)],
                                        ["Value",    fmt(holding.currentValue)],
                                    ].map(([l, v]) => (
                                        <div key={l}>
                                            <p className="text-xs text-slate-500">{l}</p>
                                            <p className="text-sm font-semibold text-white mt-0.5">{v}</p>
                                        </div>
                                    ))}
                                    <div>
                                        <p className="text-xs text-slate-500">P&amp;L</p>
                                        <p className={"text-sm font-bold mt-0.5 " + holdingColor}>
                                            {fmt(holding.unrealizedPnl)}
                                        </p>
                                        <p className={"text-xs " + holdingColor}>
                                            {holdingPL >= 0 ? "+" : ""}{holdingPLPct.toFixed(2)}%
                                        </p>
                                    </div>
                                </div>
                                {holding.navDate && (
                                    <p className="text-xs text-slate-600 mt-2">NAV as of {fmtDate(holding.navDate)}</p>
                                )}
                            </div>
                        ) : holdingLoaded && !holding ? (
                            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 px-5 py-3">
                                <p className="text-slate-400 text-sm">You don't hold this fund yet</p>
                            </div>
                        ) : (
                            <div className="h-16 bg-slate-700 rounded-2xl animate-pulse" />
                        )}

                        {/* Desktop-only secondary invest button at the bottom (mobile has it in the header) */}
                        {!isMobile && (
                            <button
                                onClick={() => { onTransact(scheme); onClose(); }}
                                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700
                                           text-white font-semibold text-sm rounded-xl transition-colors">
                                💰 {investLabel}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}