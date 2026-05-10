import { useState, useEffect } from "react";
import {
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    searchStocks,
    getMfWatchlist,
    addToMfWatchlist,
    removeFromMfWatchlist,
    searchMfSchemes,
} from "../api/portfolio";
import StockDetailModal from "../components/StockDetailModal";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";
import { useToast } from "../context/ToastContext";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(val || 0);

// ====================================================================
// MAIN PAGE
// ====================================================================

export default function WatchlistPage() {
    const [superTab, setSuperTab] = useState("stocks");
    const toast = useToast();

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white">Watchlist</h1>
                <p className="text-xs text-slate-500 mt-1">
                    💡 Click any item to view details and chart
                </p>
            </div>

            {/* Super tabs */}
            <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setSuperTab("stocks")}
                    className={
                        "px-5 py-2 rounded-lg text-sm font-medium transition-colors " +
                        (superTab === "stocks"
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-white")
                    }
                >
                    📈 Stocks
                </button>
                <button
                    onClick={() => setSuperTab("mf")}
                    className={
                        "px-5 py-2 rounded-lg text-sm font-medium transition-colors " +
                        (superTab === "mf"
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-white")
                    }
                >
                    📊 Mutual Funds
                </button>
            </div>

            {superTab === "stocks" && <StocksWatchlist toast={toast} />}
            {superTab === "mf"     && <MfWatchlist toast={toast} />}
        </div>
    );
}

// ====================================================================
// STOCKS WATCHLIST
// ====================================================================

