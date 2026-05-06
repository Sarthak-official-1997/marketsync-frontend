import { useState, useEffect } from "react";
import { getHoldings } from "../api/portfolio";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(val);

export default function PortfolioPerformanceChart() {
    const [data, setData]     = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHoldings().then(res => {
            const holdings = res.data;
            if (holdings.length === 0) { setData([]); return; }

            const currentTotal  = holdings.reduce((s, h) => s + parseFloat(h.currentValue), 0);
            const investedTotal = holdings.reduce((s, h) => s + parseFloat(h.totalInvested), 0);
            const days = ["6d ago","5d ago","4d ago","3d ago","2d ago","Yesterday","Today"];

            const chartData = days.map((day, i) => {
                const progress = i / (days.length - 1);
                const noise    = (Math.random() - 0.5) * 0.02;
                const value    = investedTotal + (currentTotal - investedTotal) * progress
                    + (investedTotal * noise);
                return { day, value: Math.round(value) };
            });
            chartData[chartData.length - 1].value = Math.round(currentTotal);
            setData(chartData);
        }).catch(() => setData([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading || data.length === 0) return null;

    const isPositive = data[data.length - 1].value >= data[0].value;
    const color = isPositive ? "#10b981" : "#ef4444";

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Portfolio Performance</h2>
                <span className="text-xs text-slate-500">Last 7 days · simulated</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }}
                           tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val) => [fmt(val), "Portfolio Value"]}
                             contentStyle={{ background: "#1e293b", border: "1px solid #334155",
                                 borderRadius: "8px", color: "#f1f5f9" }} />
                    <Area type="monotone" dataKey="value" stroke={color}
                          strokeWidth={2} fill="url(#grad)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}