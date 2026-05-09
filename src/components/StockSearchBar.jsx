import { useState, useEffect, useRef } from "react";
import { searchStocks } from "../api/portfolio";
import StockDetailModal from "./StockDetailModal";

export default function StockSearchBar() {
    const [query, setQuery]       = useState("");
    const [results, setResults]   = useState([]);
    const [loading, setLoading]   = useState(false);
    const [selected, setSelected] = useState(null);
    const [open, setOpen]         = useState(false);
    const containerRef            = useRef(null);
    const inputRef                = useRef(null);
    const debounceRef             = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Keyboard shortcuts
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

    const handleSelect = (stock) => {
        setSelected(stock);
        setOpen(false);
        setQuery("");
        setResults([]);
    };

    return (
        <>
            {/* Search input */}
            <div ref={containerRef} className="relative w-96">
                <div className="flex items-center bg-slate-700 border border-slate-600
                                rounded-lg px-3 py-2 gap-2 focus-within:border-blue-500
                                transition-colors">
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
                        <button
                            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
                            className="text-slate-400 hover:text-white text-xs"
                        >✕</button>
                    )}
                </div>

                {/* Dropdown */}
                {open && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50
                                    bg-slate-800 border border-slate-600 rounded-xl
                                    shadow-2xl max-h-72 overflow-y-auto">
                        {results.length > 0 ? results.map(stock => (
                            <button
                                key={stock.id}
                                onClick={() => handleSelect(stock)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-700
                                           transition-colors border-b border-slate-700/50
                                           last:border-0"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold text-white text-sm">
                                            {stock.symbol}
                                        </span>
                                        <span className="text-slate-400 text-xs ml-2">
                                            {stock.name}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500 bg-slate-700
                                                     px-2 py-0.5 rounded">
                                        {stock.exchange}
                                    </span>
                                </div>
                                {stock.sector && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {stock.sector}
                                        {stock.industry && ` · ${stock.industry}`}
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

            {/* Stock detail modal with TradingView chart */}
            {selected && (
                <StockDetailModal
                    stock={selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </>
    );
}