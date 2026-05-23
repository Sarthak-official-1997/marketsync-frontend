import { useState, useEffect, useRef } from "react";
import { searchStocks, addToWatchlist, getStockPrice, getStockChart, getHoldings } from "../api/portfolio";
import StockDetailModal from "../components/StockDetailModal";
import StockLogo        from "../components/StockLogo";
import { useToast } from "../context/ToastContext";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { addToBoard, getBoardStocks, removeFromBoard } from "../components/Layout";

const RECENTLY_VISITED_KEY = "ms_recently_visited";

const getRecentlyVisited = () => {
    try { return JSON.parse(localStorage.getItem(RECENTLY_VISITED_KEY) || "[]"); }
    catch { return []; }
};
export const addToRecentlyVisited = (stock) => {
    try {
        const prev = getRecentlyVisited();
        const list = [
            { id: stock.id, symbol: stock.symbol, name: stock.name, exchange: stock.exchange },
            ...prev.filter(s => s.symbol !== stock.symbol),
        ].slice(0, 12);
        localStorage.setItem(RECENTLY_VISITED_KEY, JSON.stringify(list));
    } catch {}
};

const BADGE_COLORS = [
    "bg-blue-700","bg-purple-700","bg-green-700","bg-red-700",
    "bg-orange-700","bg-teal-700","bg-indigo-700","bg-pink-700",
    "bg-cyan-700","bg-yellow-700","bg-rose-700","bg-sky-700",
];
const badgeColor = (sym) => {
    const n = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return BADGE_COLORS[n % BADGE_COLORS.length];
};

