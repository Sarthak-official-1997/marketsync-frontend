import { useState, useEffect } from "react";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "../api/portfolio";
import { searchStocks } from "../api/portfolio";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 2 }).format(val);

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState("");
    const [stockSearch, setStockSearch]   = useState("");
    const [stockResults, setStockResults] = useState([]);
    const [adding, setAdding]             = useState(false);

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
        } catch {
            setStockResults([]);
        }
    };

    const handleAdd = async (stock) => {
        setAdding(true);
        setStockSearch("");
        setStockResults([]);
        try {
            await addToWatchlist({ stockId: stock.id });
            loadWatchlist();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add stock");
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (itemId) => {
        try {
            await removeFromWatchlist(itemId);
            loadWatchlist();
        } catch {
            setError("Failed to remove stock");
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Watchlist</h1>

            {error && <ErrorMessage message={error} />}

            {/* Add stock */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300 mb-3">
                    Add a stock to watch
                </h2>
                <div className="relative">
                    <input
                        type="text"
                        value={stockSearch}
                        onChange={e => handleStockSearch(e.target.value)}
                        placeholder="Search symbol or name..."
                        className="w-full bg-slate-700 border border-slate-600
                                   rounded-lg px-3 py-2 text-white text-sm
                                   focus:outline-none focus:border-blue-500"
                        disabled={adding}
                    />
                    {stockResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700
                                        border border-slate-600 rounded-lg
                                        shadow-xl max-h-48 overflow-y-auto">
                            {stockResults.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleAdd(s)}
                                    className="w-full text-left px-3 py-2
                                               hover:bg-slate-600 text-sm"
                                >
                                    <span className="font-medium text-white">{s.symbol}</span>
                                    <span className="text-slate-400 ml-2">{s.name}</span>
                                    <span className="text-slate-500 ml-2 text-xs">
                                        {s.exchange}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Watchlist items */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {!watchlist || watchlist.items.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        Your watchlist is empty. Search for a stock above to add it.
                    </div>
                ) : (
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
                                <tr key={item.id}
                                    className="border-b border-slate-700/50
                                                   hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-white">
                                            {item.stock.symbol}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {item.stock.name}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                        {item.stock.exchange}
                                    </td>
                                    <td className="text-right px-4 py-3 text-white font-medium">
                                        {item.currentPrice
                                            ? fmt(item.currentPrice.currentPrice)
                                            : "—"}
                                    </td>
                                    <td className={`text-right px-4 py-3 font-medium ${chgColor}`}>
                                        {chg >= 0 ? "+" : ""}
                                        {chg.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleRemove(item.id)}
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
                )}
            </div>
        </div>
    );
}