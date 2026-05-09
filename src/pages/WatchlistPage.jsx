import { useState, useEffect } from "react";
import {
    getWatchlist, addToWatchlist, removeFromWatchlist, searchStocks
} from "../api/portfolio";
import { SkeletonTable } from "../components/Skeleton";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import StockDetailModal from "../components/StockDetailModal";
import { useToast } from "../context/ToastContext";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(val);

export default function WatchlistPage() {
    const [watchlist, setWatchlist]         = useState(null);
    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState("");
    const [stockSearch, setStockSearch]     = useState("");
    const [stockResults, setStockResults]   = useState([]);
    const [adding, setAdding]               = useState(false);
    const [chartStock, setChartStock]       = useState(null);
    const toast = useToast();

    const loadWatchlist = () => {
        getWatchlist()
            .then(res => setWatchlist(res.data))
            .catch(() => setError("Failed to load watchlist"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadWatchlist(); }, []);

    const handleStockSearch = async (q) => {
        setStockSearch(q);
        if (q.length < 2) { setStockResults([]); return; }
        try {
            const res = await searchStocks(q);
            setStockResults(res.data.content || []);
        } catch { setStockResults([]); }
    };

    const handleAdd = async (stock) => {
        setAdding(true);
        setStockSearch("");
        setStockResults([]);
        try {
            await addToWatchlist({ stockId: stock.id });
            toast.success(`${stock.symbol} added to watchlist`);
            loadWatchlist();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to add stock");
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (item) => {
        try {
            await removeFromWatchlist(item.id);
            toast.success(`${item.stock.symbol} removed from watchlist`);
            loadWatchlist();
        } catch {
            toast.error("Failed to remove stock");
        }
    };

    if (loading) return <SkeletonTable rows={4} cols={5} />;

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white">Watchlist</h1>
                <p className="text-xs text-slate-500 mt-1">
                    💡 Click any stock symbol to open the TradingView chart
                </p>
            </div>

            {error && <ErrorMessage message={error} />}

            {/* Add stock search */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300 mb-3">
                    Add a stock to watch
                </h2>
                <div className="relative">
                    <input
                        type="text"
                        value={stockSearch}
                        onChange={e => handleStockSearch(e.target.value)}
                        placeholder="Search symbol or name... e.g. Reliance, TCS, 360"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-3 py-2 text-white text-sm focus:outline-none
                                   focus:border-blue-500"
                        disabled={adding}
                    />
                    {stockResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700
                                        border border-slate-600 rounded-lg shadow-xl
                                        max-h-48 overflow-y-auto">
                            {stockResults.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleAdd(s)}
                                    className="w-full text-left px-3 py-2
                                               hover:bg-slate-600 text-sm
                                               border-b border-slate-600/50 last:border-0"
                                >
                                    <span className="font-medium text-white">
                                        {s.symbol}
                                    </span>
                                    <span className="text-slate-400 ml-2 text-xs">
                                        {s.name}
                                    </span>
                                    <span className="text-slate-500 ml-2 text-xs
                                                     bg-slate-600 px-1.5 py-0.5 rounded">
                                        {s.exchange}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Watchlist table */}
            {!watchlist || watchlist.items.length === 0 ? (
                <EmptyState
                    icon="👁"
                    title="Your watchlist is empty"
                    message="Search for a stock above to start watching it."
                />
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700
                                overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400
                                           text-xs uppercase">
                            <th className="text-left px-4 py-3">Stock</th>
                            <th className="text-left px-4 py-3">Exchange</th>
                            <th className="text-right px-4 py-3">Current Price</th>
                            <th className="text-right px-4 py-3">Change</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {watchlist.items.map(item => {
                            const chg = parseFloat(
                                item.currentPrice?.changePercent || 0
                            );
                            const chgColor = chg >= 0
                                ? "text-green-400" : "text-red-400";

                            return (
                                <tr
                                    key={item.id}
                                    className="border-b border-slate-700/50
                                                   hover:bg-slate-700/30 transition-colors"
                                >
                                    {/* Clickable stock → opens TradingView chart */}
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => setChartStock(item.stock)}
                                            className="text-left group"
                                        >
                                            <p className="font-semibold text-white
                                                              group-hover:text-blue-400
                                                              transition-colors">
                                                {item.stock.symbol}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {item.stock.name}
                                            </p>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                        {item.stock.exchange}
                                    </td>
                                    <td className="text-right px-4 py-3 text-white
                                                       font-medium">
                                        {item.currentPrice
                                            ? fmt(item.currentPrice.currentPrice)
                                            : "—"}
                                    </td>
                                    <td className={`text-right px-4 py-3
                                                        font-medium ${chgColor}`}>
                                        {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleRemove(item)}
                                            className="text-slate-500 hover:text-red-400
                                                           transition-colors text-xs"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TradingView chart modal */}
            <StockDetailModal
                stock={chartStock}
                onClose={() => setChartStock(null)}
            />
        </div>
    );
}