// ── Single Stock Card ─────────────────────────────────────────────────
function StockCard({ stock, price, holding, dragging, over,
                       onDragStart, onDragEnd, onDragOver, onDrop,
                       onRemove, onOpen }) {

    const [chart, setChart] = useState([]);

    useEffect(() => {
        getStockChart(stock.symbol, "30m", "1d")
            .then(res => setChart(
                (res.data || [])
                    .map(p => ({ v: parseFloat(p.close || p.price || 0) }))
                    .filter(p => p.v > 0)
            ))
            .catch(() => {});
    }, [stock.symbol]);

    const cp  = parseFloat(price?.currentPrice || price?.regularMarketPrice || 0);
    const chg = parseFloat(price?.changePercent || price?.regularMarketChangePercent || 0);
    const up  = chg >= 0;

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={e => { e.preventDefault(); onDragOver(); }}
            onDrop={onDrop}
            className={
                "relative bg-slate-800 border rounded-xl p-3 select-none group " +
                "transition-all cursor-grab active:cursor-grabbing " +
                (dragging ? "opacity-40 scale-95 " : "") +
                (over ? "border-blue-500 bg-slate-750 " : "border-slate-700 hover:border-slate-600 ")
            }
        >
            {/* Remove */}
            <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded opacity-0
                           group-hover:opacity-100 flex items-center justify-center
                           text-slate-500 hover:text-white hover:bg-red-600/70
                           transition-all text-xs z-10"
            >✕</button>

            {/* Logo + symbol + name */}
            <button onClick={onOpen} className="text-left w-full block">
                <div className="flex items-center gap-2.5 mb-2 pr-5">
                    <StockLogo symbol={stock.symbol} name={stock.name} size={34} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="text-white font-bold text-sm leading-none">
                                {stock.symbol}
                            </p>
                            {stock.exchange && (
                                <span className="text-xs text-slate-500 bg-slate-700/50
                                                 px-1 rounded font-medium leading-none py-0.5">
                                    {stock.exchange}
                                </span>
                            )}
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5 leading-tight line-clamp-1 pr-1">
                            {stock.name}
                        </p>
                    </div>
                </div>
            </button>

            {/* Sparkline */}
            {chart.length > 3 ? (
                <div className="h-10 my-2 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart}>
                            <Line type="monotone" dataKey="v"
                                  stroke={up ? "#22c55e" : "#ef4444"}
                                  strokeWidth={1.5} dot={false}
                                  isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-10 my-2 flex items-end">
                    <div className="w-full h-px bg-slate-700" />
                </div>
            )}

            {/* Price */}
            {cp > 0 ? (
                <div>
                    <p className="text-white font-bold text-base leading-none">
                        ₹{cp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className={
                            "text-xs font-bold px-1.5 py-0.5 rounded-md " +
                            (up ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")
                        }>
                            {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                        </span>
                    </div>
                </div>
            ) : (
                <div className="space-y-1">
                    <div className="h-4 w-20 bg-slate-700 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-slate-700 rounded animate-pulse" />
                </div>
            )}

            {/* Invested badge */}
            {holding && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-0.5">
                    <div className="flex justify-between">
                        <span className="text-slate-600 text-xs">Invested</span>
                        <span className="text-slate-300 text-xs font-semibold">
                            ₹{parseFloat(holding.totalInvested||0).toLocaleString("en-IN",{maximumFractionDigits:0})}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500 text-xs">Current</span>
                        <span className={
                            "text-xs font-semibold " +
                            (parseFloat(holding.unrealizedPL||0) >= 0 ? "text-green-400" : "text-red-400")
                        }>
                            ₹{parseFloat(holding.currentValue||0).toLocaleString("en-IN",{maximumFractionDigits:0})}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ====================================================================
export default function StocksMarketPage() {
// ====================================================================
    const [pinned,     setPinned]     = useState([]);
    const [prices,     setPrices]     = useState({});
    const [holdingsMap,setHoldingsMap]= useState({});
    const [chartStock, setChartStock] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const [query,      setQuery]      = useState("");
    const [results,    setResults]    = useState([]);
    const [searching,  setSearching]  = useState(false);
    const [dragIdx,    setDragIdx]    = useState(null);
    const [overIdx,    setOverIdx]    = useState(null);
    const debRef = useRef(null);
    const toast  = useToast();

    // Load board from unified storage + listen for updates from top search bar
    useEffect(() => {
        setPinned(getBoardStocks());

        const handleBoardUpdate = () => setPinned(getBoardStocks());
        window.addEventListener("ms_board_updated", handleBoardUpdate);
        return () => window.removeEventListener("ms_board_updated", handleBoardUpdate);
    }, []);

    // Fetch holdings to show invested/current on cards
    useEffect(() => {
        getHoldings()
            .then(res => {
                const map = {};
                (res.data || []).forEach(h => { map[h.stock.symbol] = h; });
                setHoldingsMap(map);
            })
            .catch(() => {});
    }, []);

    // Fetch all prices in parallel whenever pinned list changes
    useEffect(() => {
        if (pinned.length === 0) return;
        let cancelled = false;
        Promise.allSettled(pinned.map(s => getStockPrice(s.symbol)))
            .then(res => {
                if (cancelled) return;
                const map = {};
                res.forEach((r, i) => {
                    if (r.status === "fulfilled") map[pinned[i].symbol] = r.value.data;
                });
                setPrices(map);
            });
        return () => { cancelled = true; };
    }, [pinned.map(s => s.symbol).join(",")]);

    const openStock = (stock) => {
        addToRecentlyVisited(stock);
        setChartStock(stock);
    };

    const pinStock = (s) => {
        const added = addToBoard(s);
        if (!added) {
            toast.error(`${s.symbol} is already on your board`);
            return;
        }
        toast.success(`${s.symbol} added to board`);
        setShowSearch(false); setQuery(""); setResults([]);
    };

    const removeStock = (symbol) => {
        removeFromBoard(symbol);
    };

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debRef.current);
        if (q.length < 2) { setResults([]); return; }
        setSearching(true);
        debRef.current = setTimeout(async () => {
            try {
                const res = await searchStocks(q);
                setResults(res.data?.content || []);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 300);
    };

    const handleAddWatchlist = async (s) => {
        try {
            await addToWatchlist({ stockId: s.id });
            toast.success(`${s.symbol} added to watchlist`);
        } catch (err) {
            toast.error(err.response?.data?.message || "Already in watchlist");
        }
    };

    // Drag & drop
    const onDragStart = (i) => setDragIdx(i);
    const onDragEnd   = () => { setDragIdx(null); setOverIdx(null); };
    const onDragOver  = (i) => setOverIdx(i);
    const onDrop      = (i) => {
        if (dragIdx === null || dragIdx === i) return;
        const arr = [...pinned];
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(i, 0, moved);
        // Save reordered list to unified storage
        try {
            localStorage.setItem("ms_board_stocks", JSON.stringify(arr));
        } catch {}
        setPinned(arr);
        setDragIdx(null); setOverIdx(null);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Stock Market</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Drag to reorder · Click card to open chart · Hover to remove
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {pinned.length > 0 && (
                        <span className="text-xs text-slate-500">
                            {pinned.length} stock{pinned.length !== 1 ? "s" : ""}
                        </span>
                    )}
                    <button
                        onClick={() => { setShowSearch(v => !v); setQuery(""); setResults([]); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600
                                   hover:bg-blue-700 text-white text-sm font-semibold
                                   rounded-xl transition-colors"
                    >
                        <span className="text-lg leading-none">+</span> Add Stock
                    </button>
                </div>
            </div>

            {/* Add stock search panel */}
            {showSearch && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Search symbol or company name to add to board..."
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                       px-4 py-2.5 text-white text-sm focus:outline-none
                                       focus:border-blue-500"
                        />
                        {searching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-400
                                                border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                    {results.length > 0 && (
                        <div className="rounded-lg border border-slate-700 overflow-hidden max-h-60 overflow-y-auto">
                            {results.map(s => (
                                <div key={s.id}
                                     className="flex items-center justify-between px-4 py-3
                                                border-b border-slate-700/50 last:border-0
                                                hover:bg-slate-700/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-bold">{s.symbol}</p>
                                        <p className="text-slate-400 text-xs truncate">{s.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                        <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">
                                            {s.exchange}
                                        </span>
                                        <button
                                            onClick={() => pinStock(s)}
                                            className="text-xs px-3 py-1.5 bg-blue-600
                                                       hover:bg-blue-700 text-white rounded-lg
                                                       font-medium transition-colors">
                                            + Board
                                        </button>
                                        <button
                                            onClick={() => handleAddWatchlist(s)}
                                            className="text-xs px-3 py-1.5 bg-slate-600
                                                       hover:bg-slate-500 text-white rounded-lg
                                                       font-medium transition-colors">
                                            + Watch
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && !searching && results.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-2">
                            No results for "{query}"
                        </p>
                    )}
                </div>
            )}

            {/* Stock cards grid */}
            {pinned.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-16 text-center">
                    <p className="text-5xl mb-4">📊</p>
                    <p className="text-white font-bold text-lg">Your board is empty</p>
                    <p className="text-slate-400 text-sm mt-2 mb-5">
                        Add stocks to see live prices, mini charts and day change at a glance
                    </p>
                    <button
                        onClick={() => setShowSearch(true)}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                   text-sm font-semibold rounded-xl transition-colors">
                        + Add Your First Stock
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4
                                lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                    {pinned.map((stock, idx) => (
                        <StockCard
                            key={stock.symbol}
                            stock={stock}
                            price={prices[stock.symbol]}
                            holding={holdingsMap[stock.symbol] || null}
                            dragging={dragIdx === idx}
                            over={overIdx === idx && dragIdx !== null && dragIdx !== idx}
                            onDragStart={() => onDragStart(idx)}
                            onDragEnd={onDragEnd}
                            onDragOver={() => onDragOver(idx)}
                            onDrop={() => onDrop(idx)}
                            onRemove={() => removeStock(stock.symbol)}
                            onOpen={() => openStock(stock)}
                        />
                    ))}
                </div>
            )}

            {/* Stock chart modal */}
            {chartStock && (
                <StockDetailModal
                    stock={chartStock}
                    onClose={() => setChartStock(null)}
                />
            )}
        </div>
    );
}