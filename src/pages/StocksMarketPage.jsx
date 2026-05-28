import { useState, useEffect, useRef } from "react";
import { searchStocks, addToWatchlist, getStockPrice,
    getStockChart, getHoldings, getPortfolioSummary } from "../api/portfolio";
import StockDetailModal  from "../components/StockDetailModal";
import StockLogo         from "../components/StockLogo";
import { useToast }      from "../context/ToastContext";
import { useAuth }       from "../context/AuthContext";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { addToBoard, removeFromBoard } from "../components/Layout";
import { getBoardApi } from "../api/board";
import { trackStockView } from "../components/RecentStocksMarquee";
import RecentStocksMarquee from "../components/RecentStocksMarquee";

const RECENTLY_VISITED_KEY = "ms_recently_visited";

const getRecentlyVisited = () => {
    try { return JSON.parse(localStorage.getItem(RECENTLY_VISITED_KEY) || "[]"); }
    catch { return []; }
};
export const addToRecentlyVisited = (stock) => {
    try {
        const prev = getRecentlyVisited();
        const list = [
            { id: stock.id, symbol: stock.symbol,
                name: stock.name, exchange: stock.exchange },
            ...prev.filter(s => s.symbol !== stock.symbol),
        ].slice(0, 12);
        localStorage.setItem(RECENTLY_VISITED_KEY, JSON.stringify(list));
    } catch {}
};

// ── Market status helper ──────────────────────────────────────────────────────
function getMarketStatus() {
    const now  = new Date();
    const ist  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day  = ist.getDay(); // 0=Sun, 6=Sat
    const mins = ist.getHours() * 60 + ist.getMinutes();
    const open = day >= 1 && day <= 5 && mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
    const preOpen = day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 9 * 60 + 15;
    if (preOpen) return { open: false, label: "Pre-Open", color: "text-amber-400",
        dot: "bg-amber-400" };
    if (open)    return { open: true,  label: "Market Open", color: "text-green-400",
        dot: "bg-green-400 animate-pulse" };
    return       { open: false, label: "Market Closed", color: "text-red-400",
        dot: "bg-red-400" };
}

function getGreeting() {
    const h = new Date(new Date().toLocaleString("en-US",
        { timeZone: "Asia/Kolkata" })).getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

const fmt = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(2) + "Cr";
    if (n >= 100_000)    return "₹" + (n / 100_000).toFixed(2) + "L";
    return new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0,
    }).format(n);
};