function StocksWatchlist({ toast }) {
    const [watchlist, setWatchlist]         = useState(null);
    const [loading, setLoading]             = useState(true);
    const [stockSearch, setStockSearch]     = useState("");
    const [stockResults, setStockResults]   = useState([]);
    const [adding, setAdding]               = useState(false);
    const [chartStock, setChartStock]       = useState(null);

    const load = () => {
        getWatchlist()
            .then(res => setWatchlist(res.data))
            .catch((err) => toast.error(err.userMessage || "Failed to load Stock watchlist"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

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
            toast.success(stock.symbol + " added to watchlist");
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to add stock");
        } finally { setAdding(false); }
    };

    const handleRemove = async (item) => {
        try {
            await removeFromWatchlist(item.id);
            toast.success(item.stock.symbol + " removed");
            load();
        } catch { toast.error("Failed to remove stock"); }
    };

    return (
        <div className="space-y-4">
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
                                    className="w-full text-left px-3 py-2 hover:bg-slate-600
                                               text-sm border-b border-slate-600/50 last:border-0"
                                >
                                    <span className="font-medium text-white">{s.symbol}</span>
                                    <span className="text-slate-400 ml-2 text-xs">{s.name}</span>
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

            {/* Stocks table */}
            {loading ? (
                <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : !watchlist || watchlist.items.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700
                                p-12 text-center">
                    <p className="text-4xl mb-3">👁</p>
                    <p className="text-white font-semibold">No stocks watched yet</p>
                    <p className="text-slate-400 text-sm mt-1">
                        Search for a stock above to start watching it
                    </p>
                </div>
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
                            const chg   = parseFloat(item.currentPrice?.changePercent || 0);
                            const color = chg >= 0 ? "text-green-400" : "text-red-400";
                            return (
                                <tr
                                    key={item.id}
                                    className="border-b border-slate-700/50
                                                   hover:bg-slate-700/30 transition-colors"
                                >
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
                                    <td className="text-right px-4 py-3 text-white font-medium">
                                        {item.currentPrice
                                            ? fmt(item.currentPrice.currentPrice)
                                            : "—"}
                                    </td>
                                    <td className={"text-right px-4 py-3 font-medium " + color}>
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

            <StockDetailModal
                stock={chartStock}
                onClose={() => setChartStock(null)}
            />
        </div>
    );
}

// ====================================================================
// MF WATCHLIST
// ====================================================================

function MfWatchlist({ toast }) {
    const [items, setItems]                 = useState([]);
    const [loading, setLoading]             = useState(true);
    const [schemeSearch, setSchemeSearch]   = useState("");
    const [schemeResults, setSchemeResults] = useState([]);
    const [adding, setAdding]               = useState(false);
    const [detailScheme, setDetailScheme]   = useState(null);

    const load = () => {
        getMfWatchlist()
            .then(res => setItems(res.data))
            .catch((err) => toast.error(err.userMessage || "Failed to load MF watchlist"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleSchemeSearch = async (q) => {
        setSchemeSearch(q);
        if (q.length < 2) { setSchemeResults([]); return; }
        try {
            const res = await searchMfSchemes(q);
            setSchemeResults(res.data.content || []);
        } catch { setSchemeResults([]); }
    };

    const handleAdd = async (scheme) => {
        setAdding(true);
        setSchemeSearch("");
        setSchemeResults([]);
        try {
            await addToMfWatchlist({ schemeCode: scheme.schemeCode });
            toast.success(scheme.schemeName + " added to MF watchlist");
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || "Already in watchlist");
        } finally { setAdding(false); }
    };

    const handleRemove = async (item) => {
        try {
            await removeFromMfWatchlist(item.id);
            toast.success("Removed from MF watchlist");
            load();
        } catch { toast.error("Failed to remove"); }
    };

    return (
        <div className="space-y-4">
            {/* Add scheme */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300 mb-3">
                    Add a scheme to watch
                </h2>
                <div className="relative">
                    <input
                        type="text"
                        value={schemeSearch}
                        onChange={e => handleSchemeSearch(e.target.value)}
                        placeholder="Search scheme name e.g. HDFC Mid Cap, Mirae"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-3 py-2 text-white text-sm focus:outline-none
                                   focus:border-blue-500"
                        disabled={adding}
                    />
                    {schemeResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700
                                        border border-slate-600 rounded-lg shadow-xl
                                        max-h-48 overflow-y-auto">
                            {schemeResults.map(s => (
                                <button
                                    key={s.schemeCode}
                                    type="button"
                                    onClick={() => handleAdd(s)}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-600
                                               text-sm border-b border-slate-600/50 last:border-0"
                                >
                                    <p className="font-medium text-white text-xs">
                                        {s.schemeName}
                                    </p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        {s.fundHouse || "—"}
                                        {s.nav ? " · NAV ₹" + s.nav : ""}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MF table */}
            {loading ? (
                <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : items.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700
                                p-12 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-white font-semibold">No MF schemes watched yet</p>
                    <p className="text-slate-400 text-sm mt-1">
                        Search for a scheme above to start watching it
                    </p>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700
                                overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400
                                           text-xs uppercase">
                            <th className="text-left px-4 py-3">Scheme</th>
                            <th className="text-left px-4 py-3">Category</th>
                            <th className="text-right px-4 py-3">Latest NAV</th>
                            <th className="text-right px-4 py-3">NAV Date</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map(item => (
                            <tr
                                key={item.id}
                                className="border-b border-slate-700/50
                                               hover:bg-slate-700/30 transition-colors"
                            >
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => setDetailScheme(item)}
                                        className="text-left group"
                                    >
                                        <p className="font-semibold text-white
                                                          group-hover:text-blue-400
                                                          transition-colors text-xs
                                                          max-w-xs truncate"
                                           title={item.schemeName}>
                                            {item.schemeName}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {item.fundHouse || "—"}
                                        </p>
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-xs">
                                    {item.schemeCategory || "—"}
                                </td>
                                <td className="text-right px-4 py-3 text-white font-medium">
                                    {item.nav ? "₹" + item.nav : "—"}
                                </td>
                                <td className="text-right px-4 py-3 text-slate-400 text-xs">
                                    {item.navDate || "—"}
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
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {detailScheme && (
                <MfSchemeDetailModal
                    scheme={{
                        schemeCode:     detailScheme.schemeCode,
                        schemeName:     detailScheme.schemeName,
                        fundHouse:      detailScheme.fundHouse,
                        schemeCategory: detailScheme.schemeCategory,
                        nav:            detailScheme.nav,
                    }}
                    onClose={() => setDetailScheme(null)}
                    onTransact={() => setDetailScheme(null)}
                />
            )}
        </div>
    );
}