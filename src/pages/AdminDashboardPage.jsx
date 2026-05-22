import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminDashboard, getAdminClients } from "../api/admin";

const fmt = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 2 }).format(v || 0);

const fmtCrore = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n/1e5).toFixed(2)}L`;
    if (n >= 1e3) return `₹${(n/1e3).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
};

function StatCard({ label, value, sub, color = "text-white", icon, trend }) {
    return (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
                {icon && <span className="text-2xl opacity-60">{icon}</span>}
            </div>
            <p className={"text-2xl font-bold " + color}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
            {trend != null && (
                <p className={"text-xs font-semibold mt-1 " +
                (trend >= 0 ? "text-green-400" : "text-red-400")}>
                    {trend >= 0 ? "▲ +" : "▼ "}{parseFloat(trend).toFixed(2)}%
                </p>
            )}
        </div>
    );
}

const HEALTH_CONFIG = {
    HEALTHY:  { color: "bg-green-500",  text: "text-green-400",  label: "Healthy"  },
    WARNING:  { color: "bg-amber-500",  text: "text-amber-400",  label: "Warning"  },
    ALERT:    { color: "bg-red-500",    text: "text-red-400",    label: "Alert"    },
    CRITICAL: { color: "bg-red-600",    text: "text-red-400",    label: "Critical" },
};

