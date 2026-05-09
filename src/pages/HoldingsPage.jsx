import { useState, useEffect } from "react";
import { getHoldings } from "../api/portfolio";
import { SkeletonTable } from "../components/Skeleton";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import QuickTradeModal from "../components/QuickTradeModal";
import StockDetailModal from "../components/StockDetailModal";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(val);

export default function HoldingsPage() {
    const [holdings, setHoldings]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [refreshing, setRefreshing]     = useState(false);
    const [error, setError]               = useState("");
    const [tradeHolding, setTradeHolding] = useState(null);
    const [tradeType, setTradeType]       = useState("BUY");
    const [chartStock, setChartStock]     = useState(null);
    const toast    = useToast();
    const navigate = useNavigate();

    const loadHoldings = (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        getHoldings()
            .then(res => setHoldings(res.data))
            .catch(() => setError("Failed to load holdings"))
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => { loadHoldings(); }, []);

    const handleRefresh = () => {
        loadHoldings(true);
        toast.info("Prices refreshed");
    };

    const openTrade = (h, type) => {
        setTradeHolding(h);
        setTradeType(type);
    };

    if (loading) return <SkeletonTable rows={5} cols={8} />;
    if (error)   return <ErrorMessage message={error} />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Holdings</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        💡 Click any stock symbol to open the TradingView chart
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="text-slate-400 hover:text-white transition-colors p-2
                               rounded-lg hover:bg-slate-700 disabled:opacity-40"
                    title="Refresh prices"
                >
                    <span className={refreshing ? "animate-spin inline-block" : ""}>
                        🔄
                    </span>
                </button>
            </div>

            {holdings.length === 0 ? (
                <EmptyState
                    icon="💼"
                    title="No holdings yet"
                    message="Record your first BUY transaction to start tracking."
                    action="+ Record a Transaction"
                    onAction={() => navigate("/transactions")}
                />
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700
                                overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400
                                           text-xs uppercase">
                            <th className="text-left px-4 py-3">Stock</th>
                            <th className="text-right px-4 py-3">Qty</th>
                            <th className="text-right px-4 py-3">Avg Buy</th>
                            <th className="text-right px-4 py-3">Current</th>
                            <th className="text-right px-4 py-3">Value</th>
                            <th className="text-right px-4 py-3">P&amp;L</th>
                            <th className="text-right px-4 py-3">P&amp;L %</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {holdings.map(h => {
                            const pl  = parseFloat(h.unrealizedPL);
                            const plc = pl >= 0 ? "text-green-400" : "text-red-400";
                            return (
                                <tr
                                    key={h.id}
                                    className="border-b border-slate-700/50
                                                   hover:bg-slate-700/30 transition-colors"
                                >
                                    {/* Clickable stock name → opens TradingView chart */}
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => setChartStock(h.stock)}
                                            className="text-left group"
                                        >
                                            <p className="font-semibold text-white
                                                              group-hover:text-blue-400
                                                              transition-colors">
                                                {h.stock.symbol}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {h.stock.name}
                                            </p>
                                        </button>
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
                                    <td className={`text-right px-4 py-3
                                                        font-medium ${plc}`}>
                                        {fmt(h.unrealizedPL)}
                                    </td>
                                    <td className={`text-right px-4 py-3
                                                        font-medium ${plc}`}>
                                        {pl >= 0 ? "+" : ""}
                                        {parseFloat(h.unrealizedPLPercent).toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1.5 justify-end">
                                            <button
                                                onClick={() => openTrade(h, "BUY")}
                                                className="text-xs px-2.5 py-1
                                                               bg-green-800/50 text-green-400
                                                               hover:bg-green-700/50 rounded
                                                               transition-colors font-medium"
                                            >
                                                BUY
                                            </button>
                                            <button
                                                onClick={() => openTrade(h, "SELL")}
                                                className="text-xs px-2.5 py-1
                                                               bg-red-800/50 text-red-400
                                                               hover:bg-red-700/50 rounded
                                                               transition-colors font-medium"
                                            >
                                                SELL
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Quick trade modal */}
            <QuickTradeModal
                holding={tradeHolding}
                defaultType={tradeType}
                onClose={() => setTradeHolding(null)}
                onDone={() => loadHoldings(true)}
            />

            {/* TradingView chart modal */}
            <StockDetailModal
                stock={chartStock}
                onClose={() => setChartStock(null)}
            />
        </div>
    );
}