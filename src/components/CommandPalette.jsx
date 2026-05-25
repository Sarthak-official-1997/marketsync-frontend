import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { searchStocks, searchMfSchemes, addToWatchlist, getStockPrice } from "../api/portfolio";
import { getRecentStocks, trackStockView, getRecentMf, trackMfView } from "./RecentStocksMarquee";
import { addToBoard } from "./Layout";
import { useToast } from "../context/ToastContext";

export default function CommandPalette({ open, onClose, onStockSelect, onMfSelect }) {
    const [query,    setQuery]    = useState("");
    const [results,  setResults]  = useState({ stocks: [], mf: [] });
    const [loading,  setLoading]  = useState(false);
    const [tab,      setTab]      = useState("stocks");
    const [recent,   setRecent]   = useState([]);
    const [recentMf, setRecentMf] = useState([]);
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);
    const toast       = useToast();

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setRecent(getRecentStocks().slice(0, 20));
            setRecentMf(getRecentMf().slice(0, 20));
        } else {
            setQuery("");
            setResults({ stocks: [], mf: [] });
        }
    }, [open]);

    // ESC to close
    useEffect(() => {
        if (!open) return;
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) {
            setResults({ stocks: [], mf: [] });
            setLoading(false);
            return;
        }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const [sRes, mRes] = await Promise.allSettled([
                    searchStocks(q), searchMfSchemes(q)
                ]);
                const stocks = sRes.status === "fulfilled"
                    ? (sRes.value?.content || sRes.value?.data?.content || []) : [];
                const mf     = mRes.status === "fulfilled"
                    ? (mRes.value?.content || mRes.value?.data?.content || []) : [];
                setResults({ stocks, mf });
                setTab(stocks.length > 0 ? "stocks" : "mf");
            } catch {}
            finally { setLoading(false); }
        }, 280);
    };

    const selectStock = async (item) => {
        onClose();
        trackStockView(item);
        onStockSelect(item);
        try {
            const res = await getStockPrice(item.symbol);
            const p   = res?.data || res;
            if (p?.changePercent != null || p?.currentPrice != null) {
                trackStockView({
                    ...item,
                    changePercent: p.changePercent ?? p.regularMarketChangePercent ?? null,
                    change:        p.change        ?? p.regularMarketChange        ?? null,
                });
            }
        } catch {}
    };

    const selectMf = (item) => {
        onClose();
        trackMfView(item);
        onMfSelect({ schemeCode: item.schemeCode, schemeName: item.schemeName,
            fundHouse: item.fundHouse, nav: item.nav });
    };

    const handleAddWatchlist = async (e, stock) => {
        e.stopPropagation();
        try {
            await addToWatchlist({ stockId: stock.id });
            toast.success(`${stock.symbol} added to watchlist`);
        } catch (err) {
            toast.error(err.response?.data?.message || "Already in watchlist");
        }
    };

    const handleAddBoard = (e, stock) => {
        e.stopPropagation();
        const added = addToBoard(stock);
        toast[added ? "success" : "error"](
            added ? `${stock.symbol} added to board` : `${stock.symbol} already on board`
        );
    };

    const isTyping       = query.length >= 2;
    const showRecent     = !isTyping;
    const showResults    = isTyping;
    const activeList     = tab === "stocks" ? results.stocks : results.mf;
    const searchSymbols  = new Set(results.stocks.map(s => s.symbol));
    const filteredRecent = recent.filter(s => !searchSymbols.has(s.symbol));

    if (!open) return null;

    return (
        /* Full-screen backdrop */
        <div
            className="fixed inset-0 z-[200] flex flex-col items-center pt-[12vh] px-4
                       bg-black/70 backdrop-blur-md"
            onClick={onClose}
        >
            {/* Palette panel — stop click bubbling */}
            <div
                className="w-full max-w-2xl bg-slate-900 border border-slate-700/80
                           rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.8)]
                           flex flex-col overflow-hidden"
                style={{ maxHeight: "72vh" }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Search input ── */}
                <div className="flex items-center gap-3 px-5 py-4
                                border-b border-slate-700/60">
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-blue-400
                                        border-t-transparent rounded-full
                                        animate-spin flex-shrink-0" />
                    ) : (
                        <svg className="w-5 h-5 text-slate-400 flex-shrink-0"
                             fill="none" stroke="currentColor" strokeWidth="2"
                             viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8"/>
                            <path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                        </svg>
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search stocks, mutual funds..."
                        className="flex-1 bg-transparent text-white text-base
                                   placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center
                                text-slate-400 hover:text-white hover:bg-slate-700
                                rounded-lg transition-colors text-lg leading-none">
                        ✕
                    </button>
                </div>

                {/* ── Tab bar ── */}
                {(showRecent || showResults) && (
                    <div className="flex border-b border-slate-700/60 flex-shrink-0">
                        {[
                            { id: "stocks", label: showResults
                                    ? `📈 Stocks (${results.stocks.length})`
                                    : `🕐 Recent Stocks (${filteredRecent.length})` },
                            { id: "mf", label: showResults
                                    ? `📊 MF (${results.mf.length})`
                                    : `📊 Recent MF (${recentMf.length})` },
                        ].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                    className={"flex-1 py-3 text-sm font-semibold transition-colors " +
                                    (tab === t.id
                                        ? "text-white border-b-2 border-blue-500 bg-slate-800/40"
                                        : "text-slate-500 hover:text-slate-300")}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Results ── */}
                <div className="overflow-y-auto flex-1">

                    {/* Empty query — no recent */}
                    {!isTyping && filteredRecent.length === 0 && recentMf.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <span className="text-4xl">🔍</span>
                            <p className="text-slate-400 text-sm">
                                Search for stocks or mutual funds
                            </p>
                            <p className="text-slate-600 text-xs">
                                Type at least 2 characters to search
                            </p>
                        </div>
                    )}

                    {/* Recent stocks */}
                    {showRecent && tab === "stocks" && filteredRecent.map((stock, i) => {
                        const pct   = parseFloat(stock.changePercent ?? 0);
                        const isPos = pct >= 0;
                        return (
                            <div key={i}
                                 onClick={() => selectStock(stock)}
                                 className="flex items-center gap-4 px-5 py-3.5
                                            border-b border-slate-800/60 last:border-0
                                            hover:bg-slate-800/60 cursor-pointer
                                            transition-colors group">
                                {/* Logo placeholder */}
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br
                                                from-blue-600/30 to-purple-600/30
                                                border border-slate-700 flex items-center
                                                justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-black">
                                        {stock.symbol?.slice(0, 2)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white text-sm font-bold">
                                            {stock.symbol}
                                        </span>
                                        <span className="text-slate-600 text-xs">
                                            {stock.exchange}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-xs truncate mt-0.5">
                                        {stock.name}
                                    </p>
                                </div>
                                {stock.changePercent != null && (
                                    <span className={`text-sm font-bold flex-shrink-0
                                        ${isPos ? "text-green-400" : "text-red-400"}`}>
                                        {isPos ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {/* Recent MF */}
                    {showRecent && tab === "mf" && recentMf.map((mf, i) => (
                        <div key={i}
                             onClick={() => selectMf(mf)}
                             className="flex items-center gap-4 px-5 py-3.5
                                        border-b border-slate-800/60 last:border-0
                                        hover:bg-slate-800/60 cursor-pointer transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br
                                            from-green-600/30 to-teal-600/30
                                            border border-slate-700 flex items-center
                                            justify-center flex-shrink-0">
                                <span className="text-white text-xs font-black">MF</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">
                                    {mf.schemeName}
                                </p>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    {mf.fundHouse}{mf.nav ? ` · NAV ₹${mf.nav}` : ""}
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Search results — stocks */}
                    {showResults && tab === "stocks" && (
                        results.stocks.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-12">
                                No stocks found for "{query}"
                            </p>
                        ) : results.stocks.map((item, i) => (
                            <div key={i}
                                 onClick={() => selectStock(item)}
                                 className="flex items-center gap-4 px-5 py-3.5
                                            border-b border-slate-800/60 last:border-0
                                            hover:bg-slate-800/60 cursor-pointer
                                            transition-colors group">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br
                                                from-blue-600/30 to-purple-600/30
                                                border border-slate-700 flex items-center
                                                justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-black">
                                        {item.symbol?.slice(0, 2)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white text-sm font-bold">
                                            {item.symbol}
                                        </span>
                                        <span className="text-slate-600 text-xs">
                                            {item.exchange}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-xs truncate mt-0.5">
                                        {item.name}
                                    </p>
                                </div>
                                {/* Action buttons — visible on hover */}
                                <div className="flex gap-1.5 flex-shrink-0 opacity-0
                                                group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={e => handleAddWatchlist(e, item)}
                                        className="text-xs px-2.5 py-1.5 bg-slate-700
                                                   hover:bg-blue-600 text-slate-300
                                                   hover:text-white rounded-lg transition-colors">
                                        + Watch
                                    </button>
                                    <button
                                        onClick={e => handleAddBoard(e, item)}
                                        className="text-xs px-2.5 py-1.5 bg-slate-700
                                                   hover:bg-purple-600 text-slate-300
                                                   hover:text-white rounded-lg transition-colors">
                                        + Board
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Search results — MF */}
                    {showResults && tab === "mf" && (
                        results.mf.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-12">
                                No funds found for "{query}"
                            </p>
                        ) : results.mf.map((item, i) => (
                            <div key={i}
                                 onClick={() => selectMf(item)}
                                 className="flex items-center gap-4 px-5 py-3.5
                                            border-b border-slate-800/60 last:border-0
                                            hover:bg-slate-800/60 cursor-pointer transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br
                                                from-green-600/30 to-teal-600/30
                                                border border-slate-700 flex items-center
                                                justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-black">MF</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-semibold truncate">
                                        {item.schemeName}
                                    </p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        {item.fundHouse}{item.nav ? ` · NAV ₹${item.nav}` : ""}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ── Footer hint ── */}
                <div className="flex items-center justify-between px-5 py-2.5
                                border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
                    <p className="text-slate-600 text-xs">
                        FOLYO · Portfolio tracking, the way it should be.
                    </p>
                    <div className="flex items-center gap-3 text-slate-600 text-xs">
                        <span>↵ open &nbsp;·&nbsp; tap ✕ to close</span>
                    </div>
                </div>
            </div>
        </div>
    );
}