export default function AdminDashboardPage() {
    const [data,    setData]    = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([getAdminDashboard(), getAdminClients()])
            .then(([dash, cl]) => { setData(dash); setClients(cl); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-8 bg-slate-800 rounded-xl animate-pulse w-48" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-28 bg-slate-800 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }
    if (!data) return null;

    const plPct = parseFloat(data.platformPLPercent || 0);
    const isUp  = plPct >= 0;

    // Top 5 clients by portfolio value
    const topClients = [...clients]
        .sort((a, b) => parseFloat(b.portfolioValue || 0) - parseFloat(a.portfolioValue || 0))
        .slice(0, 5);

    // Clients needing attention (non-healthy)
    const needsAttention = clients.filter(
        c => c.healthLevel === "ALERT" || c.healthLevel === "CRITICAL");

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border
                                         border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Platform overview — {data.totalClients} clients · Updated now
                    </p>
                </div>
                <button
                    onClick={() => navigate("/admin/clients")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                               font-semibold rounded-xl transition-colors">
                    View All Clients →
                </button>
            </div>

            {/* ── AUM row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    label="Total AUM"
                    value={fmtCrore(data.totalAum)}
                    sub={fmt(data.totalAum) + " current value"}
                    icon="💼"
                />
                <StatCard
                    label="Total Invested"
                    value={fmtCrore(data.totalInvested)}
                    sub="All clients combined"
                    icon="💰"
                    color="text-slate-300"
                />
                <StatCard
                    label="Platform P&L"
                    value={(isUp ? "+" : "") + fmtCrore(data.platformUnrealizedPL)}
                    sub={fmt(data.platformUnrealizedPL)}
                    icon={isUp ? "📈" : "📉"}
                    color={isUp ? "text-green-400" : "text-red-400"}
                    trend={data.platformPLPercent}
                />
                <StatCard
                    label="Active Clients"
                    value={data.totalClients}
                    sub={`${data.newClientsThisMonth} new this month`}
                    icon="👥"
                />
            </div>

            {/* ── Activity row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    label="Transactions Today"
                    value={data.transactionsToday}
                    icon="📋"
                    color="text-blue-400"
                />
                <StatCard
                    label="Transactions (7d)"
                    value={data.transactionsThisWeek}
                    icon="📅"
                    color="text-blue-400"
                />
                <StatCard
                    label="Net Flow (7d)"
                    value={fmtCrore(data.netFlowThisWeek)}
                    sub={parseFloat(data.netFlowThisWeek || 0) >= 0
                        ? "Net capital inflow" : "Net capital outflow"}
                    icon="🔄"
                    color={parseFloat(data.netFlowThisWeek || 0) >= 0
                        ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                    label="Total Holdings"
                    value={`${data.totalStockHoldings} stocks`}
                    sub={`${data.totalMfHoldings} MF holdings`}
                    icon="🗂"
                />
            </div>

            {/* ── Bottom two columns ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Top clients */}
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4
                                    border-b border-slate-700/60">
                        <p className="text-white font-semibold">Top Clients by Portfolio</p>
                        <button
                            onClick={() => navigate("/admin/clients")}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline">
                            See all →
                        </button>
                    </div>
                    <div className="divide-y divide-slate-700/40">
                        {topClients.map((c, i) => {
                            const plPct = parseFloat(c.unrealizedPLPercent || 0);
                            const isPos = plPct >= 0;
                            const hc    = HEALTH_CONFIG[c.healthLevel] || HEALTH_CONFIG.HEALTHY;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => navigate(`/admin/clients/${c.id}`)}
                                    className="w-full flex items-center gap-3 px-5 py-3.5
                                               hover:bg-slate-700/30 transition-colors text-left">
                                    <span className="text-slate-600 text-sm font-bold w-5">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-semibold truncate">
                                            {c.fullName || c.username}
                                        </p>
                                        <p className="text-slate-500 text-xs truncate">{c.email}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-white text-sm font-bold">
                                            {fmtCrore(c.portfolioValue)}
                                        </p>
                                        <p className={"text-xs font-semibold " +
                                        (isPos ? "text-green-400" : "text-red-400")}>
                                            {isPos ? "+" : ""}{plPct.toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className={"w-2 h-2 rounded-full flex-shrink-0 " + hc.color} />
                                </button>
                            );
                        })}
                        {topClients.length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-8">
                                No clients yet
                            </p>
                        )}
                    </div>
                </div>

                {/* Needs attention */}
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4
                                    border-b border-slate-700/60">
                        <p className="text-white font-semibold">Needs Attention</p>
                        <span className={"text-xs font-bold px-2 py-0.5 rounded-full " +
                        (needsAttention.length > 0
                            ? "bg-red-900/40 text-red-400"
                            : "bg-green-900/30 text-green-400")}>
                            {needsAttention.length > 0
                                ? `${needsAttention.length} alerts`
                                : "All clear"}
                        </span>
                    </div>
                    <div className="divide-y divide-slate-700/40">
                        {needsAttention.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <p className="text-4xl mb-2">✅</p>
                                <p className="text-green-400 font-semibold text-sm">
                                    All clients healthy
                                </p>
                                <p className="text-slate-600 text-xs mt-1">
                                    No critical or alert conditions detected
                                </p>
                            </div>
                        ) : needsAttention.map(c => {
                            const hc = HEALTH_CONFIG[c.healthLevel] || HEALTH_CONFIG.WARNING;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => navigate(`/admin/clients/${c.id}`)}
                                    className="w-full flex items-center gap-3 px-5 py-3.5
                                               hover:bg-slate-700/30 transition-colors text-left">
                                    <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " +
                                    hc.color +
                                    (c.healthLevel === "CRITICAL" ? " animate-pulse" : "")} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-semibold truncate">
                                            {c.fullName || c.username}
                                        </p>
                                        <p className={"text-xs " + hc.text}>{c.healthNote}</p>
                                    </div>
                                    <span className={"text-xs font-bold px-2 py-0.5 rounded-full border " +
                                    hc.text + " border-current/30"}>
                                        {hc.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Best performer note ── */}
            {data.topPerformingClientName && (
                <div className="bg-green-900/20 border border-green-500/20 rounded-2xl
                                px-5 py-4 flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                        <p className="text-green-400 font-semibold text-sm">
                            Top performer: {data.topPerformingClientName}
                        </p>
                        <p className="text-green-600 text-xs mt-0.5">
                            +{parseFloat(data.topPerformingClientPLPct || 0).toFixed(2)}% overall return
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}