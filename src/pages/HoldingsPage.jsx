import {useState, useEffect, useMemo} from "react";
import {
    getHoldings, getMfHoldings, getPortfolioHistory,
} from "../api/portfolio";
import {SkeletonTable} from "../components/Skeleton";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import StockTransactionPanel from "../components/StockTransactionPanel";
import MfTransactionPanel from "../components/MfTransactionPanel";
import StockQuickMenu from "../components/StockQuickMenu";
import StockDetailModal from "../components/StockDetailModal";
import {useToast} from "../context/ToastContext";
import {useNavigate} from "react-router-dom";

import StockLogo from "../components/StockLogo";
import {
    Treemap, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, ReferenceLine,
} from "recharts";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtUnits = (val) => parseFloat(val || 0).toFixed(4);

const fmtCrore = (v) => {
    const n = parseFloat(v || 0);
    if (!n) return "₹0";
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
    return `₹${n.toLocaleString("en-IN", {maximumFractionDigits: 0})}`;
};

const fmtAxisDate = (isoDate) => {
    try {
        const [, m, d] = isoDate.split("-");
        const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${parseInt(d)} ${mo[parseInt(m, 10) - 1]}`;
    } catch {
        return isoDate;
    }
};

const Dash = () => <span className="text-slate-600 select-none">—</span>;

// ─── Portfolio Performance Card ───────────────────────────────────────────────

function PortfolioPerformanceCard({holdings, onRefresh, todayPL, todayPct, todayUp, hasTodayData}) {
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [chartError, setChartError] = useState(false);

    const liveValue = useMemo(() =>
            holdings.reduce((s, h) =>
                s + (h.currentPrice != null
                    ? parseFloat(h.currentPrice) * parseFloat(h.quantity || 0) : 0), 0),
        [holdings]);

    const totalInvested = useMemo(() =>
            holdings.reduce((s, h) => s + parseFloat(h.totalInvested || 0), 0),
        [holdings]);

    const livePL    = liveValue - totalInvested;
    const livePLPct = totalInvested > 0 ? (livePL / totalInvested * 100) : 0;
    const isUp      = livePL >= 0;

    const depKey = holdings
        .map(h => `${h.stock?.symbol}:${h.quantity}:${h.totalInvested}`)
        .join("|");

    const fetchHistory = () => {
        if (!holdings || holdings.length === 0) {
            setChartLoading(false);
            return;
        }
        let cancelled = false;
        setChartLoading(true);
        setChartError(false);

        getPortfolioHistory("3mo")
            .then(res => {
                if (cancelled) return;
                const dates  = res?.dates  || [];
                const values = res?.values || [];
                const points = dates
                    .map((d, i) => ({
                        date:  fmtAxisDate(d),
                        value: Math.round(parseFloat(values[i] || 0)),
                    }))
                    .filter(p => p.value > 0);
                if (points.length > 0 && liveValue > 0) {
                    points.push({date: "Today", value: Math.round(liveValue)});
                }
                setChartData(points);
                if (points.length === 0) setChartError(true);
            })
            .catch(() => { if (!cancelled) setChartError(true); })
            .finally(() => { if (!cancelled) setChartLoading(false); });

        return () => { cancelled = true; };
    };

    useEffect(fetchHistory, [depKey]);

    const domain = useMemo(() => {
        if (chartData.length < 2) return ["auto", "auto"];
        const vals = chartData.map(d => d.value);
        const all  = [...vals, totalInvested, liveValue].filter(v => v > 0);
        const minV = Math.min(...all);
        const maxV = Math.max(...all);
        const pad  = Math.max((maxV - minV) * 0.15, maxV * 0.02);
        return [Math.round(minV - pad), Math.round(maxV + pad)];
    }, [chartData, totalInvested, liveValue]);

    const hasChart  = chartData.length >= 3;
    const lineColor = isUp ? "#3b82f6" : "#ef4444";

    return (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">

            {/* ── Stats row ─────────────────────────────────────────────────────
                FIX 1: Changed from grid-cols-3 to flex so Today's Change card
                        fits naturally without wrapping when hasTodayData is true.
                FIX 2: Removed stray bare `<` that was between Total Invested
                        and Total P&L divs — it caused a JSX parse error.
                FIX 3: Total P&L <div> now properly closed before Today's Change.
            ── */}
            <div className="flex divide-x divide-slate-700/60">

                {/* Current Value */}
                <div className="flex-1 px-6 py-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Current Value
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">{fmtCrore(liveValue)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(liveValue)}</p>
                </div>

                {/* Total Invested */}
                <div className="flex-1 px-6 py-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Total Invested
                    </p>
                    <p className="text-2xl font-bold text-slate-300 mt-1">{fmtCrore(totalInvested)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(totalInvested)}</p>
                </div>

                {/* Total P&L — FIX: div now properly opened AND closed */}
                <div className="flex-1 px-6 py-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Total P&L
                    </p>
                    <div className="flex items-end gap-2 mt-1 flex-wrap">
                        <p className={"text-2xl font-bold " + (isUp ? "text-green-400" : "text-red-400")}>
                            {isUp ? "+" : ""}{fmtCrore(livePL)}
                        </p>
                        <span className={"text-base font-bold pb-0.5 " + (isUp ? "text-green-400" : "text-red-400")}>
                            ({isUp ? "+" : ""}{livePLPct.toFixed(2)}%)
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(livePL)}</p>
                </div>

                {/* Today's Change — only shown when live price data is available */}
                {hasTodayData && (
                    <div className="flex-1 px-6 py-4">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                            Today&apos;s Change
                        </p>
                        <div className="flex items-end gap-2 mt-1 flex-wrap">
                            <p className={"text-2xl font-bold " + (todayUp ? "text-green-400" : "text-red-400")}>
                                {todayUp ? "+" : ""}{fmtCrore(todayPL)}
                            </p>
                            <span className={"text-base font-bold pb-0.5 " + (todayUp ? "text-green-400" : "text-red-400")}>
                                ({todayUp ? "+" : ""}{todayPct.toFixed(2)}%)
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">today</p>
                    </div>
                )}

            </div>{/* end stats row */}

            {/* ── Chart / Fallback ── */}
            <div className="border-t border-slate-700/60">
                {chartLoading ? (
                    <div className="h-32 flex items-center justify-center gap-2.5">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent
                                        rounded-full animate-spin"/>
                        <p className="text-slate-600 text-xs">Loading 3-month price history…</p>
                    </div>

                ) : hasChart ? (
                    <div className="px-2 pt-3 pb-2">
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={chartData}
                                       margin={{top: 6, right: 8, bottom: 0, left: 4}}>
                                <defs>
                                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.28}/>
                                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date"
                                       tick={{fill: "#475569", fontSize: 10}}
                                       tickLine={false} axisLine={false}
                                       interval="preserveStartEnd" dy={4}/>
                                <YAxis domain={domain}
                                       tick={{fill: "#475569", fontSize: 10}}
                                       tickFormatter={v =>
                                           v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr`
                                               : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L`
                                                   : `${(v / 1000).toFixed(0)}K`}
                                       tickLine={false} axisLine={false} width={44}/>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#1e293b",
                                        border: "1px solid #334155",
                                        borderRadius: "10px", color: "#fff", fontSize: 12,
                                    }}
                                    formatter={(v) => [fmt(v), "Portfolio Value"]}
                                    labelStyle={{color: "#94a3b8", marginBottom: 2}}/>
                                {totalInvested > 0 && (
                                    <ReferenceLine y={totalInvested}
                                                   stroke="#475569" strokeDasharray="5 4"
                                                   strokeWidth={1.5}
                                                   label={{
                                                       value: "Cost", position: "insideTopRight",
                                                       fill: "#475569", fontSize: 9, dy: -6,
                                                   }}/>
                                )}
                                <Area type="monotone" dataKey="value"
                                      stroke={lineColor} strokeWidth={2}
                                      fill="url(#perfGrad)" dot={false}
                                      activeDot={{r: 4, fill: lineColor, stroke: "#0f172a", strokeWidth: 2}}
                                      isAnimationActive={false}/>
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex items-center justify-between px-2 mt-1">
                            <p className="text-xs text-slate-700">
                                {chartData.length - 1} trading days · daily close
                            </p>
                            <p className="text-xs text-slate-700">Dashed = cost basis</p>
                        </div>
                    </div>

                ) : (
                    <div className="px-6 py-4">
                        <div className="relative h-10 bg-slate-900/60 rounded-xl overflow-hidden">
                            <div className="absolute inset-0 bg-slate-700/30 rounded-xl"/>
                            <div
                                className={
                                    "absolute left-0 top-0 h-full rounded-xl transition-all duration-1000 " +
                                    (isUp
                                        ? "bg-gradient-to-r from-blue-600/70 to-green-500/70"
                                        : "bg-gradient-to-r from-blue-600/70 to-red-500/70")
                                }
                                style={{
                                    width: totalInvested > 0
                                        ? `${Math.min(100, (liveValue / Math.max(liveValue, totalInvested)) * 100).toFixed(1)}%`
                                        : "0%",
                                }}/>
                            <div className="absolute inset-0 flex items-center
                                            justify-between px-4 pointer-events-none">
                                <span className="text-xs text-slate-300 font-medium">
                                    Invested {fmtCrore(totalInvested)}
                                </span>
                                <span className={"text-sm font-bold " +
                                (isUp ? "text-green-300" : "text-red-300")}>
                                    {isUp ? "+" : ""}{livePLPct.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-2.5">
                            <p className="text-xs text-slate-600">
                                {chartError
                                    ? "Price history unavailable — Yahoo Finance unreachable"
                                    : "Loading price history…"}
                            </p>
                            <button
                                onClick={fetchHistory}
                                className="text-xs text-blue-500 hover:text-blue-400
                                           hover:underline transition-colors font-medium">
                                🔄 Retry chart
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}

// ─── View Toggle ──────────────────────────────────────────────────────────────

function ViewToggle({value, onChange}) {
    const opts = [
        {id: "list", icon: "▤", label: "Holdings List"},
        {id: "map",  icon: "⊞", label: "Allocation Map"},
    ];
    return (
        <div className="flex items-center justify-between">
            <div className="flex bg-slate-800/80 border border-slate-700/60 rounded-2xl p-1.5 gap-1">
                {opts.map(o => (
                    <button key={o.id} onClick={() => onChange(o.id)}
                            className={
                                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl " +
                                "text-sm font-semibold transition-all duration-200 " +
                                (value === o.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-[1.02]"
                                    : "text-slate-400 hover:text-white hover:bg-slate-700/60")
                            }>
                        <span className="text-base leading-none">{o.icon}</span>
                        {o.label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-slate-700 hidden md:block pr-1">
                {value === "list"
                    ? "Switch to see allocation by weight"
                    : "Switch to see individual holdings"}
            </p>
        </div>
    );
}

// ─── Treemap ──────────────────────────────────────────────────────────────────

function TreemapCell({x, y, width, height, name, plPct}) {
    const p  = parseFloat(plPct || 0);
    const bg =
        p >= 5 ? "#15803d" : p >= 3 ? "#16a34a" : p >= 1 ? "#22c55e"
            : p >= 0 ? "#4ade80" : p >= -1 ? "#fca5a5" : p >= -3 ? "#f87171"
                : p >= -5 ? "#ef4444" : "#dc2626";
    if (width < 2 || height < 2) return null;
    const showText = width > 50 && height > 36;
    const showPct  = width > 60 && height > 52;
    return (
        <g>
            <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2}
                  fill={bg} rx={4} stroke="#0f172a" strokeWidth={1.5}/>
            {showText && (
                <text x={x + width / 2} y={y + height / 2 - (showPct ? 9 : 0)}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={Math.min(14, Math.max(9, width / 6))} fontWeight="700">
                    {name.length > 8 ? name.slice(0, 7) + "…" : name}
                </text>
            )}
            {showPct && (
                <text x={x + width / 2} y={y + height / 2 + 11}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="rgba(255,255,255,0.8)" fontSize={Math.min(11, Math.max(8, width / 8))}>
                    {p >= 0 ? "+" : ""}{p.toFixed(2)}%
                </text>
            )}
        </g>
    );
}

function StockAllocationMap({holdings, onStockClick}) {
    const rows = holdings
        .map(h => ({
            name:     h.stock.symbol,
            fullName: h.stock.name,
            size:     parseFloat(h.currentValue || h.totalInvested || 0),
            plPct:    parseFloat(h.unrealizedPLPercent || 0),
            value:    parseFloat(h.currentValue || 0),
            invested: parseFloat(h.totalInvested || 0),
            pl:       parseFloat(h.unrealizedPL || 0),
            stock:    h.stock,
        }))
        .filter(r => r.size > 0)
        .sort((a, b) => b.size - a.size);

    const total = rows.reduce((s, r) => s + r.size, 0);

    if (rows.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center">
                <p className="text-slate-500 text-sm">No holdings data to visualize</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-slate-500">P&L:</span>
                {[["≥+5%", "#15803d"], ["≥+1%", "#22c55e"], ["0%", "#4ade80"],
                    ["≤-1%", "#fca5a5"], ["≤-5%", "#ef4444"]].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{backgroundColor: c}}/>
                        <span className="text-xs text-slate-400">{l}</span>
                    </div>
                ))}
                <span className="text-xs text-slate-600 ml-auto">Box size = current value</span>
            </div>
            <ResponsiveContainer width="100%" height={380}>
                <Treemap data={rows.map(r => ({...r, total}))} dataKey="size"
                         aspectRatio={16 / 9} isAnimationActive={false}
                         content={<TreemapCell/>}
                         onClick={(data) => data?.stock && onStockClick(data.stock)}>
                    <Tooltip
                        content={({payload}) => {
                            if (!payload?.[0]) return null;
                            const d  = payload[0].payload;
                            const up = d.plPct >= 0;
                            const wt = d.total > 0
                                ? ((d.size / d.total) * 100).toFixed(1) : "0.0";
                            return (
                                <div className="bg-slate-800 border border-slate-700
                                                rounded-xl p-3 shadow-2xl text-sm min-w-[180px]">
                                    <p className="font-bold text-white text-base">{d.name}</p>
                                    <p className="text-slate-400 text-xs mt-0.5 truncate">{d.fullName}</p>
                                    <div className="mt-2.5 space-y-1.5">
                                        {[
                                            ["Weight",   <span className="text-yellow-400 font-bold text-xs">{wt}%</span>],
                                            ["Invested", <span className="text-white text-xs">{fmt(d.invested)}</span>],
                                            ["Value",    <span className="text-white font-semibold text-xs">{fmt(d.value)}</span>],
                                            ["P&L",      <span className={"font-semibold text-xs " + (up ? "text-green-400" : "text-red-400")}>
                                                             {up ? "+" : ""}{fmt(d.pl)} ({up ? "+" : ""}{d.plPct.toFixed(2)}%)
                                                         </span>],
                                        ].map(([label, val]) => (
                                            <div key={label} className="flex justify-between gap-4">
                                                <span className="text-slate-400 text-xs">{label}</span>
                                                {val}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }}
                    />
                </Treemap>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 pt-1">
                {rows.map(r => {
                    const wt = total > 0 ? ((r.size / total) * 100) : 0;
                    const up = r.plPct >= 0;
                    return (
                        <button key={r.name} onClick={() => onStockClick(r.stock)}
                                className="flex items-center gap-2 bg-slate-800 border
                                           border-slate-700/60 rounded-xl px-3 py-1.5
                                           hover:bg-slate-700/60 transition-colors">
                            <span className="text-white text-xs font-bold">{r.name}</span>
                            <span className="text-slate-500 text-xs">{wt.toFixed(1)}%</span>
                            <span className={"text-xs font-medium " +
                            (up ? "text-green-400" : "text-red-400")}>
                                {up ? "+" : ""}{r.plPct.toFixed(1)}%
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HoldingsPage(props) {
    const [holdings,       setHoldings]       = useState([]);
    const [mfHoldings,     setMfHoldings]     = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [refreshing,     setRefreshing]     = useState(false);
    const [error,          setError]          = useState("");
    const [view,           setView]           = useState(props.defaultView || "stocks");
    const [stockView,      setStockView]      = useState("list");
    const [activeStock,    setActiveStock]    = useState(null);
    const [activeMf,       setActiveMf]       = useState(null);
    const [quickMenuStock, setQuickMenuStock] = useState(null);
    const [chartStock,     setChartStock]     = useState(null);
    const toast    = useToast();
    const navigate = useNavigate();

    const loadHoldings = (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        Promise.all([getHoldings(), getMfHoldings()])
            .then(([sRes, mRes]) => {
                setHoldings(sRes.data || []);
                setMfHoldings(mRes.data || []);
            })
            .catch(() => setError("Failed to load holdings"))
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => { loadHoldings(); }, []);

    if (loading) return <SkeletonTable rows={5} cols={8}/>;
    if (error)   return <ErrorMessage message={error}/>;

    const tabs = [
        {id: "stocks",   label: "📈 Stocks"},
        {id: "mf",       label: "📊 MF"},
        {id: "combined", label: "⊞ Combined"},
    ];

    // Today's portfolio P&L — computed here so it can be passed as props
    const _liveVal     = holdings.reduce((s, h) =>
        s + (h.currentPrice != null ? parseFloat(h.currentPrice) * parseFloat(h.quantity || 0) : 0), 0);
    const todayPL      = holdings.reduce((s, h) =>
        h.dayChange != null ? s + parseFloat(h.dayChange) * parseFloat(h.quantity || 0) : s, 0);
    const todayPct     = _liveVal > 0 ? (todayPL / (_liveVal - todayPL) * 100) : 0;
    const todayUp      = todayPL >= 0;
    const hasTodayData = holdings.some(h => h.dayChange != null);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Holdings</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Click any stock name to view chart or add transactions
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setView(t.id)}
                                    className={
                                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " +
                                        (view === t.id
                                            ? "bg-blue-600 text-white"
                                            : "text-slate-400 hover:text-white")
                                    }>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => loadHoldings(true)} disabled={refreshing}
                            className="p-2 text-slate-400 hover:text-white rounded-lg
                                       hover:bg-slate-700 transition-colors disabled:opacity-40">
                        <span className={refreshing ? "animate-spin inline-block" : ""}>🔄</span>
                    </button>
                </div>
            </div>

            {/* ── STOCKS TAB ── */}
            {view === "stocks" && (
                <div className="space-y-4">
                    {holdings.length > 0 && (
                        <PortfolioPerformanceCard
                            holdings={holdings}
                            todayPL={todayPL}
                            todayPct={todayPct}
                            todayUp={todayUp}
                            hasTodayData={hasTodayData}
                        />
                    )}
                    {holdings.length > 0 && (
                        <ViewToggle value={stockView} onChange={setStockView}/>
                    )}
                    {stockView === "list" ? (
                        <StockHoldingsTable
                            holdings={holdings}
                            onStockClick={setQuickMenuStock}
                            onTransact={setActiveStock}
                            onNavigate={() => navigate("/stocks/transactions")}
                        />
                    ) : (
                        <div className="bg-slate-800 rounded-2xl border border-slate-700/60 p-5">
                            <StockAllocationMap
                                holdings={holdings}
                                onStockClick={setQuickMenuStock}
                            />
                        </div>
                    )}
                </div>
            )}

            {view === "mf" && (
                <MfHoldingsTable mfHoldings={mfHoldings} onOpenPanel={setActiveMf}/>
            )}

            {view === "combined" && (
                <CombinedHoldingsTable
                    holdings={holdings}
                    mfHoldings={mfHoldings}
                    onStockClick={setQuickMenuStock}
                    onOpenMfPanel={setActiveMf}
                />
            )}

            {/* ── Overlays ── */}
            {quickMenuStock && (
                <StockQuickMenu
                    stock={quickMenuStock}
                    onClose={() => setQuickMenuStock(null)}
                    onViewChart={() => setChartStock(quickMenuStock)}
                    onTransact={() => setActiveStock(quickMenuStock)}
                />
            )}
            {chartStock && (
                <StockDetailModal stock={chartStock} onClose={() => setChartStock(null)}/>
            )}
            {activeStock && (
                <StockTransactionPanel
                    stock={activeStock}
                    onClose={() => setActiveStock(null)}
                    onChanged={() => loadHoldings(true)}
                />
            )}
            {activeMf && (
                <MfTransactionPanel
                    scheme={activeMf}
                    onClose={() => setActiveMf(null)}
                    onChanged={() => loadHoldings(true)}
                />
            )}
        </div>
    );
}

// ─── Stocks table ─────────────────────────────────────────────────────────────

function StockHoldingsTable({holdings, onStockClick, onTransact, onNavigate}) {
    if (holdings.length === 0) {
        return (
            <EmptyState icon="💼" title="No stock holdings yet"
                        message="Record your first BUY transaction to start tracking."
                        action="+ Record a Transaction" onAction={onNavigate}/>
        );
    }

    const hasMissingPrices = holdings.some(h => h.currentPrice == null);

    return (
        <div className="space-y-2">
            {hasMissingPrices && (
                <div className="flex items-start gap-3 bg-amber-900/20 border
                                border-amber-500/30 rounded-xl px-4 py-3">
                    <span className="text-amber-400 text-lg flex-shrink-0 mt-0.5">⚠</span>
                    <div>
                        <p className="text-amber-300 font-semibold text-xs">
                            Live prices temporarily unavailable
                        </p>
                        <p className="text-amber-600 text-xs mt-0.5">
                            P&L calculations hidden. Click 🔄 to retry.
                        </p>
                    </div>
                </div>
            )}
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                        <th className="text-left px-4 py-3">Stock</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Avg Buy</th>
                        <th className="text-right px-4 py-3">Current</th>
                        <th className="text-right px-4 py-3">Value</th>
                        <th className="text-right px-4 py-3">P&amp;L</th>
                        <th className="text-right px-4 py-3">P&amp;L %</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {holdings.map(h => {
                        const hasPrice = h.currentPrice != null;
                        const pl       = parseFloat(h.unrealizedPL || 0);
                        const plPct    = parseFloat(h.unrealizedPLPercent || 0);
                        const isPos    = pl >= 0;
                        const plColor  = hasPrice
                            ? (isPos ? "text-green-400" : "text-red-400")
                            : "text-slate-600";
                        return (
                            <tr key={h.id}
                                className="border-b border-slate-700/40 last:border-0
                                           hover:bg-slate-700/30 transition-colors">
                                <td className="px-4 py-3.5">
                                    <button onClick={() => onStockClick(h.stock)}
                                            className="text-left group flex items-center gap-2.5">
                                        <StockLogo symbol={h.stock.symbol} name={h.stock.name} size={32} />
                                        <div>
                                            <p className="font-bold text-white group-hover:text-blue-400
                                                          transition-colors text-sm leading-tight">
                                                {h.stock.symbol}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate max-w-[120px] leading-tight">
                                                {h.stock.name}
                                            </p>
                                        </div>
                                    </button>
                                </td>
                                <td className="text-right px-4 py-3.5 text-white">
                                    {parseFloat(h.quantity || 0).toFixed(2)}
                                </td>
                                <td className="text-right px-4 py-3.5 text-slate-300">
                                    {fmt(h.averageBuyPrice)}
                                </td>
                                <td className="text-right px-4 py-3.5 text-slate-300">
                                    {hasPrice ? fmt(h.currentPrice) : <Dash/>}
                                </td>
                                <td className="text-right px-4 py-3.5 text-white font-medium">
                                    {hasPrice ? fmt(h.currentValue) : <Dash/>}
                                </td>
                                <td className={"text-right px-4 py-3.5 font-medium " + plColor}>
                                    {hasPrice ? fmt(h.unrealizedPL) : <Dash/>}
                                </td>
                                <td className={"text-right px-4 py-3.5 font-medium " + plColor}>
                                    {hasPrice ? `${isPos ? "+" : ""}${plPct.toFixed(2)}%` : <Dash/>}
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="flex gap-1.5 justify-end">
                                        {["BUY", "SELL"].map(t => (
                                            <button key={t} onClick={() => onTransact(h.stock)}
                                                    className={"text-xs px-2.5 py-1 rounded-lg " +
                                                    "transition-colors font-medium " +
                                                    (t === "BUY"
                                                        ? "bg-green-800/50 text-green-400 hover:bg-green-700/50"
                                                        : "bg-red-800/50 text-red-400 hover:bg-red-700/50")}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── MF Holdings table ────────────────────────────────────────────────────────

function MfHoldingsTable({mfHoldings, onOpenPanel}) {
    if (mfHoldings.length === 0) {
        return (
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 p-12 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-white font-semibold">No MF holdings yet</p>
            </div>
        );
    }
    return (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Scheme</th>
                    <th className="text-right px-4 py-3">Units</th>
                    <th className="text-right px-4 py-3">Avg NAV</th>
                    <th className="text-right px-4 py-3">Current NAV</th>
                    <th className="text-right px-4 py-3">Invested</th>
                    <th className="text-right px-4 py-3">Value</th>
                    <th className="text-right px-4 py-3">P&amp;L</th>
                    <th className="text-right px-4 py-3">P&amp;L %</th>
                </tr>
                </thead>
                <tbody>
                {mfHoldings.map(h => {
                    const pl    = parseFloat(h.unrealizedPnl || 0);
                    const plPct = parseFloat(h.unrealizedPnlPercent || 0);
                    const isPos = pl >= 0;
                    const color = isPos ? "text-green-400" : "text-red-400";
                    return (
                        <tr key={h.id}
                            className="border-b border-slate-700/40 last:border-0
                                       hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3.5 max-w-xs">
                                <button
                                    onClick={() => onOpenPanel({
                                        schemeCode: h.schemeCode, schemeName: h.schemeName,
                                        fundHouse: h.fundHouse, nav: h.currentNav,
                                    })}
                                    className="text-left group">
                                    <p className="font-semibold text-white group-hover:text-blue-400
                                                  transition-colors truncate" title={h.schemeName}>
                                        {h.schemeName}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {h.fundHouse}{h.schemeCategory ? " · " + h.schemeCategory : ""}
                                    </p>
                                </button>
                            </td>
                            <td className="text-right px-4 py-3.5 text-white">{fmtUnits(h.units)}</td>
                            <td className="text-right px-4 py-3.5 text-slate-300">{fmt(h.avgCostNav)}</td>
                            <td className="text-right px-4 py-3.5 text-slate-300">{fmt(h.currentNav)}</td>
                            <td className="text-right px-4 py-3.5 text-slate-300">{fmt(h.totalInvested)}</td>
                            <td className="text-right px-4 py-3.5 text-white font-medium">{fmt(h.currentValue)}</td>
                            <td className={"text-right px-4 py-3.5 font-medium " + color}>{fmt(h.unrealizedPnl)}</td>
                            <td className={"text-right px-4 py-3.5 font-medium " + color}>
                                {isPos ? "+" : ""}{plPct.toFixed(2)}%
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Combined table ───────────────────────────────────────────────────────────

function CombinedHoldingsTable({holdings, mfHoldings, onStockClick, onOpenMfPanel}) {
    const rows = [
        ...holdings.map(h => ({
            type: "STOCK", name: h.stock.symbol, subName: h.stock.name,
            invested: parseFloat(h.totalInvested || 0),
            value:    parseFloat(h.currentValue || 0),
            pl:       parseFloat(h.unrealizedPL || 0),
            plPct:    parseFloat(h.unrealizedPLPercent || 0),
            hasPrice: h.currentPrice != null, raw: h,
        })),
        ...mfHoldings.map(h => ({
            type: "MF", name: h.schemeName, subName: h.fundHouse,
            invested: parseFloat(h.totalInvested || 0),
            value:    parseFloat(h.currentValue || 0),
            pl:       parseFloat(h.unrealizedPnl || 0),
            plPct:    parseFloat(h.unrealizedPnlPercent || 0),
            hasPrice: true, raw: h,
        })),
    ].sort((a, b) => b.value - a.value);

    const inv   = rows.reduce((s, r) => s + r.invested, 0);
    const val   = rows.reduce((s, r) => s + r.value, 0);
    const pl    = val - inv;
    const plPct = inv > 0 ? ((pl / inv) * 100).toFixed(2) : "0.00";
    const isPos = pl >= 0;

    if (rows.length === 0) {
        return (
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 p-12 text-center">
                <p className="text-4xl mb-3">⊞</p>
                <p className="text-white font-semibold">No holdings yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    ["Total Invested", fmt(inv),  "text-white",                                        null],
                    ["Current Value",  fmt(val),  "text-white",                                        null],
                    ["Total P&L",      fmt(pl),   isPos ? "text-green-400" : "text-red-400",
                        (isPos ? "+" : "") + plPct + "%"],
                    ["Holdings",
                        rows.filter(r => r.type === "STOCK").length + " stocks · " +
                        rows.filter(r => r.type === "MF").length + " MF",
                        "text-white", null],
                ].map(([l, v, cls, sub]) => (
                    <div key={l} className="bg-slate-800 rounded-xl p-4 border border-slate-700/60">
                        <p className="text-xs text-slate-500">{l}</p>
                        <p className={"text-base font-bold mt-1 " + cls}>{v}</p>
                        {sub && <p className={"text-xs font-medium mt-0.5 " + cls}>{sub}</p>}
                    </div>
                ))}
            </div>
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                        <th className="text-left px-4 py-3">Type</th>
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-right px-4 py-3">Invested</th>
                        <th className="text-right px-4 py-3">Value</th>
                        <th className="text-right px-4 py-3">P&amp;L</th>
                        <th className="text-right px-4 py-3">P&amp;L %</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((row, idx) => {
                        const rowIsPos = row.pl >= 0;
                        const plColor  = row.hasPrice
                            ? (rowIsPos ? "text-green-400" : "text-red-400")
                            : "text-slate-600";
                        return (
                            <tr key={idx}
                                className="border-b border-slate-700/40 last:border-0
                                           hover:bg-slate-700/30 transition-colors">
                                <td className="px-4 py-3.5">
                                    <span className={"text-xs px-2 py-1 rounded-lg font-medium " +
                                    (row.type === "STOCK"
                                        ? "bg-blue-900/30 text-blue-400"
                                        : "bg-purple-900/30 text-purple-400")}>
                                        {row.type === "STOCK" ? "📈 Stock" : "📊 MF"}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 max-w-xs">
                                    <button
                                        onClick={() => row.type === "STOCK"
                                            ? onStockClick(row.raw.stock)
                                            : onOpenMfPanel({
                                                schemeCode: row.raw.schemeCode,
                                                schemeName: row.raw.schemeName,
                                                fundHouse:  row.raw.fundHouse,
                                                nav:        row.raw.currentNav,
                                            })}
                                        className="text-left group">
                                        <p className="font-semibold text-white group-hover:text-blue-400
                                                      transition-colors text-sm truncate"
                                           title={row.name}>{row.name}</p>
                                        <p className="text-xs text-slate-400">{row.subName}</p>
                                    </button>
                                </td>
                                <td className="text-right px-4 py-3.5 text-slate-300">{fmt(row.invested)}</td>
                                <td className="text-right px-4 py-3.5 text-white font-medium">
                                    {row.hasPrice ? fmt(row.value) : <Dash/>}
                                </td>
                                <td className={"text-right px-4 py-3.5 font-medium " + plColor}>
                                    {row.hasPrice ? fmt(row.pl) : <Dash/>}
                                </td>
                                <td className={"text-right px-4 py-3.5 font-medium " + plColor}>
                                    {row.hasPrice
                                        ? `${rowIsPos ? "+" : ""}${row.plPct.toFixed(2)}%`
                                        : <Dash/>}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}