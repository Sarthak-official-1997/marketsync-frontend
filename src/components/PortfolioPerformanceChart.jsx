// ─── REPLACE the PortfolioPerformanceCard function in HoldingsPage.jsx ────────
//
// Drop-in replacement. All other code in HoldingsPage.jsx stays the same.
// Also add this import at the top of HoldingsPage.jsx (if not already there):
//   import { getPortfolioHistory } from "../api/portfolio";
//
// Remove this import (no longer needed):
//   import { getStockChart } from "../api/portfolio";

const RANGE_OPTIONS = [
    { id: "1d",  label: "1D"  },
    { id: "5d",  label: "5D"  },
    { id: "1w",  label: "1W"  },
    { id: "1m",  label: "1M"  },
    { id: "3m",  label: "3M"  },
    { id: "6m",  label: "6M"  },
    { id: "1y",  label: "1Y"  },
    { id: "all", label: "ALL" },
];

function PortfolioPerformanceCard({ holdings }) {
    const [range,        setRange]        = useState("3m");
    const [chartData,    setChartData]    = useState([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [chartError,   setChartError]   = useState(null);

    // ── Live stats — no API call needed ──────────────────────────────────────
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

    // Re-fetch when range changes or holdings change
    const holdingsKey = holdings.map(h => `${h.stock?.symbol}:${h.quantity}`).join("|");

    useEffect(() => {
        if (!holdings || holdings.length === 0) { setChartLoading(false); return; }

        let cancelled = false;
        setChartLoading(true);
        setChartError(null);
        setChartData([]);

        getPortfolioHistory(range)
            .then(res => {
                if (cancelled) return;

                const dates  = res?.dates  || [];
                const values = res?.values || [];

                if (dates.length === 0) {
                    setChartError("No price history available for this range. Try 1M or 3M.");
                    return;
                }

                // dates from backend are always ISO "YYYY-MM-DD" or "HH:mm" strings
                const points = dates.map((d, i) => ({
                    date:  formatXLabel(d, range),
                    value: Math.round(parseFloat(values[i] || 0)),
                })).filter(p => p.value > 0);

                // For non-intraday ranges: append today's live value as final point
                if (range !== "1d" && points.length > 0 && liveValue > 0) {
                    const last = points[points.length - 1];
                    if (last.date !== "Today") {
                        points.push({ date: "Today", value: Math.round(liveValue) });
                    }
                }

                setChartData(points);
                if (points.length === 0) {
                    setChartError("Chart empty after processing. Check server logs.");
                }
            })
            .catch(e => {
                if (!cancelled) setChartError("Failed to load chart data: " + (e.message || "unknown error"));
            })
            .finally(() => { if (!cancelled) setChartLoading(false); });

        return () => { cancelled = true; };
    }, [range, holdingsKey]);

    // ── X-axis label formatter ────────────────────────────────────────────────
    function formatXLabel(d, r) {
        if (r === "1d") return d;   // already "HH:mm"
        // ISO date "2025-04-17" → "17 Apr"
        try {
            const [, m, day] = d.split("-");
            const mo = ["Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"];
            return `${parseInt(day)} ${mo[parseInt(m,10)-1]}`;
        } catch { return d; }
    }

    // ── Y-axis domain — anchored, not over-zoomed ─────────────────────────────
    const domain = useMemo(() => {
        if (chartData.length < 2) return ["auto", "auto"];
        const vals = chartData.map(d => d.value);
        const all  = [...vals, totalInvested, liveValue].filter(v => v > 0);
        const minV = Math.min(...all);
        const maxV = Math.max(...all);
        const pad  = Math.max((maxV - minV) * 0.15, maxV * 0.02);
        return [Math.round(minV - pad), Math.round(maxV + pad)];
    }, [chartData, totalInvested, liveValue]);

    const hasChart  = chartData.length >= 2;
    const lineColor = isUp ? "#3b82f6" : "#ef4444";

    // ── Period change (first → last point in chart data) ─────────────────────
    const periodDelta = hasChart
        ? chartData[chartData.length - 1].value - chartData[0].value : 0;
    const periodUp = periodDelta >= 0;

    return (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">

            {/* ── Stats ── */}
            <div className="grid grid-cols-3 divide-x divide-slate-700/60">
                <div className="px-6 py-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Current Value
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">{fmtCrore(liveValue)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(liveValue)}</p>
                </div>
                <div className="px-6 py-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Total Invested
                    </p>
                    <p className="text-2xl font-bold text-slate-300 mt-1">{fmtCrore(totalInvested)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(totalInvested)}</p>
                </div>
                <div className="px-6 py-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Total P&L
                    </p>
                    <p className={"text-2xl font-bold mt-1 " + (isUp ? "text-green-400" : "text-red-400")}>
                        {isUp ? "+" : ""}{fmtCrore(livePL)}
                    </p>
                    <p className={"text-xs mt-0.5 font-medium " + (isUp ? "text-green-500" : "text-red-500")}>
                        {isUp ? "+" : ""}{livePLPct.toFixed(2)}% overall
                    </p>
                </div>
            </div>

            {/* ── Range selector ── */}
            <div className="flex items-center justify-between px-5 py-2.5
                            border-t border-b border-slate-700/50 bg-slate-900/20">
                <div className="flex gap-0.5">
                    {RANGE_OPTIONS.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setRange(r.id)}
                            className={[
                                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                range === r.id
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-slate-500 hover:text-white hover:bg-slate-700/60",
                            ].join(" ")}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Period return badge */}
                {hasChart && (
                    <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " +
                    (periodUp
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400")}>
                        {periodUp ? "+" : ""}{fmt(periodDelta)}
                    </span>
                )}
            </div>

            {/* ── Chart area ── */}
            <div className="border-t border-slate-700/40">
                {chartLoading ? (
                    <div className="h-36 flex items-center justify-center gap-2.5">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent
                                        rounded-full animate-spin" />
                        <p className="text-slate-600 text-xs">
                            Loading {range.toUpperCase()} chart…
                        </p>
                    </div>

                ) : hasChart ? (
                    <div className="px-2 pt-3 pb-1">
                        <ResponsiveContainer width="100%" height={170}>
                            <AreaChart data={chartData}
                                       margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
                                <defs>
                                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date"
                                       tick={{ fill: "#475569", fontSize: 10 }}
                                       tickLine={false} axisLine={false}
                                       interval="preserveStartEnd" dy={4} />
                                <YAxis domain={domain}
                                       tick={{ fill: "#475569", fontSize: 10 }}
                                       tickFormatter={v =>
                                           v >= 1e7 ? `${(v/1e7).toFixed(1)}Cr`
                                               : v >= 1e5 ? `${(v/1e5).toFixed(1)}L`
                                                   :            `${(v/1000).toFixed(0)}K`
                                       }
                                       tickLine={false} axisLine={false} width={46} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#1e293b", border: "1px solid #334155",
                                        borderRadius: "10px", color: "#fff", fontSize: 12,
                                    }}
                                    formatter={(v) => [fmt(v), "Portfolio Value"]}
                                    labelStyle={{ color: "#94a3b8", marginBottom: 2 }}
                                />
                                {/* Dashed cost-basis reference line */}
                                {totalInvested > 0 && (
                                    <ReferenceLine y={totalInvested}
                                                   stroke="#475569" strokeDasharray="5 4"
                                                   strokeWidth={1.5}
                                                   label={{
                                                       value: "Cost",
                                                       position: "insideTopRight",
                                                       fill: "#475569", fontSize: 9, dy: -6,
                                                   }} />
                                )}
                                <Area type="monotone" dataKey="value"
                                      stroke={lineColor} strokeWidth={2}
                                      fill="url(#perfGrad)" dot={false}
                                      activeDot={{ r: 4, fill: lineColor,
                                          stroke: "#0f172a", strokeWidth: 2 }}
                                      isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                        <p className="text-right text-xs text-slate-700 pr-2 mt-0.5">
                            Dashed = cost basis
                        </p>
                    </div>

                ) : (
                    // ── Fallback: visual performance bar ─────────────────────
                    <div className="px-6 py-4">
                        <div className="relative h-10 bg-slate-900/60 rounded-xl overflow-hidden mb-3">
                            <div className="absolute inset-0 bg-slate-700/30 rounded-xl" />
                            <div
                                className={
                                    "absolute left-0 top-0 h-full rounded-xl transition-all " +
                                    (isUp
                                        ? "bg-gradient-to-r from-blue-600/70 to-green-500/70"
                                        : "bg-gradient-to-r from-blue-600/70 to-red-500/70")
                                }
                                style={{
                                    width: totalInvested > 0
                                        ? `${Math.min(100,
                                            (liveValue / Math.max(liveValue, totalInvested)) * 100
                                        ).toFixed(1)}%`
                                        : "0%",
                                }}
                            />
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

                        {chartError && (
                            <p className="text-xs text-amber-600 bg-amber-900/20 border
                                          border-amber-500/20 rounded-lg px-3 py-2 mb-2">
                                ⚠ {chartError}
                            </p>
                        )}


                        <p className="text-xs text-slate-600 text-center">
                            Chart data unavailable for {range.toUpperCase()} —
                            check backend logs for "Fetching chart" and "Chart OK" messages.
                            Try a different range.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}