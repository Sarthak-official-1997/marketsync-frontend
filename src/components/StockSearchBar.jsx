import { useState, useEffect, useRef } from "react";
import { searchStocks, getStockPrice } from "../api/portfolio";

const fmt = (val, currency = "INR") =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency === "INR" ? "INR" : "USD",
        maximumFractionDigits: 2,
    }).format(val);

export default function StockSearchBar() {
    const [query, setQuery]               = useState("");
    const [results, setResults]           = useState([]);
    const [loading, setLoading]           = useState(false);
    const [selected, setSelected]         = useState(null);
    const [price, setPrice]               = useState(null);
    const [priceLoading, setPriceLoading] = useState(false);
    const [open, setOpen]                 = useState(false);
    const containerRef                    = useRef(null);
    const inputRef                        = useRef(null);
    const debounceRef                     = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Keyboard shortcuts: "/" to focus, Escape to close
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "/" &&
                document.activeElement.tagName !== "INPUT" &&
                document.activeElement.tagName !== "TEXTAREA") {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === "Escape") {
                setQuery(""); setResults([]); setOpen(false);
                inputRef.current?.blur();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) { setResults([]); setOpen(false); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await searchStocks(query.trim(), 0);
                setResults(res.data.content || []);
                setOpen(true);
            } catch { setResults([]); }
            finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const handleSelect = async (stock) => {
        setSelected(stock); setOpen(false); setQuery(""); setResults([]);
        setPrice(null); setPriceLoading(true);
        try {
            const res = await getStockPrice(stock.symbol);
            setPrice(res.data);
        } catch { setPrice(null); }
        finally { setPriceLoading(false); }
    };

    const handleClose = () => { setSelected(null); setPrice(null); };

    return (
        <>
            {/* Search input */}
            <div ref={containerRef} className="relative w-96">
                <div className="flex items-center bg-slate-700 border border-slate-600
                                rounded-lg px-3 py-2 gap-2 focus-within:border-blue-500 transition-colors">
                    <span className="text-slate-400 text-sm">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search stocks... (press /)"
                        className="bg-transparent text-white text-sm flex-1
                                   focus:outline-none placeholder-slate-400"
                    />
                    {loading && (
                        <div className="w-3 h-3 border-2 border-blue-400
                                        border-t-transparent rounded-full animate-spin" />
                    )}
                    {query && !loading && (
                        <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
                                className="text-slate-400 hover:text-white text-xs">✕</button>
                    )}
                </div>

                {/* Dropdown */}
                {open && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50
                                    bg-slate-800 border border-slate-600 rounded-xl
                                    shadow-2xl max-h-72 overflow-y-auto">
                        {results.length > 0 ? results.map(stock => (
                            <button key={stock.id} onClick={() => handleSelect(stock)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-700
                                               transition-colors border-b border-slate-700/50 last:border-0">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold text-white text-sm">
                                            {stock.symbol}
                                        </span>
                                        <span className="text-slate-400 text-xs ml-2">
                                            {stock.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 bg-slate-700
                                                         px-2 py-0.5 rounded">{stock.exchange}</span>
                                    </div>
                                </div>
                                {stock.sector && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {stock.sector} · {stock.industry}
                                    </p>
                                )}
                            </button>
                        )) : (
                            <div className="px-4 py-3 text-slate-400 text-sm">
                                No results for "{query}"
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stock detail modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                     onClick={handleClose}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative bg-slate-800 rounded-2xl border border-slate-600
                                    shadow-2xl w-full max-w-md p-6"
                         onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{selected.symbol}</h2>
                                <p className="text-slate-400 text-sm mt-0.5">{selected.name}</p>
                            </div>
                            <button onClick={handleClose}
                                    className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-5">
                            {[
                                ["Exchange", selected.exchange],
                                ["Currency", selected.currency],
                                ["Sector",   selected.sector],
                                ["Industry", selected.industry],
                            ].filter(([, v]) => v).map(([label, val]) => (
                                <div key={label} className="bg-slate-700/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                                    <p className="text-white font-medium text-sm">{val}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-700/50 rounded-xl p-4">
                            <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide">
                                Current Price
                            </p>
                            {priceLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-blue-400
                                                    border-t-transparent rounded-full animate-spin" />
                                    <span className="text-slate-400 text-sm">Fetching...</span>
                                </div>
                            ) : price ? (
                                <div className="space-y-2">
                                    <div className="flex items-end gap-3">
                                        <p className="text-3xl font-bold text-white">
                                            {fmt(price.currentPrice, selected.currency)}
                                        </p>
                                        <p className={`text-sm font-medium pb-1 ${
                                            parseFloat(price.changePercent) >= 0
                                                ? "text-green-400" : "text-red-400"}`}>
                                            {parseFloat(price.changePercent) >= 0 ? "+" : ""}
                                            {parseFloat(price.changePercent).toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-400">
                                        <span>Prev close: <span className="text-slate-300">
                                            {fmt(price.previousClose, selected.currency)}
                                        </span></span>
                                        <span>Change: <span className={
                                            parseFloat(price.change) >= 0
                                                ? "text-green-400" : "text-red-400"}>
                                            {parseFloat(price.change) >= 0 ? "+" : ""}
                                            {fmt(price.change, selected.currency)}
                                        </span></span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Mock price · refreshes every 60s
                                    </p>
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Price unavailable</p>
                            )}
                        </div>

                        <button onClick={handleClose}
                                className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white
                                           text-sm font-medium py-2.5 rounded-lg transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}