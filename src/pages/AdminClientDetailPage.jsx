import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAdminClients, getClientHoldings, getClientPortfolioHistory } from "../api/admin";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer
} from "recharts";

const fmt = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 2 }).format(v || 0);

const fmtCrore = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n/1e5).toFixed(2)}L`;
    return `₹${n.toFixed(0)}`;
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        return `${day}/${m}/${y}`;
    } catch { return "—"; }
};

const HEALTH = {
    HEALTHY:  { badge: "bg-green-900/30 text-green-400",  label: "Healthy"  },
    WARNING:  { badge: "bg-amber-900/30 text-amber-400",  label: "Warning"  },
    ALERT:    { badge: "bg-red-900/30 text-red-400",      label: "Alert"    },
    CRITICAL: { badge: "bg-red-900/40 text-red-400",      label: "Critical" },
};

const RANGES = ["1d","5d","1w","1m","3m","6m","1y","all"];

export default function AdminClientDetailPage() {
    const { clientId } = useParams();
    const navigate     = useNavigate();

    const [client,    setClient]    = useState(null);
    const [holdings,  setHoldings]  = useState([]);
    const [history,   setHistory]   = useState({ dates: [], values: [], totalInvested: 0 });
    const [range,     setRange]     = useState("3m");
    const [loading,   setLoading]   = useState(true);
    const [chartLoad, setChartLoad] = useState(false);

    useEffect(() => {
        setLoading(true);
        // allSettled, not all: for an ADMIN client the holdings/history calls may
        // be refused by the backend. With Promise.all one rejection sinks the whole
        // page → "Client not found". allSettled lets the profile still render from
        // the clients list, degrading holdings/history to empty on failure.
        Promise.allSettled([
            getAdminClients(),
            getClientHoldings(clientId),
            getClientPortfolioHistory(clientId, range),
        ]).then(([clientsR, hR, histR]) => {
            const clients = clientsR.status === "fulfilled" ? clientsR.value : [];
            const found = clients.find(c => String(c.id) === String(clientId));
            setClient(found || null);
            setHoldings(hR.status === "fulfilled" && Array.isArray(hR.value) ? hR.value : []);
            setHistory(histR.status === "fulfilled" && histR.value
                ? histR.value
                : { dates: [], values: [], totalInvested: 0 });
        }).finally(() => setLoading(false));
    }, [clientId]);

    useEffect(() => {
        if (loading) return;
        setChartLoad(true);
        getClientPortfolioHistory(clientId, range)
            .then(setHistory)
            .catch(() => setHistory({ dates: [], values: [], totalInvested: 0 }))
            .finally(() => setChartLoad(false));
    }, [range]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-8 w-64 bg-slate-800 rounded-xl animate-pulse" />
                <div className="h-40 bg-slate-800 rounded-2xl animate-pulse" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="text-center py-16">
                <p className="text-slate-400">Client not found</p>
                <button onClick={() => navigate("/admin/clients")}
                        className="mt-4 text-blue-400 hover:underline text-sm">
                    ← Back to Clients
                </button>
            </div>
        );
    }

    const plPct = parseFloat(client.unrealizedPLPercent || 0);
    const isPos = plPct >= 0;
    const hc    = HEALTH[client.healthLevel] || HEALTH.HEALTHY;

    // Build chart data
    const dates   = history?.dates  || [];
    const values  = history?.values || [];
    const invested = parseFloat(history?.totalInvested || 0);
    const chartData = dates.map((d, i) => ({
        date:  d.includes("T") ? d : d,
        value: Math.round(parseFloat(values[i] || 0)),
    })).filter(p => p.value > 0);

    const liveValue = holdings.reduce((s, h) =>
        s + (h.currentPrice != null
            ? parseFloat(h.currentPrice) * parseFloat(h.quantity || 0) : 0), 0);

    if (chartData.length > 0 && liveValue > 0) {
        chartData.push({ date: "Today", value: Math.round(liveValue) });
    }

    const hasChart  = chartData.length >= 2;
    const lineColor = isPos ? "#3b82f6" : "#ef4444";

    return (
        <div className="space-y-5">
            {/* -- Header -- */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/admin/clients")}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700
                                       rounded-xl transition-colors">
                        ←
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-white">
                                {client.fullName || client.username}
                            </h1>
                            <span className={"text-xs font-semibold px-2 py-0.5 rounded-full " +
                            hc.badge}>
                                {hc.label}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {client.email} · Joined {fmtDate(client.joinedAt)} ·{" "}
                            {client.totalTransactions} transactions
                        </p>
                    </div>
                </div>
                <span className="text-xs bg-amber-500/20 text-amber-400 border
                                 border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                    ADMIN VIEW — READ ONLY
                </span>
            </div>

            {/* -- Client stats -- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    ["Portfolio Value", fmtCrore(client.portfolioValue), "text-white"],
                    ["Total Invested",  fmtCrore(client.totalInvested),  "text-slate-300"],
                    ["Unrealized P&L",
                        (isPos?"+":"") + fmtCrore(client.unrealizedPL),
                        isPos ? "text-green-400" : "text-red-400"],
                    ["P&L %",
                        client.unrealizedPLPercent != null
                            ? (isPos?"+":"") + plPct.toFixed(2) + "%"
                            : "—",
                        isPos ? "text-green-400" : "text-red-400"],
                ].map(([l, v, c]) => (
                    <div key={l} className="bg-slate-800 border border-slate-700/60 rounded-xl p-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            {l}
                        </p>
                        <p className={"text-xl font-bold mt-1 " + c}>{v}</p>
                    </div>
                ))}
            </div>

            {/* -- Portfolio chart -- */}
            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3
                                border-b border-slate-700/60">
                    <p className="text-white font-semibold text-sm">Portfolio Value Chart</p>
                    <div className="flex gap-0.5">
                        {RANGES.map(r => (
                            <button key={r} onClick={() => setRange(r)}
                                    className={[
                                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                                        range === r
                                            ? "bg-blue-600 text-white"
                                            : "text-slate-500 hover:text-white hover:bg-slate-700/60",
                                    ].join(" ")}>
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-3">
                    {chartLoad ? (
                        <div className="h-36 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-blue-500
                                            border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : hasChart ? (
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={chartData}
                                       margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
                                <defs>
                                    <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fill:"#475569", fontSize:10 }}
                                       tickLine={false} axisLine={false}
                                       interval="preserveStartEnd" dy={4} />
                                <YAxis tick={{ fill:"#475569", fontSize:10 }}
                                       tickFormatter={v =>
                                           v >= 1e5 ? `${(v/1e5).toFixed(1)}L`
                                               : `${(v/1000).toFixed(0)}K`}
                                       tickLine={false} axisLine={false} width={46} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor:"#1e293b", border:"1px solid #334155",
                                        borderRadius:"10px", color:"#fff", fontSize:12,
                                    }}
                                    formatter={v => [fmt(v), "Portfolio"]}
                                    labelStyle={{ color:"#94a3b8" }}
                                />
                                {invested > 0 && (
                                    <ReferenceLine y={invested} stroke="#475569"
                                                   strokeDasharray="5 4" strokeWidth={1.5} />
                                )}
                                <Area type="monotone" dataKey="value"
                                      stroke={lineColor} strokeWidth={2}
                                      fill="url(#cGrad)" dot={false}
                                      isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-28 flex items-center justify-center">
                            <p className="text-slate-600 text-xs">
                                Chart unavailable for {range.toUpperCase()} range
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* -- Holdings table -- */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/60">
                    <p className="text-white font-semibold">
                        Stock Holdings ({holdings.length})
                    </p>
                </div>
                {holdings.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">
                        No stock holdings
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                            <th className="text-left px-5 py-3">Stock</th>
                            <th className="text-right px-4 py-3">Qty</th>
                            <th className="text-right px-4 py-3">Avg Buy</th>
                            <th className="text-right px-4 py-3">Current</th>
                            <th className="text-right px-4 py-3">Value</th>
                            <th className="text-right px-4 py-3">P&L</th>
                            <th className="text-right px-4 py-3">P&L %</th>
                        </tr>
                        </thead>
                        <tbody>
                        {holdings.map(h => {
                            const hasPrice = h.currentPrice != null;
                            const pl       = parseFloat(h.unrealizedPL || 0);
                            const plPctH   = parseFloat(h.unrealizedPLPercent || 0);
                            const pos      = pl >= 0;
                            const clr      = hasPrice
                                ? (pos ? "text-green-400" : "text-red-400")
                                : "text-slate-600";
                            return (
                                <tr key={h.id}
                                    className="border-b border-slate-700/40 last:border-0
                                               hover:bg-slate-700/20">
                                    <td className="px-5 py-3">
                                        <p className="text-white font-bold">{h.stock.symbol}</p>
                                        <p className="text-xs text-slate-500 truncate max-w-[140px]">
                                            {h.stock.name}
                                        </p>
                                    </td>
                                    <td className="text-right px-4 py-3 text-white">
                                        {parseFloat(h.quantity||0).toFixed(2)}
                                    </td>
                                    <td className="text-right px-4 py-3 text-slate-300">
                                        {fmt(h.averageBuyPrice)}
                                    </td>
                                    <td className="text-right px-4 py-3 text-slate-300">
                                        {hasPrice ? fmt(h.currentPrice) : "—"}
                                    </td>
                                    <td className="text-right px-4 py-3 text-white font-medium">
                                        {hasPrice ? fmt(h.currentValue) : "—"}
                                    </td>
                                    <td className={"text-right px-4 py-3 font-medium " + clr}>
                                        {hasPrice ? fmt(h.unrealizedPL) : "—"}
                                    </td>
                                    <td className={"text-right px-4 py-3 font-medium " + clr}>
                                        {hasPrice ? `${pos?"+":""}${plPctH.toFixed(2)}%` : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}