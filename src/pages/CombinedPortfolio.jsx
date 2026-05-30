import { useState, useEffect } from "react";
import { getHoldings, getMfHoldings } from "../api/portfolio";
import { useToast } from "../context/ToastContext";
import { usePrivacy } from "../context/PrivacyContext";
import StockDetailModal from "../components/StockDetailModal";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtPct = (v) => {
    if (v == null) return "—";
    const n = parseFloat(v);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

const pctColor = (v) =>
    parseFloat(v || 0) >= 0 ? "text-green-400" : "text-red-400";

export default function CombinedPortfolio() {
    const [stocks,      setStocks]      = useState([]);
    const [mfHoldings,  setMfHoldings]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [combined,    setCombined]    = useState(true); // true = merged view
    const [chartStock,  setChartStock]  = useState(null);
    const toast = useToast();
    const { hidden: valuesHidden } = usePrivacy();
    const fmtV = (v) => valuesHidden ? "••••••" : fmt(v);

    useEffect(() => {
        Promise.all([getHoldings(), getMfHoldings()])
            .then(([sRes, mRes]) => {
                setStocks(sRes.data || []);
                setMfHoldings(mRes.data || []);
            })
            .catch(() => toast.error("Failed to load portfolio"))
            .finally(() => setLoading(false));
    }, []);

    // Build rows
    const stockRows = stocks.map(h => ({
        type:    "STOCK",
        name:    h.stock.symbol,
        subName: h.stock.name,
        invested: parseFloat(h.totalInvested  || 0),
        value:    parseFloat(h.currentValue   || 0),
        pl:       parseFloat(h.unrealizedPL   || 0),
        plPct:    parseFloat(h.unrealizedPLPercent || 0),
        raw: h,
    }));

    const mfRows = mfHoldings.map(h => ({
        type:    "MF",
        name:    h.schemeName,
        subName: h.fundHouse,
        invested: parseFloat(h.totalInvested     || 0),
        value:    parseFloat(h.currentValue      || 0),
        pl:       parseFloat(h.unrealizedPnl     || 0),
        plPct:    parseFloat(h.unrealizedPnlPercent || 0),
        raw: h,
    }));

    const allRows = [...stockRows, ...mfRows]
        .sort((a, b) => b.value - a.value);

    const totalInvested = allRows.reduce((s, r) => s + r.invested, 0);
    const totalValue    = allRows.reduce((s, r) => s + r.value,    0);
    const totalPL       = totalValue - totalInvested;
    const totalPLPct    = totalInvested > 0
        ? ((totalPL / totalInvested) * 100) : 0;

    const stockInvested = stockRows.reduce((s, r) => s + r.invested, 0);
    const stockValue    = stockRows.reduce((s, r) => s + r.value,    0);
    const stockPL       = stockValue - stockInvested;

    const mfInvested    = mfRows.reduce((s, r) => s + r.invested, 0);
    const mfValue       = mfRows.reduce((s, r) => s + r.value,    0);
    const mfPL          = mfValue - mfInvested;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Combined Portfolio</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Stocks + Mutual Funds — your complete financial picture
                    </p>
                </div>
                {/* Separate / Combine toggle */}
                <div className="flex items-center gap-2 bg-slate-800 p-1
                                rounded-xl border border-slate-700">
                    <button
                        onClick={() => setCombined(true)}
                        className={
                            "px-4 py-2 rounded-lg text-sm font-semibold " +
                            "transition-colors " +
                            (combined
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 hover:text-white")
                        }
                    >
                        ⊞ Combined
                    </button>
                    <button
                        onClick={() => setCombined(false)}
                        className={
                            "px-4 py-2 rounded-lg text-sm font-semibold " +
                            "transition-colors " +
                            (!combined
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 hover:text-white")
                        }
                    >
                        ⊟ Separate
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className={
                "grid gap-4 " +
                (combined ? "grid-cols-2 md:grid-cols-4"
                    : "grid-cols-1 md:grid-cols-2")
            }>
                {combined ? (
                    // Combined summary
                    <>
                        {[
                            ["Total Invested",  fmt(totalInvested), "text-white"],
                            ["Current Value",   fmt(totalValue),    "text-white"],
                            ["Total P&L",
                                fmt(totalPL) + "\n" + fmtPct(totalPLPct),
                                pctColor(totalPL)],
                            ["Holdings",
                                stockRows.length + " stocks + " + mfRows.length + " MF",
                                "text-white"],
                        ].map(([label, value, cls]) => (
                            <div key={label}
                                 className="bg-slate-800 rounded-2xl p-5
                                            border border-slate-700">
                                <p className="text-xs text-slate-500">{label}</p>
                                {value.includes("\n") ? (
                                    value.split("\n").map((v, i) => (
                                        <p key={i}
                                           className={
                                               "font-bold mt-1 " + cls + " " +
                                               (i === 0 ? "text-xl" : "text-sm")
                                           }>
                                            {v}
                                        </p>
                                    ))
                                ) : (
                                    <p className={"text-xl font-bold mt-1 " + cls}>
                                        {value}
                                    </p>
                                )}
                            </div>
                        ))}
                    </>
                ) : (
                    // Separate summary
                    <>
                        <div className="bg-slate-800 rounded-2xl p-5 border
                                        border-slate-700 border-l-4 border-l-blue-500">
                            <p className="text-xs text-slate-400 font-semibold
                                          uppercase tracking-wider mb-3">
                                📈 Stocks
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    ["Invested", fmt(stockInvested)],
                                    ["Value",    fmt(stockValue)],
                                    ["P&L",      fmt(stockPL)],
                                ].map(([l, v]) => (
                                    <div key={l}>
                                        <p className="text-xs text-slate-500">{l}</p>
                                        <p className={
                                            "text-sm font-bold mt-0.5 " +
                                            (l === "P&L" ? pctColor(stockPL) : "text-white")
                                        }>
                                            {v}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-800 rounded-2xl p-5 border
                                        border-slate-700 border-l-4 border-l-purple-500">
                            <p className="text-xs text-slate-400 font-semibold
                                          uppercase tracking-wider mb-3">
                                📊 Mutual Funds
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    ["Invested", fmt(mfInvested)],
                                    ["Value",    fmt(mfValue)],
                                    ["P&L",      fmt(mfPL)],
                                ].map(([l, v]) => (
                                    <div key={l}>
                                        <p className="text-xs text-slate-500">{l}</p>
                                        <p className={
                                            "text-sm font-bold mt-0.5 " +
                                            (l === "P&L" ? pctColor(mfPL) : "text-white")
                                        }>
                                            {v}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Holdings table */}
            {loading ? (
                <div className="h-48 bg-slate-800 rounded-2xl animate-pulse" />
            ) : allRows.length === 0 ? (
                <div className="bg-slate-800 rounded-2xl border border-slate-700
                                p-12 text-center">
                    <p className="text-4xl mb-3">💼</p>
                    <p className="text-white font-semibold">No holdings yet</p>
                </div>
            ) : combined ? (
                // Combined table
                <div className="bg-slate-800 rounded-2xl border border-slate-700
                                overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400
                                           text-xs uppercase">
                            <th className="text-left px-5 py-3">Type</th>
                            <th className="text-left px-5 py-3">Name</th>
                            <th className="text-right px-5 py-3">Invested</th>
                            <th className="text-right px-5 py-3">Value</th>
                            <th className="text-right px-5 py-3">P&amp;L</th>
                            <th className="text-right px-5 py-3">Return</th>
                        </tr>
                        </thead>
                        <tbody>
                        {allRows.map((row, idx) => (
                            <tr key={idx}
                                className="border-b border-slate-700/50
                                               hover:bg-slate-700/30 transition-colors">
                                <td className="px-5 py-3">
                                        <span className={
                                            "text-xs px-2.5 py-1 rounded-lg " +
                                            "font-semibold " +
                                            (row.type === "STOCK"
                                                ? "bg-blue-900/30 text-blue-400"
                                                : "bg-purple-900/30 text-purple-400")
                                        }>
                                            {row.type === "STOCK" ? "📈" : "📊"}{" "}
                                            {row.type === "STOCK" ? "Stock" : "MF"}
                                        </span>
                                </td>
                                <td className="px-5 py-3">
                                    {row.type === "STOCK" ? (
                                        <button
                                            onClick={() => setChartStock(row.raw.stock)}
                                            className="text-left group"
                                        >
                                            <p className="font-semibold text-white
                                                              group-hover:text-blue-400">
                                                {row.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {row.subName}
                                            </p>
                                        </button>
                                    ) : (
                                        <div>
                                            <p className="font-semibold text-white
                                                              text-xs truncate max-w-xs"
                                               title={row.name}>
                                                {row.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {row.subName}
                                            </p>
                                        </div>
                                    )}
                                </td>
                                <td className="text-right px-5 py-3 text-slate-300">
                                    {fmt(row.invested)}
                                </td>
                                <td className="text-right px-5 py-3 text-white
                                                   font-semibold">
                                    {fmt(row.value)}
                                </td>
                                <td className={"text-right px-5 py-3 font-semibold " +
                                pctColor(row.pl)}>
                                    {fmt(row.pl)}
                                </td>
                                <td className={"text-right px-5 py-3 font-medium " +
                                pctColor(row.plPct)}>
                                    {fmtPct(row.plPct)}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                // Separate tables side by side
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Stocks table */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700
                                    border-t-4 border-t-blue-500 overflow-hidden">
                        <p className="px-5 py-3 text-sm font-semibold text-white
                                      border-b border-slate-700">
                            📈 Stock Holdings ({stockRows.length})
                        </p>
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-slate-500 text-xs uppercase
                                               border-b border-slate-700">
                                <th className="text-left px-5 py-2">Stock</th>
                                <th className="text-right px-5 py-2">Value</th>
                                <th className="text-right px-5 py-2">Return</th>
                            </tr>
                            </thead>
                            <tbody>
                            {stockRows.map((r, i) => (
                                <tr key={i}
                                    className="border-b border-slate-700/40
                                                   hover:bg-slate-700/20">
                                    <td className="px-5 py-2.5">
                                        <button
                                            onClick={() => setChartStock(r.raw.stock)}
                                            className="text-left group"
                                        >
                                            <p className="font-semibold text-white text-sm
                                                              group-hover:text-blue-400">
                                                {r.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {r.subName}
                                            </p>
                                        </button>
                                    </td>
                                    <td className="text-right px-5 py-2.5
                                                       text-white font-semibold text-sm">
                                        {fmt(r.value)}
                                    </td>
                                    <td className={"text-right px-5 py-2.5 " +
                                    "font-semibold text-sm " +
                                    pctColor(r.plPct)}>
                                        {fmtPct(r.plPct)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {/* MF table */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700
                                    border-t-4 border-t-purple-500 overflow-hidden">
                        <p className="px-5 py-3 text-sm font-semibold text-white
                                      border-b border-slate-700">
                            📊 MF Holdings ({mfRows.length})
                        </p>
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-slate-500 text-xs uppercase
                                               border-b border-slate-700">
                                <th className="text-left px-5 py-2">Scheme</th>
                                <th className="text-right px-5 py-2">Value</th>
                                <th className="text-right px-5 py-2">Return</th>
                            </tr>
                            </thead>
                            <tbody>
                            {mfRows.map((r, i) => (
                                <tr key={i}
                                    className="border-b border-slate-700/40
                                                   hover:bg-slate-700/20">
                                    <td className="px-5 py-2.5">
                                        <p className="font-medium text-white text-xs
                                                          truncate max-w-xs"
                                           title={r.name}>
                                            {r.name}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {r.subName}
                                        </p>
                                    </td>
                                    <td className="text-right px-5 py-2.5
                                                       text-white font-semibold text-sm">
                                        {fmt(r.value)}
                                    </td>
                                    <td className={"text-right px-5 py-2.5 " +
                                    "font-semibold text-sm " +
                                    pctColor(r.plPct)}>
                                        {fmtPct(r.plPct)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <StockDetailModal
                stock={chartStock}
                onClose={() => setChartStock(null)}
            />
        </div>
    );
}