// src/pages/AdminClientViewPage.jsx
// "View As Client" — Creator sees exactly what a specific client sees.
// Read-only. A sticky amber banner identifies preview mode.
// Uses the same UI components as the client-facing pages, fed with admin API data.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAdminClients, getClientHoldings, getClientPortfolioHistory } from "../api/admin";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer
} from "recharts";

const fmt = (v) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(v || 0);

const fmtCrore = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n/1e5).toFixed(2)}L`;
    return `₹${n.toFixed(0)}`;
};

const RANGES = ["1d","5d","1w","1m","3m","6m","1y","all"];

export default function AdminClientViewPage() {
    const { clientId } = useParams();
    const navigate     = useNavigate();

    const [client,   setClient]   = useState(null);
    const [holdings, setHoldings] = useState([]);
    const [history,  setHistory]  = useState(null);
    const [range,    setRange]    = useState("3m");
    const [loading,  setLoading]  = useState(true);
    const [chartBusy,setChartBusy]= useState(false);

    useEffect(() => {
        Promise.all([
            getAdminClients(),
            getClientHoldings(clientId),
            getClientPortfolioHistory(clientId, range),
        ]).then(([clients, h, hist]) => {
            setClient(clients.find(c => String(c.id) === String(clientId)) || null);
            setHoldings(h);
            setHistory(hist);
        }).finally(() => setLoading(false));
    }, [clientId]);

    useEffect(() => {
        if (loading) return;
        setChartBusy(true);
        getClientPortfolioHistory(clientId, range)
            .then(setHistory)
            .finally(() => setChartBusy(false));
    }, [range]);

    if (loading) return (
        <div className="space-y-4">
            <div className="h-12 bg-amber-900/20 rounded-xl animate-pulse" />
            <div className="h-48 bg-slate-800 rounded-2xl animate-pulse" />
        </div>
    );
    if (!client) return (
        <div className="text-center py-16">
            <p className="text-slate-400">Client not found</p>
            <button onClick={() => navigate("/admin/clients")}
                    className="mt-4 text-amber-400 hover:underline text-sm">← Back</button>
        </div>
    );

    // Stats
    const liveValue    = holdings.reduce((s, h) =>
        s + (h.currentPrice != null ? parseFloat(h.currentPrice)*parseFloat(h.quantity||0) : 0), 0);
    const totalInvested = holdings.reduce((s, h) => s + parseFloat(h.totalInvested||0), 0);
    const pnl           = liveValue - totalInvested;
    const pnlPct        = totalInvested > 0 ? (pnl/totalInvested*100) : 0;
    const isUp          = pnl >= 0;

    // Chart
    const dates     = history?.dates  || [];
    const values    = history?.values || [];
    const invested  = parseFloat(history?.totalInvested || 0);
    const chartData = dates.map((d, i) => ({
        date: d, value: Math.round(parseFloat(values[i]||0))
    })).filter(p => p.value > 0);
    if (chartData.length > 0 && liveValue > 0)
        chartData.push({ date: "Today", value: Math.round(liveValue) });

    const lineColor = isUp ? "#3b82f6" : "#ef4444";

    return (
        <div className="space-y-4">

            {/* ── Sticky Preview Banner ── */}
            <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl
                            px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">👁</span>
                    <div>
                        <p className="text-amber-400 font-bold text-sm">
                            Preview Mode — Viewing {client.fullName || client.username}'s account
                        </p>
                        <p className="text-amber-600 text-xs mt-0.5">
                            Read-only · {client.email} · Joined {new Date(client.joinedAt).toLocaleDateString("en-IN")}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate(`/admin/clients/${clientId}`)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300
                                       text-xs font-semibold rounded-xl transition-colors">
                        Full Admin View
                    </button>
                    <button onClick={() => navigate("/admin/clients")}
                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30
                                       text-amber-400 text-xs font-semibold rounded-xl
                                       transition-colors border border-amber-500/30">
                        ✕ Exit Preview
                    </button>
                </div>
            </div>

            {/* ── Portfolio summary (client's view) ── */}
            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                <div className="flex divide-x divide-slate-700/60">
                    {[
                        ["Current Value",  fmtCrore(liveValue),    "text-white"],
                        ["Total Invested", fmtCrore(totalInvested), "text-slate-300"],
                        ["Total P&L",      (isUp?"+":"")+fmtCrore(pnl),
                            isUp?"text-green-400":"text-red-400"],
                    ].map(([l, v, c]) => (
                        <div key={l} className="flex-1 px-6 py-4">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{l}</p>
                            <p className={"text-2xl font-bold mt-1 " + c}>{v}</p>
                            {l === "Total P&L" && (
                                <p className={"text-sm font-bold mt-0.5 " + c}>
                                    ({isUp?"+":""}{pnlPct.toFixed(2)}%)
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Chart */}
                <div className="border-t border-slate-700/60">
                    <div className="flex items-center justify-between px-5 py-3">
                        <p className="text-slate-400 text-xs">Portfolio history</p>
                        <div className="flex gap-0.5">
                            {RANGES.map(r => (
                                <button key={r} onClick={() => setRange(r)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all
                                                   ${range===r ? "bg-blue-600 text-white"
                                            : "text-slate-500 hover:text-white hover:bg-slate-700/60"}`}>
                                    {r.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="px-3 pb-3">
                        {chartBusy ? (
                            <div className="h-32 flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : chartData.length >= 2 ? (
                            <ResponsiveContainer width="100%" height={140}>
                                <AreaChart data={chartData} margin={{top:4,right:8,bottom:0,left:4}}>
                                    <defs>
                                        <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor={lineColor} stopOpacity={0.3}/>
                                            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" tick={{fill:"#475569",fontSize:10}}
                                           tickLine={false} axisLine={false} interval="preserveStartEnd" dy={4}/>
                                    <YAxis tickFormatter={v=>v>=1e5?`${(v/1e5).toFixed(1)}L`:`${(v/1000).toFixed(0)}K`}
                                           tick={{fill:"#475569",fontSize:10}} tickLine={false} axisLine={false} width={44}/>
                                    <Tooltip contentStyle={{backgroundColor:"#1e293b",border:"1px solid #334155",borderRadius:"10px",fontSize:12}}
                                             formatter={v=>[fmt(v),"Portfolio"]}/>
                                    {invested>0 && <ReferenceLine y={invested} stroke="#475569" strokeDasharray="5 4" strokeWidth={1.5}/>}
                                    <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2}
                                          fill="url(#pvGrad)" dot={false} isAnimationActive={false}/>
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-24 flex items-center justify-center">
                                <p className="text-slate-600 text-xs">Chart unavailable</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Holdings table (read-only) ── */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
                    <p className="text-white font-semibold">
                        Stock Holdings ({holdings.length})
                    </p>
                    <span className="text-xs text-amber-600 bg-amber-900/20 px-2 py-0.5 rounded-lg">
                        Read Only
                    </span>
                </div>
                {holdings.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">No holdings</p>
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
                            const pl       = parseFloat(h.unrealizedPL||0);
                            const isPos    = pl >= 0;
                            const clr      = hasPrice ? (isPos?"text-green-400":"text-red-400") : "text-slate-600";
                            return (
                                <tr key={h.id} className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20">
                                    <td className="px-5 py-3">
                                        <p className="text-white font-bold">{h.stock.symbol}</p>
                                        <p className="text-xs text-slate-500 truncate max-w-[140px]">{h.stock.name}</p>
                                    </td>
                                    <td className="text-right px-4 py-3 text-white">{parseFloat(h.quantity||0).toFixed(2)}</td>
                                    <td className="text-right px-4 py-3 text-slate-300">{fmt(h.averageBuyPrice)}</td>
                                    <td className="text-right px-4 py-3 text-slate-300">{hasPrice?fmt(h.currentPrice):"—"}</td>
                                    <td className="text-right px-4 py-3 text-white">{hasPrice?fmt(h.currentValue):"—"}</td>
                                    <td className={"text-right px-4 py-3 font-medium "+clr}>{hasPrice?fmt(h.unrealizedPL):"—"}</td>
                                    <td className={"text-right px-4 py-3 font-medium "+clr}>
                                        {hasPrice?`${isPos?"+":""}${parseFloat(h.unrealizedPLPercent||0).toFixed(2)}%`:"—"}
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