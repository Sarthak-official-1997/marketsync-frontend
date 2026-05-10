import { useState, useEffect } from "react";
import { getStockPrice, getStockReturns, getStockChart } from "../api/portfolio";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

const fmt = (val, currency = "INR") => {
    if (val == null || isNaN(val)) return "—";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency === "INR" ? "INR" : "USD",
        maximumFractionDigits: 2,
    }).format(val);
};

const fmtPct = (val) => {
    if (val == null) return "—";
    const n = parseFloat(val);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

const clr = (val) => {
    if (val == null) return "text-slate-400";
    return parseFloat(val) >= 0 ? "text-green-400" : "text-red-400";
};

const TIMEFRAMES = [
    { label: "15m", interval: "15m",  range: "5d"  },
    { label: "1h",  interval: "60m",  range: "1mo" },
    { label: "1D",  interval: "1d",   range: "3mo" },
    { label: "1W",  interval: "1wk",  range: "2y"  },
    { label: "1M",  interval: "1mo",  range: "max" },
];

const RETURN_PERIODS = [
    { key: "1M", label: "1M"  },
    { key: "3M", label: "3M"  },
    { key: "6M", label: "6M"  },
    { key: "1Y", label: "1Y"  },
    { key: "3Y", label: "3Y"  },
    { key: "5Y", label: "5Y"  },
];

const CustomTooltip = ({ active, payload, label, currency }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 border border-slate-600
                        rounded-xl px-4 py-2.5 shadow-2xl">
            <p className="text-slate-400 text-xs mb-1">{label}</p>
            <p className="text-white font-bold text-base">
                {fmt(payload[0].value, currency)}
            </p>
        </div>
    );
};

