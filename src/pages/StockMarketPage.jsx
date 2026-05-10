import { useState, useEffect } from "react";
import { searchStocks, getStockPrice, addToWatchlist } from "../api/portfolio";
import StockDetailModal from "../components/StockDetailModal";
import { useToast } from "../context/ToastContext";

// Top NSE stocks by category
const POPULAR_SYMBOLS = [
    { symbol: "RELIANCE",   exchange: "NSE", label: "Reliance Industries" },
    { symbol: "TCS",        exchange: "NSE", label: "TCS"                 },
    { symbol: "HDFCBANK",   exchange: "NSE", label: "HDFC Bank"           },
    { symbol: "INFY",       exchange: "NSE", label: "Infosys"             },
    { symbol: "ICICIBANK",  exchange: "NSE", label: "ICICI Bank"          },
    { symbol: "BHARTIARTL", exchange: "NSE", label: "Airtel"              },
    { symbol: "KOTAKBANK",  exchange: "NSE", label: "Kotak Bank"          },
    { symbol: "SBIN",       exchange: "NSE", label: "SBI"                 },
    { symbol: "LT",         exchange: "NSE", label: "L&T"                 },
    { symbol: "HINDUNILVR", exchange: "NSE", label: "HUL"                 },
    { symbol: "AXISBANK",   exchange: "NSE", label: "Axis Bank"           },
    { symbol: "WIPRO",      exchange: "NSE", label: "Wipro"               },
];

const fmt = (val, currency = "INR") =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(val || 0);

export default function StocksMarketPage() {
    const [quotes,      setQuotes]      = useState({});
    const [loading,     setLoading]     = useState(true);
    const [query,       setQuery]       = useState("");
    const [results,     setResults]     = useState([]);
    const [searching,   setSearching]   = useState(false);
    const [chartStock,  setChartStock]  = useState(null);
    const toast = useToast();

    // Fetch prices for popular stocks
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const results = {};
            await Promise.allSettled(
                POPULAR_SYMBOLS.map(async (s) => {
                    try {
                        const res = await getStockPrice(s.symbol);
                        results[s.symbol] = res.data;
                    } catch {}
                })
            );
            setQuotes(results);
            setLoading(false);
        };
        fetchAll();
    }, []);

    const handleSearch = async (q) => {
        setQuery(q);
        if (q.length < 2) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await searchStocks(q);
            setResults(res.data.content || []);
        } catch { setResults([]); }
        finally { setSearching(false); }
    };

    const handleAddWatchlist = async (symbol, stockId) => {
        try {
            await addToWatchlist({ stockId });
            toast.success(symbol + " added to watchlist");
        } catch (err) {
            toast.error(err.userMessage || "Failed to add");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Stock Market</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        NSE/BSE live prices · Click any card to view chart
                    </p>
                </div>
                {/* Search */}
                <div className="relative w-72">
                    <input
                        type="text"
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search any stock..."
                        className="w-full bg-slate-800 border border-slate-700
                                   rounded-xl px-4 py-2.5 text-white text-sm
                                   focus:outline-none focus:border-blue-500 pr-10"
                    />
                    {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-400
                                            border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    {results.length > 0 && query.length >= 2 && (
                        <div className="absolute z-20 top-full mt-1 w-full
                                        bg-slate-800 border border-slate-700
                                        rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                            {results.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        setChartStock(s);
                                        setQuery(""); setResults([]);
                                    }}
                                    className="w-full text-left px-4 py-3
                                               hover:bg-slate-700 border-b
                                               border-slate-700/50 last:border-0
                                               transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white text-sm font-semibold">
                                                {s.symbol}
                                            </p>
                                            <p className="text-slate-400 text-xs">
                                                {s.name}
                                            </p>
                                        </div>
                                        <span className="text-xs bg-slate-600
                                                         text-slate-300 px-2 py-0.5
                                                         rounded">
                                            {s.exchange}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Popular stocks grid */}
            <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase
                               tracking-wider mb-3">
                    Nifty 50 — Top Stocks
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {POPULAR_SYMBOLS.map(s => {
                        const q   = quotes[s.symbol];
                        const up  = parseFloat(q?.changePercent || 0) >= 0;
                        const clr = up ? "text-green-400" : "text-red-400";
                        const bg  = up ? "bg-green-900/20" : "bg-red-900/20";
                        return (
                            <button
                                key={s.symbol}
                                onClick={() => setChartStock({
                                    symbol: s.symbol,
                                    exchange: s.exchange,
                                    name: s.label,
                                })}
                                className="bg-slate-800 hover:bg-slate-700
                                           border border-slate-700 hover:border-slate-600
                                           rounded-xl p-4 text-left transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-white font-bold text-base
                                                      group-hover:text-blue-400
                                                      transition-colors">
                                            {s.symbol}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            {s.label}
                                        </p>
                                    </div>
                                    {!loading && q && (
                                        <span className={
                                            "text-xs font-semibold px-2 py-1 " +
                                            "rounded-lg " + bg + " " + clr
                                        }>
                                            {up ? "▲" : "▼"}{" "}
                                            {Math.abs(
                                                parseFloat(q.changePercent || 0)
                                            ).toFixed(2)}%
                                        </span>
                                    )}
                                </div>
                                {loading ? (
                                    <div className="h-7 w-28 bg-slate-700
                                                    rounded animate-pulse" />
                                ) : q ? (
                                    <p className="text-xl font-bold text-white">
                                        {fmt(q.currentPrice, q.currency)}
                                    </p>
                                ) : (
                                    <p className="text-slate-500 text-sm">
                                        Unavailable
                                    </p>
                                )}
                                {!loading && q && (
                                    <p className={"text-xs mt-1 " + clr}>
                                        {up ? "+" : ""}
                                        {fmt(q.change || 0, q.currency)} today
                                    </p>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <StockDetailModal
                stock={chartStock}
                onClose={() => setChartStock(null)}
            />
        </div>
    );
}