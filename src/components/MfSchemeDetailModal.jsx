import { useState, useEffect } from "react";
import { getMfNavHistory } from "../api/portfolio";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(val || 0);

const RANGES = ["1M", "2M", "3M", "6M", "1Y", "3Y", "5Y", "All"];

export default function MfSchemeDetailModal({ scheme, onClose, onTransact }) {
    const [range, setRange]     = useState("1Y");
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!scheme) return;
        setLoading(true);
        setData(null);
        getMfNavHistory(scheme.schemeCode, range)
            .then((res) => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [scheme?.schemeCode, range]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    if (!scheme) return null;

    const currentReturn = data?.returns?.[range];
    const isPositive    = currentReturn >= 0;
    const plColor       = isPositive ? "text-green-400" : "text-red-400";

    const growwUrl =
        "https://groww.in/mutual-funds/search?q=" +
        encodeURIComponent(scheme.schemeName || "");

    const vrUrl = "https://www.valueresearchonline.com/funds/selector/";

    const chartData = (data?.navHistory || []).map((p) => ({
        date: p.date,
        nav:  parseFloat(p.nav),
    }));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div
                className="relative z-50 w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
                style={{ height: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="flex items-start justify-between p-5 border-b border-slate-700 flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-4">
                        <p className="text-white font-bold text-lg leading-tight">
                            {scheme.schemeName}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {scheme.fundHouse && (
                                <span className="text-xs text-slate-400">
                                    {scheme.fundHouse}
                                </span>
                            )}
                            {scheme.schemeCategory && (
                                <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">
                                    {scheme.schemeCategory}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* SCROLLABLE BODY */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">

                    {/* NAV + current range return */}
                    <div className="flex items-end gap-6 flex-wrap">
                        <div>
                            <p className="text-xs text-slate-500">Current NAV</p>
                            {loading ? (
                                <div className="h-9 w-32 bg-slate-700 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-3xl font-bold text-white">
                                    {fmt(data?.currentNav)}
                                </p>
                            )}
                            {data?.navDate && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                    as of {data.navDate}
                                </p>
                            )}
                        </div>
                        {!loading && currentReturn != null && (
                            <div>
                                <p className="text-xs text-slate-500">
                                    {range} return
                                </p>
                                <p className={"text-2xl font-bold " + plColor}>
                                    {isPositive ? "+" : ""}
                                    {currentReturn}%
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RANGE SELECTOR */}
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                        {RANGES.map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                                    (range === r
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-white")
                                }
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {/* NAV CHART */}
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        {loading ? (
                            <div className="h-52 flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#334155"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                                        tickFormatter={(d) => {
                                            const parts = d.split("-");
                                            if (parts.length < 3) return d;
                                            return parts[1] + "/" + parts[0].slice(2);
                                        }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                                        tickFormatter={(v) =>
                                            "₹" + v.toFixed(0)
                                        }
                                        domain={["auto", "auto"]}
                                        width={65}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #334155",
                                            borderRadius: "8px",
                                            color: "#fff",
                                        }}
                                        formatter={(v) => [
                                            "₹" + v.toFixed(4),
                                            "NAV",
                                        ]}
                                        labelFormatter={(l) => "Date: " + l}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="nav"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-slate-400 text-center py-16">
                                No chart data available
                            </p>
                        )}
                    </div>

                    {/* RETURNS TABLE */}
                    {!loading && data?.returns && (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-700">
                                <p className="text-white font-semibold text-sm">
                                    Returns
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Absolute for less than 1Y · CAGR for multi-year
                                </p>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-slate-700/50">
                                {Object.entries(data.returns).map(
                                    ([period, ret]) => {
                                        if (ret == null) return null;
                                        const pos = ret >= 0;
                                        const col = pos
                                            ? "text-green-400"
                                            : "text-red-400";
                                        return (
                                            <div
                                                key={period}
                                                className="bg-slate-900 px-4 py-3 text-center"
                                            >
                                                <p className="text-xs text-slate-500">
                                                    {period}
                                                </p>
                                                <p className={"text-base font-bold mt-1 " + col}>
                                                    {pos ? "+" : ""}
                                                    {ret}%
                                                </p>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    )}

                    {/* SCHEME INFO */}
                    {scheme.schemeCode && (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 grid grid-cols-2 gap-4">
                            {[
                                ["Scheme Code", scheme.schemeCode],
                                ["Fund House",  scheme.fundHouse],
                                ["Category",    scheme.schemeCategory],
                                ["Type",        scheme.schemeType],
                            ].map(([label, value]) =>
                                value ? (
                                    <div key={label}>
                                        <p className="text-xs text-slate-500">{label}</p>
                                        <p className="text-sm text-white mt-0.5">{value}</p>
                                    </div>
                                ) : null
                            )}
                        </div>
                    )}

                    {/* EXTERNAL LINKS */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <p className="text-sm font-semibold text-white mb-1">
                            Full Details — Holdings, AUM, Fund Managers
                        </p>
                        <p className="text-xs text-slate-400 mb-3">
                            AUM, expense ratio, fund holdings and manager details
                            are available on these platforms:
                        </p>
                        <div className="flex gap-3">
                            <a
                                href={growwUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center
                                           bg-green-800/30 hover:bg-green-800/50 border
                                           border-green-700/50 text-green-300 py-2.5
                                           rounded-xl text-sm font-medium transition-colors"
                            >
                                Open in Groww →
                            </a>
                            <a
                                href={vrUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center
                                           bg-slate-700 hover:bg-slate-600 border
                                           border-slate-600 text-slate-300 py-2.5
                                           rounded-xl text-sm font-medium transition-colors"
                            >
                                Value Research →
                            </a>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-700 flex-shrink-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white
                                   font-semibold py-3 rounded-xl transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onTransact(scheme);
                            onClose();
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white
                                   font-semibold py-3 rounded-xl transition-colors"
                    >
                        + Record Transaction
                    </button>
                </div>
            </div>
        </div>
    );
}