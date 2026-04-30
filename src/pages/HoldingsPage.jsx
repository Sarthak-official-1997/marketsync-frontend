import { useState, useEffect } from "react";
import { getHoldings } from "../api/portfolio";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 2 }).format(val);

export default function HoldingsPage() {
    const [holdings, setHoldings] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState("");

    useEffect(() => {
        getHoldings()
            .then(res => setHoldings(res.data))
            .catch(() => setError("Failed to load holdings"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner />;
    if (error)   return <ErrorMessage message={error} />;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Holdings</h1>

            {holdings.length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-8 border border-slate-700
                                text-center text-slate-400">
                    No holdings yet. Record a BUY transaction to get started.
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400
                                           text-xs uppercase">
                            <th className="text-left px-4 py-3">Stock</th>
                            <th className="text-right px-4 py-3">Qty</th>
                            <th className="text-right px-4 py-3">Avg Buy</th>
                            <th className="text-right px-4 py-3">Current</th>
                            <th className="text-right px-4 py-3">Value</th>
                            <th className="text-right px-4 py-3">P&L</th>
                            <th className="text-right px-4 py-3">P&L %</th>
                        </tr>
                        </thead>
                        <tbody>
                        {holdings.map((h) => {
                            const pl  = parseFloat(h.unrealizedPL);
                            const plc = pl >= 0 ? "text-green-400" : "text-red-400";
                            return (
                                <tr key={h.id}
                                    className="border-b border-slate-700/50
                                                   hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-white">
                                            {h.stock.symbol}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {h.stock.name}
                                        </p>
                                    </td>
                                    <td className="text-right px-4 py-3 text-white">
                                        {parseFloat(h.quantity).toFixed(2)}
                                    </td>
                                    <td className="text-right px-4 py-3 text-slate-300">
                                        {fmt(h.averageBuyPrice)}
                                    </td>
                                    <td className="text-right px-4 py-3 text-slate-300">
                                        {fmt(h.currentPrice)}
                                    </td>
                                    <td className="text-right px-4 py-3 text-white">
                                        {fmt(h.currentValue)}
                                    </td>
                                    <td className={`text-right px-4 py-3 font-medium ${plc}`}>
                                        {fmt(h.unrealizedPL)}
                                    </td>
                                    <td className={`text-right px-4 py-3 font-medium ${plc}`}>
                                        {pl >= 0 ? "+" : ""}
                                        {parseFloat(h.unrealizedPLPercent).toFixed(2)}%
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}