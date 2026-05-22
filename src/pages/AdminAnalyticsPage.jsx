import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPlatformAnalytics, getStockHolders } from "../api/admin";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    Cell, PieChart, Pie,
} from "recharts";

const fmt = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 0 }).format(v || 0);

const fmtCrore = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
    if (n >= 1e3) return `₹${(n/1e3).toFixed(0)}K`;
    return `₹${n.toFixed(0)}`;
};

const SECTOR_COLORS = [
    "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
    "#06b6d4","#ec4899","#84cc16","#f97316","#64748b",
];

export default function AdminAnalyticsPage() {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [holdersModal, setHoldersModal] = useState(null); // { symbol, holders }
    const [holdersLoading, setHoldersLoading] = useState(false);

    const openHolders = async (stock) => {
        setHoldersModal({ symbol: stock.symbol, name: stock.name, holders: null });
        setHoldersLoading(true);
        try {
            const holders = await getStockHolders(stock.symbol);
            setHoldersModal({ symbol: stock.symbol, name: stock.name, holders });
        } finally {
            setHoldersLoading(false);
        }
    };

    useEffect(() => {
        getPlatformAnalytics().then(setData).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                {[1,2,3].map(i => (
                    <div key={i} className="h-48 bg-slate-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }
    if (!data) return null;

    const mostHeld    = data.mostHeldStocks      || [];
    const sectors     = data.sectorDistribution  || [];
    const flow        = data.capitalFlow          || [];

    // Last 14 days for capital flow chart (most readable)
    const flowChart = flow.slice(-14).map(f => ({
        date:    f.date?.slice(5) || f.date,    // "MM-DD"
        buy:     Math.round(parseFloat(f.buyAmount  || 0)),
        sell:    Math.round(parseFloat(f.sellAmount || 0)),
        net:     Math.round(parseFloat(f.netFlow    || 0)),
    }));

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
                            <span className="text-xs bg-amber-500/20 text-amber-400 border
                                         border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Cross-portfolio insights across all clients
                        </p>
                    </div>
                    <button onClick={() => navigate("/admin")}
                            className="text-sm text-slate-400 hover:text-white hover:underline">
                        ← Dashboard
                    </button>
                </div>

                {/* Volume badges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        ["Bought (7d)",  data.weeklyBuyVolume,   "text-green-400", "📈"],
                        ["Sold (7d)",    data.weeklySellVolume,  "text-red-400",   "📉"],
                        ["Bought (30d)", data.monthlyBuyVolume,  "text-green-400", "📊"],
                        ["Sold (30d)",   data.monthlySellVolume, "text-red-400",   "📋"],
                    ].map(([l, v, c, icon]) => (
                        <div key={l} className="bg-slate-800 border border-slate-700/60 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-slate-500 uppercase tracking-wide">{l}</p>
                                <span className="text-lg">{icon}</span>
                            </div>
                            <p className={"text-xl font-bold " + c}>{fmtCrore(v)}</p>
                        </div>
                    ))}
                </div>

                {/* ── Two columns ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Most held stocks */}
                    <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/60">
                            <p className="text-white font-semibold">Most Held Stocks</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Ranked by number of clients holding
                            </p>
                        </div>
                        <div className="divide-y divide-slate-700/40">
                            {mostHeld.length === 0 ? (
                                <p className="text-center text-slate-500 text-sm py-8">No holdings data</p>
                            ) : mostHeld.slice(0, 8).map((s, i) => {
                                const chg = parseFloat(s.changePercent || 0);
                                const up  = chg >= 0;
                                return (
                                    <button key={s.symbol}
                                            onClick={() => openHolders(s)}
                                            className="w-full flex items-center gap-3 px-5 py-3
                                                hover:bg-slate-700/20 transition-colors text-left
                                                cursor-pointer">
                                        <span className="text-slate-600 text-sm font-bold w-5">{i+1}</span>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-bold text-sm">{s.symbol}</p>
                                                {s.sector && (
                                                    <span className="text-xs bg-slate-700 text-slate-400
                                                                 px-1.5 py-0.5 rounded">
                                                    {s.sector}
                                                </span>
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-xs truncate">{s.name}</p>
                                        </div>

                                        <div className="text-center flex-shrink-0">
                                            <p className="text-blue-400 font-bold text-sm">
                                                {s.holderCount}
                                            </p>
                                            <p className="text-slate-600 text-xs">clients</p>
                                        </div>

                                        <div className="text-right flex-shrink-0">
                                            <p className="text-white text-sm font-medium">
                                                {fmtCrore(s.totalValueAcrossClients)}
                                            </p>
                                            {s.currentPrice && (
                                                <p className={"text-xs font-semibold " +
                                                (up ? "text-green-400" : "text-red-400")}>
                                                    {up?"+":""}{chg.toFixed(2)}%
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sector distribution */}
                    <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/60">
                            <p className="text-white font-semibold">Sector Distribution</p>
                            <p className="text-xs text-slate-500 mt-0.5">Platform AUM by sector</p>
                        </div>

                        {sectors.length === 0 ? (
                            <p className="text-center text-slate-500 text-sm py-8">No sector data</p>
                        ) : (
                            <div className="p-4">
                                {/* Mini donut */}
                                <div className="flex justify-center mb-4">
                                    <PieChart width={220} height={220}>
                                        <Pie data={sectors.slice(0, 8)}
                                             dataKey="totalValue"
                                             nameKey="sector"
                                             cx="50%" cy="50%"
                                             innerRadius={60} outerRadius={100}
                                             paddingAngle={2}
                                             isAnimationActive={false}>
                                            {sectors.slice(0, 8).map((_, i) => (
                                                <Cell key={i}
                                                      fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "#1e293b",
                                                border: "1px solid #334155",
                                                borderRadius: "8px", fontSize: 11,
                                            }}
                                            formatter={(v, n) => [fmtCrore(v), n]}
                                        />
                                    </PieChart>
                                </div>

                                {/* Legend rows */}
                                <div className="space-y-1.5">
                                    {sectors.slice(0, 6).map((s, i) => (
                                        <div key={s.sector}
                                             className="flex items-center gap-2.5">
                                            <div className="w-3 h-3 rounded-sm flex-shrink-0"
                                                 style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                                            <span className="text-slate-300 text-xs flex-1 truncate">
                                            {s.sector}
                                        </span>
                                            <span className="text-slate-500 text-xs">
                                            {parseFloat(s.percentage || 0).toFixed(1)}%
                                        </span>
                                            <span className="text-white text-xs font-medium">
                                            {fmtCrore(s.totalValue)}
                                        </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Capital flow chart ── */}
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700/60">
                        <p className="text-white font-semibold">Capital Flow — Last 14 Days</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            BUY vs SELL amounts across all clients
                        </p>
                    </div>
                    {flowChart.length === 0 ? (
                        <p className="text-center text-slate-500 text-sm py-8">
                            No transaction data for this period
                        </p>
                    ) : (
                        <div className="p-4">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={flowChart}
                                          margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
                                    <XAxis dataKey="date"
                                           tick={{ fill: "#475569", fontSize: 10 }}
                                           tickLine={false} axisLine={false} />
                                    <YAxis tickFormatter={v =>
                                        v >= 1e5 ? `${(v/1e5).toFixed(0)}L`
                                            : `${(v/1000).toFixed(0)}K`}
                                           tick={{ fill: "#475569", fontSize: 10 }}
                                           tickLine={false} axisLine={false} width={44} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#1e293b", border: "1px solid #334155",
                                            borderRadius: "10px", fontSize: 12,
                                        }}
                                        formatter={(v, name) => [fmt(v),
                                            name === "buy" ? "Buy" : "Sell"]}
                                    />
                                    <Legend
                                        formatter={v => v === "buy" ? "BUY" : "SELL"}
                                        wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                                    <Bar dataKey="buy"  fill="#22c55e" radius={[3,3,0,0]}
                                         maxBarSize={24} name="buy" />
                                    <Bar dataKey="sell" fill="#ef4444" radius={[3,3,0,0]}
                                         maxBarSize={24} name="sell" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Stock Holders Modal ── */}
            {holdersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                            <div>
                                <p className="text-white font-bold">
                                    {holdersModal.symbol} — Who holds this?
                                </p>
                                <p className="text-slate-500 text-xs mt-0.5">{holdersModal.name}</p>
                            </div>
                            <button onClick={() => setHoldersModal(null)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl">✕</button>
                        </div>
                        {holdersLoading || !holdersModal.holders ? (
                            <div className="h-32 flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : holdersModal.holders.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">No clients hold this stock</p>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-700 bg-slate-800/50">
                                        <th className="text-left px-5 py-2.5">Client</th>
                                        <th className="text-right px-4 py-2.5">Qty</th>
                                        <th className="text-right px-4 py-2.5">Avg Buy</th>
                                        <th className="text-right px-4 py-2.5">Value</th>
                                        <th className="text-right px-5 py-2.5">P&L %</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {holdersModal.holders.map(h => {
                                        const isPos = (h.unrealizedPLPercent||0) >= 0;
                                        return (
                                            <tr key={h.userId} className="border-b border-slate-700/40 last:border-0 hover:bg-slate-800">
                                                <td className="px-5 py-3">
                                                    <p className="text-white font-semibold text-sm">{h.fullName || h.username}</p>
                                                    <p className="text-slate-500 text-xs">@{h.username}</p>
                                                </td>
                                                <td className="text-right px-4 py-3 text-white">{parseFloat(h.quantity||0).toFixed(2)}</td>
                                                <td className="text-right px-4 py-3 text-slate-300">
                                                    ₹{parseFloat(h.averageBuyPrice||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
                                                </td>
                                                <td className="text-right px-4 py-3 text-white font-medium">
                                                    {h.currentValue ? `₹${parseFloat(h.currentValue).toLocaleString("en-IN",{maximumFractionDigits:0})}` : "—"}
                                                </td>
                                                <td className={"text-right px-5 py-3 font-semibold " +
                                                (h.unrealizedPLPercent==null ? "text-slate-600"
                                                    : isPos ? "text-green-400" : "text-red-400")}>
                                                    {h.unrealizedPLPercent==null ? "—"
                                                        : `${isPos?"+":""}${parseFloat(h.unrealizedPLPercent).toFixed(2)}%`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}