import { useState, useEffect } from "react";
import { getSummary } from "../api/portfolio";
import Card from "../components/Card";
import { SkeletonDashboard } from "../components/Skeleton";
import ErrorMessage from "../components/ErrorMessage";
import HoldingsBreakdownBar from "../components/HoldingsBreakdownBar";
import SectorExposureCard from "../components/SectorExposureCard";
import StockComparison from "../components/StockComparison";
import PortfolioPerformanceChart from "../components/PortfolioPerformanceChart";
import PLCalendar from "../components/PLCalendar";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444",
    "#8b5cf6","#06b6d4","#ec4899","#84cc16"];

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(val);

const pct = (val) => {
    const n = parseFloat(val);
    const color = n >= 0 ? "text-green-400" : "text-red-400";
    return <span className={color}>{n >= 0 ? "+" : ""}{n.toFixed(2)}%</span>;
};

const tooltipStyle = {
    contentStyle: {
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: "8px", color: "#f1f5f9"
    }
};

export default function DashboardPage() {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState("");

    useEffect(() => {
        getSummary()
            .then(res => setSummary(res.data))
            .catch((err) => toast.error(err.userMessage || "Failed to load portfolio summary"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <SkeletonDashboard />;
    if (error)   return <ErrorMessage message={error} />;
    if (!summary) return null;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Current Value"
                      value={fmt(summary.currentValue)}
                      subtitle={`Invested: ${fmt(summary.totalInvested)}`} />
                <Card title="Unrealized P&L"
                      value={fmt(summary.unrealizedPL)}
                      subtitle={pct(summary.unrealizedPLPercent)}
                      color={parseFloat(summary.unrealizedPL) >= 0
                          ? "text-green-400" : "text-red-400"} />
                <Card title="Realized P&L"
                      value={fmt(summary.realizedPL)}
                      color={parseFloat(summary.realizedPL) >= 0
                          ? "text-green-400" : "text-red-400"} />
                <Card title="Holdings"
                      value={summary.totalHoldings}
                      subtitle={`${summary.totalTransactions} transactions`} />
            </div>

            {/* Pie charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[
                    { title: "Allocation by Stock",  data: summary.byStock },
                    { title: "Allocation by Sector", data: summary.bySector },
                ].map(({ title, data }) => (
                    <div key={title}
                         className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                        <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
                        {data.length === 0 ? (
                            <p className="text-slate-400 text-sm">No holdings yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={data} dataKey="value" nameKey="label"
                                         cx="50%" cy="50%" outerRadius={80}>
                                        {data.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val) => fmt(val)} {...tooltipStyle} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                ))}
            </div>

            {/* Additional charts */}
            <PortfolioPerformanceChart />
            <HoldingsBreakdownBar byStock={summary.byStock} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectorExposureCard bySector={summary.bySector} />
                <StockComparison />
            </div>

            <PLCalendar />
        </div>
    );
}