// ── Greeting + Market Status Bar ──────────────────────────────────────────────
function GreetingBar({ portfolioSummary }) {
    const { user } = useAuth();
    const [status, setStatus] = useState(getMarketStatus());
    const [now,    setNow]    = useState(new Date());

    // Refresh market status every minute
    useEffect(() => {
        const t = setInterval(() => {
            setStatus(getMarketStatus());
            setNow(new Date());
        }, 60_000);
        return () => clearInterval(t);
    }, []);

    const firstName = user?.fullName?.split(" ")[0] || user?.username || "there";

    const dateStr = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const totalValue = parseFloat(portfolioSummary?.currentValue || 0);
    const dayPL      = parseFloat(portfolioSummary?.dayPL || 0);
    const dayPLPos   = dayPL >= 0;

    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl px-5 py-4
                        flex items-center justify-between flex-wrap gap-4">
            {/* Left: greeting */}
            <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                    {getGreeting()}, {firstName} 👋
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">{dateStr}</p>
            </div>

            {/* Center: market status */}
            <div className="flex items-center gap-2 px-4 py-2
                            bg-slate-900/60 rounded-xl border border-slate-700/40">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                <span className={`text-sm font-semibold ${status.color}`}>
                    {status.label}
                </span>
                <span className="text-slate-600 text-xs hidden md:block">
                    · NSE / BSE · 9:15 AM – 3:30 PM IST
                </span>
            </div>

            {/* Right: portfolio snapshot */}
            {totalValue > 0 && (
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-slate-400 text-xs">Portfolio Value</p>
                        <p className="text-white font-bold text-base leading-tight">
                            {fmt(totalValue)}
                        </p>
                    </div>
                    {dayPL !== 0 && (
                        <div className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
                            dayPLPos
                                ? "bg-green-900/20 border-green-500/30 text-green-400"
                                : "bg-red-900/20 border-red-500/30 text-red-400"
                        }`}>
                            {dayPLPos ? "▲ +" : "▼ "}{fmt(Math.abs(dayPL))}
                            <span className="text-xs font-normal ml-1 opacity-70">today</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Single Stock Card ─────────────────────────────────────────────────────────
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
                (over
                    ? "border-blue-500 bg-slate-750 "
                    : "border-slate-700 hover:border-slate-600 ")
            }
        >
            {/* Remove button */}
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
                        <p className="text-slate-400 text-xs mt-0.5 leading-tight
                                      line-clamp-1 pr-1">
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
                            (up
                                ? "bg-green-500/15 text-green-400"
                                : "bg-red-500/15 text-red-400")
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
                            ₹{parseFloat(holding.totalInvested || 0)
                            .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500 text-xs">Current</span>
                        <span className={
                            "text-xs font-semibold " +
                            (parseFloat(holding.unrealizedPL || 0) >= 0
                                ? "text-green-400" : "text-red-400")
                        }>
                            ₹{parseFloat(holding.currentValue || 0)
                            .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
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
    const [pinned,          setPinned]          = useState([]);
    const [prices,          setPrices]          = useState({});
    const [holdingsMap,     setHoldingsMap]     = useState({});
    const [portfolioSummary,setPortfolioSummary]= useState(null);
    const [chartStock,      setChartStock]      = useState(null);
    const [showSearch,      setShowSearch]      = useState(false);
    const [query,           setQuery]           = useState("");
    const [results,         setResults]         = useState([]);
    const [searching,       setSearching]       = useState(false);
    const [dragIdx,         setDragIdx]         = useState(null);
    const [overIdx,         setOverIdx]         = useState(null);
    const debRef = useRef(null);
    const toast  = useToast();

    // Board
    const loadBoard = () =>
        getBoardApi()
            .then(res => setPinned(res.data || []))
            .catch(() => {});

    useEffect(() => {
        loadBoard();
        window.addEventListener("ms_board_updated", loadBoard);
        return () => window.removeEventListener("ms_board_updated", loadBoard);
    }, []);

    // Holdings map
    useEffect(() => {
        getHoldings()
            .then(res => {
                const map = {};
                (res.data || []).forEach(h => { map[h.stock.symbol] = h; });
                setHoldingsMap(map);
            })
            .catch(() => {});
    }, []);

    // Portfolio summary for greeting bar
    useEffect(() => {
        getPortfolioSummary()
            .then(res => setPortfolioSummary(res.data))
            .catch(() => {});
    }, []);

    // Live prices
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
        trackStockView({
            ...stock,
            changePercent: prices[stock.symbol]?.changePercent ?? null,
            change:        prices[stock.symbol]?.change ?? null,
        });
        setChartStock(stock);
    };

    const pinStock = async (s) => {
        const added = await addToBoard(s);
        if (!added) { toast.error(`${s.symbol} is already on your board`); return; }
        toast.success(`${s.symbol} added to board`);
        setShowSearch(false); setQuery(""); setResults([]);
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

    const onDragStart = (i) => setDragIdx(i);
    const onDragEnd   = () => { setDragIdx(null); setOverIdx(null); };
    const onDragOver  = (i) => setOverIdx(i);
    const onDrop      = (i) => {
        if (dragIdx === null || dragIdx === i) return;
        const arr = [...pinned];
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(i, 0, moved);
        setPinned(arr);
        setDragIdx(null); setOverIdx(null);
    };

    return (
        <div className="space-y-4">

            {/* ── Idea 2: Greeting + market status bar ── */}
            <GreetingBar portfolioSummary={portfolioSummary} />

            {/* ── Idea 1: Labeled recently viewed marquee ── */}
            <div className="flex items-center bg-slate-900/60 border border-slate-800
                            rounded-xl overflow-hidden">
                {/* Fixed label — doesn't scroll */}
                <div className="flex-shrink-0 flex items-center gap-2 px-4
                                border-r border-slate-700/60 h-9 bg-slate-800/60">
                    <span className="text-slate-500 text-[10px] font-bold
                                     uppercase tracking-widest whitespace-nowrap">
                        🕐 Recently Viewed
                    </span>
                </div>
                {/* Scrolling stocks */}
                <div className="flex-1 overflow-hidden min-w-0">
                    <RecentStocksMarquee onStockClick={(stock) => {
                        setChartStock(stock);
                        trackStockView(stock);
                    }} />
                </div>
            </div>

            {/* ── Idea 3: Board section header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-base">📌</span>
                            <h1 className="text-xl font-bold text-white">My Board</h1>
                            {pinned.length > 0 && (
                                <span className="text-xs bg-slate-700 text-slate-400
                                                 px-2 py-0.5 rounded-full font-medium">
                                    {pinned.length} stock{pinned.length !== 1 ? "s" : ""}
                                </span>
                            )}
                            {/* Live indicator */}
                            {pinned.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5
                                                bg-green-900/20 border border-green-500/20
                                                rounded-full">
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full
                                                    animate-pulse" />
                                    <span className="text-green-400 text-[10px] font-semibold">
                                        LIVE
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Drag to reorder · Click card to open chart · Hover to remove
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowSearch(v => !v); setQuery(""); setResults([]); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600
                               hover:bg-blue-700 text-white text-sm font-semibold
                               rounded-xl transition-colors"
                >
                    <span className="text-lg leading-none">+</span> Add Stock
                </button>
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
                        <div className="rounded-lg border border-slate-700 overflow-hidden
                                        max-h-60 overflow-y-auto">
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
                                        <span className="text-xs bg-slate-600 text-slate-300
                                                         px-2 py-0.5 rounded">
                                            {s.exchange}
                                        </span>
                                        <button onClick={() => pinStock(s)}
                                                className="text-xs px-3 py-1.5 bg-blue-600
                                                           hover:bg-blue-700 text-white rounded-lg
                                                           font-medium transition-colors">
                                            + Board
                                        </button>
                                        <button onClick={() => handleAddWatchlist(s)}
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
                <div className="bg-slate-800 rounded-2xl border border-slate-700
                                p-16 text-center">
                    <p className="text-5xl mb-4">📌</p>
                    <p className="text-white font-bold text-lg">Your board is empty</p>
                    <p className="text-slate-400 text-sm mt-2 mb-5 max-w-sm mx-auto">
                        Add stocks to your board to see live prices, intraday
                        sparklines and your holding value at a glance.
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
                            onRemove={() => removeFromBoard(stock.symbol)}
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