export default function StockDetailModal({ stock, onClose }) {
    const [quote,        setQuote]     = useState(null);
    const [returns,      setReturns]   = useState(null);
    const [chartData,    setChartData] = useState([]);
    const [tf,           setTf]        = useState(TIMEFRAMES[2]);
    const [quoteLoading, setQL]        = useState(true);
    const [retLoading,   setRL]        = useState(true);
    const [chartLoading, setCL]        = useState(true);
    const [showReturns,  setShowReturns] = useState(false);

    useEffect(() => {
        if (!stock) return;
        setQuote(null); setReturns(null); setChartData([]);
        setQL(true); setRL(true);

        getStockPrice(stock.symbol)
            .then(r => setQuote(r.data)).catch(() => setQuote(null))
            .finally(() => setQL(false));

        getStockReturns(stock.symbol, stock.exchange)
            .then(r => setReturns(r.data)).catch(() => setReturns(null))
            .finally(() => setRL(false));
    }, [stock?.symbol]);

    useEffect(() => {
        if (!stock) return;
        setCL(true); setChartData([]);
        getStockChart(stock.symbol, stock.exchange, tf.interval, tf.range)
            .then(r => {
                const pts = (r.data?.dataPoints || [])
                    .filter(p => p.close != null)
                    .map(p => ({ date: p.date, close: parseFloat(p.close) }));
                setChartData(pts);
            })
            .catch(() => setChartData([]))
            .finally(() => setCL(false));
    }, [stock?.symbol, tf]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    if (!stock) return null;

    const pl     = parseFloat(quote?.changePercent || 0);
    const isPos  = pl >= 0;
    const plClr  = isPos ? "text-green-400" : "text-red-400";
    const tvUrl  = "https://www.tradingview.com/chart/?symbol="
        + (stock.exchange || "NSE") + ":" + stock.symbol + "&interval=W";

    const isUp      = chartData.length >= 2
        && chartData[chartData.length - 1].close >= chartData[0].close;
    const lineColor = isUp ? "#22c55e" : "#ef4444";
    const firstPrice = chartData.length > 0 ? chartData[0].close : null;

    const periodChange = chartData.length >= 2
        ? (((chartData[chartData.length-1].close - chartData[0].close)
            / chartData[0].close) * 100).toFixed(2)
        : null;

    const returnsOk = returns?.dataReliable === true
        && returns?.returns
        && Object.keys(returns.returns).length > 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Full-screen-ish modal */}
            <div
                className="relative z-50 bg-slate-900 flex flex-col"
                style={{
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
                {/* ── TOP BAR ── */}
                <div className="flex items-center justify-between
                                px-7 py-4 border-b border-slate-700/60
                                flex-shrink-0">
                    {/* Left: symbol + name */}
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600/20 border border-blue-500/40
                                        rounded-xl px-4 py-2 text-center">
                            <p className="text-lg font-bold text-white leading-none">
                                {stock.symbol}
                            </p>
                            <p className="text-xs text-blue-400 mt-0.5">
                                {stock.exchange}
                            </p>
                        </div>
                        <div>
                            <p className="text-white font-semibold text-lg">
                                {stock.name}
                            </p>
                            {stock.sector && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {stock.sector}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: price + buttons */}
                    <div className="flex items-center gap-5">
                        {quoteLoading ? (
                            <div className="h-9 w-36 bg-slate-700
                                            rounded animate-pulse" />
                        ) : quote ? (
                            <div className="text-right">
                                <p className="text-3xl font-bold text-white
                                              tracking-tight">
                                    {fmt(quote.currentPrice, quote.currency)}
                                </p>
                                <p className={"text-sm font-medium " + plClr}>
                                    {isPos ? "▲" : "▼"}{" "}
                                    {fmt(Math.abs(quote.change || 0), quote.currency)}{" "}
                                    ({isPos ? "+" : ""}{pl.toFixed(2)}%) today
                                </p>
                            </div>
                        ) : null}

                        <a
                            href={tvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5
                                       bg-blue-600 hover:bg-blue-700 text-white
                                       text-sm font-semibold rounded-xl
                                       transition-colors whitespace-nowrap"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg"
                                 className="w-4 h-4" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5
                                         a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            TradingView
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white
                                       hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg"
                                 className="w-5 h-5" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── STATS STRIP ── */}
                {quote && !quoteLoading && (
                    <div className="grid grid-cols-6 gap-px bg-slate-800/40
                                    flex-shrink-0 border-b border-slate-700/40">
                        {[
                            ["Day High",   fmt(quote.dayHigh,       quote.currency)],
                            ["Day Low",    fmt(quote.dayLow,        quote.currency)],
                            ["Prev Close", fmt(quote.previousClose, quote.currency)],
                            ["52W High",   fmt(quote.weekHigh52,    quote.currency)],
                            ["52W Low",    fmt(quote.weekLow52,     quote.currency)],
                            ["Data",       quote.dataSource || "—"],
                        ].map(([label, value]) => (
                            <div key={label} className="bg-slate-900 px-5 py-3">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className="text-sm font-semibold text-white mt-0.5">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── CHART SECTION — takes all remaining space ── */}
                <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-2">

                    {/* Chart controls row */}
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-white">
                                Price Chart
                            </p>
                            {periodChange && !chartLoading && (
                                <span className={
                                    "text-xs font-semibold px-2.5 py-1 " +
                                    "rounded-full " +
                                    (parseFloat(periodChange) >= 0
                                        ? "bg-green-900/40 text-green-400"
                                        : "bg-red-900/40 text-red-400")
                                }>
                                    {parseFloat(periodChange) >= 0 ? "+" : ""}
                                    {periodChange}% this period
                                </span>
                            )}
                        </div>

                        {/* Timeframe selector */}
                        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                            {TIMEFRAMES.map(t => (
                                <button
                                    key={t.label}
                                    onClick={() => setTf(t)}
                                    className={
                                        "px-4 py-1.5 rounded-lg text-xs " +
                                        "font-semibold transition-all " +
                                        (tf.label === t.label
                                            ? "bg-blue-600 text-white shadow"
                                            : "text-slate-400 hover:text-white " +
                                            "hover:bg-slate-700")
                                    }
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chart — fills ALL remaining vertical space */}
                    <div className="flex-1 min-h-0 bg-slate-800/40 rounded-2xl
                                    border border-slate-700/40 overflow-hidden">
                        {chartLoading ? (
                            <div className="h-full flex flex-col items-center
                                            justify-center gap-3">
                                <div className="w-8 h-8 border-2 border-blue-400
                                                border-t-transparent rounded-full
                                                animate-spin" />
                                <p className="text-slate-500 text-sm">
                                    Loading chart...
                                </p>
                            </div>
                        ) : chartData.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={chartData}
                                    margin={{ top: 16, right: 24,
                                        bottom: 8, left: 0 }}
                                >
                                    <defs>
                                        <linearGradient
                                            id="priceGrad" x1="0" y1="0"
                                            x2="0" y2="1">
                                            <stop offset="0%"
                                                  stopColor={lineColor}
                                                  stopOpacity={0.35}/>
                                            <stop offset="100%"
                                                  stopColor={lineColor}
                                                  stopOpacity={0.02}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(30,41,59,0.8)"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: "#475569", fontSize: 11 }}
                                        tickFormatter={d => {
                                            if (!d) return "";
                                            const p = d.toString()
                                                .split("T")[0].split("-");
                                            return p.length >= 2
                                                ? p[2] + "/" + p[1] : d;
                                        }}
                                        interval="preserveStartEnd"
                                        axisLine={false}
                                        tickLine={false}
                                        dy={8}
                                    />
                                    <YAxis
                                        tick={{ fill: "#475569", fontSize: 11 }}
                                        tickFormatter={v =>
                                            "₹" + (v >= 1000
                                                ? (v / 1000).toFixed(1) + "k"
                                                : v.toFixed(0))
                                        }
                                        domain={["auto", "auto"]}
                                        width={64}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={<CustomTooltip
                                            currency={quote?.currency || "INR"}
                                        />}
                                    />
                                    {firstPrice && (
                                        <ReferenceLine
                                            y={firstPrice}
                                            stroke="#334155"
                                            strokeDasharray="6 4"
                                            strokeWidth={1.5}
                                        />
                                    )}
                                    <Area
                                        type="monotone"
                                        dataKey="close"
                                        stroke={lineColor}
                                        strokeWidth={2.5}
                                        fill="url(#priceGrad)"
                                        dot={false}
                                        activeDot={{
                                            r: 6,
                                            fill: lineColor,
                                            stroke: "#0f172a",
                                            strokeWidth: 2,
                                        }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center
                                            justify-center gap-2">
                                <p className="text-slate-400">
                                    No data for this timeframe
                                </p>
                                <p className="text-slate-600 text-sm">
                                    Try a different range or open TradingView
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RETURNS — collapsible to save space ── */}
                <div className="px-6 pb-5 flex-shrink-0">
                    <button
                        onClick={() => setShowReturns(v => !v)}
                        className="w-full flex items-center justify-between
                                   px-5 py-3 bg-slate-800/60 hover:bg-slate-800
                                   rounded-2xl border border-slate-700/40
                                   transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-white">
                                Historical Returns
                            </p>
                            {returns?.dataReliable === false && (
                                <span className="text-xs bg-amber-900/40
                                                 text-amber-400 px-2 py-0.5 rounded-full">
                                    ⚠ Data unreliable
                                </span>
                            )}
                            {returnsOk && (
                                <div className="flex gap-2">
                                    {RETURN_PERIODS.map(({ key, label }) => {
                                        const r = returns.returns?.[key];
                                        if (!r) return null;
                                        const v = parseFloat(r.absoluteReturn);
                                        return (
                                            <span key={key}
                                                  className={
                                                      "text-xs font-medium px-2 " +
                                                      "py-0.5 rounded-full " +
                                                      (v >= 0
                                                          ? "bg-green-900/30 " +
                                                          "text-green-400"
                                                          : "bg-red-900/30 " +
                                                          "text-red-400")
                                                  }>
                                                {label}: {fmtPct(r.absoluteReturn)}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <span className={"text-slate-400 transition-transform " +
                        (showReturns ? "rotate-180" : "")}>
                            ▼
                        </span>
                    </button>

                    {showReturns && (
                        <div className="mt-2 bg-slate-800/60 rounded-2xl
                                        border border-slate-700/40 overflow-hidden">
                            {returns?.dataReliable === false ? (
                                <div className="p-5 text-center space-y-2">
                                    <p className="text-slate-300 text-sm font-medium">
                                        Historical data unreliable — split-adjusted prices
                                    </p>
                                    <a href={tvUrl} target="_blank"
                                       rel="noopener noreferrer"
                                       className="inline-flex items-center gap-1
                                                  text-blue-400 hover:text-blue-300
                                                  text-xs underline">
                                        View on TradingView →
                                    </a>
                                </div>
                            ) : !returnsOk ? (
                                <p className="text-slate-400 text-sm text-center p-5">
                                    Not available
                                </p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-slate-500 text-xs
                                                       uppercase border-b
                                                       border-slate-700/40">
                                        <th className="text-left px-5 py-2.5">
                                            Period
                                        </th>
                                        <th className="text-right px-5 py-2.5">
                                            Start Price
                                        </th>
                                        <th className="text-right px-5 py-2.5">
                                            Absolute
                                        </th>
                                        <th className="text-right px-5 py-2.5">
                                            CAGR (p.a.)
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {RETURN_PERIODS.map(({ key, label }) => {
                                        const r = returns.returns?.[key];
                                        if (!r) return null;
                                        return (
                                            <tr key={key}
                                                className="border-b border-slate-700/30
                                                               hover:bg-slate-700/20">
                                                <td className="px-5 py-2.5">
                                                    <p className="text-white font-medium">
                                                        {key === "1M" ? "1 Month"
                                                            : key === "3M" ? "3 Months"
                                                                : key === "6M" ? "6 Months"
                                                                    : key === "1Y" ? "1 Year"
                                                                        : key === "3Y" ? "3 Years"
                                                                            : "5 Years"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        since {r.startDate}
                                                    </p>
                                                </td>
                                                <td className="text-right px-5 py-2.5
                                                                   text-slate-400 text-xs">
                                                    {fmt(r.priceAtPeriodStart,
                                                        returns.currency)}
                                                </td>
                                                <td className={"text-right px-5 py-2.5 " +
                                                "font-semibold " +
                                                clr(r.absoluteReturn)}>
                                                    {fmtPct(r.absoluteReturn)}
                                                </td>
                                                <td className="text-right px-5 py-2.5
                                                                   font-medium">
                                                    {r.annualizedReturn != null ? (
                                                        <span className={
                                                            clr(r.annualizedReturn)}>
                                                                {fmtPct(r.annualizedReturn)}
                                                            </span>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs">
                                                                = absolute
                                                            </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}