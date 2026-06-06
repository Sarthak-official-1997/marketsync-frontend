import { useState, useEffect, useRef } from "react";
import {
    getWatchlist, addToWatchlist, removeFromWatchlist, searchStocks,
    getMfWatchlist, addToMfWatchlist, removeFromMfWatchlist, searchMfSchemes,
    getStockChart,
} from "../api/portfolio";
import StockTransactionPanel from "../components/StockTransactionPanel";
import StockQuickMenu   from "../components/StockQuickMenu";
import StockDetailModal from "../components/StockDetailModal";
import MfTransactionPanel    from "../components/MfTransactionPanel";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";
import { useToast } from "../context/ToastContext";
import { getBoardApi } from "../api/board";
import { usePrivacy } from "../context/PrivacyContext";
import DayChangeBadge from "../components/DayChangeBadge";
import StockLogo      from "../components/StockLogo";
import { trackStockView } from "../components/RecentStocksMarquee";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtDate = (d) => {
    if (!d) return "—";
    try { const [y,m,day] = d.toString().split("T")[0].split("-"); return `${day}/${m}/${y}`; }
    catch { return d; }
};


// Groww-style mini sparkline for watchlist rows
function WatchlistSparkline({ symbol, exchange, previousClose, changePercent }) {
    const [points, setPoints] = useState([]);
    const up = parseFloat(changePercent || 0) >= 0;
    const color = up ? "#22c55e" : "#ef4444";
    const W = 120, H = 40;

    useEffect(() => {
        const parse = (res) =>
            (res?.dataPoints || [])
                .filter(p => p.close != null)
                .map(p => ({ v: parseFloat(p.close) }))
                .filter(p => p.v > 0);

        getStockChart(symbol, exchange || "NSE", "5m", "1d")
            .then(res => {
                const pts = parse(res.data);
                if (pts.length > 3) { setPoints(pts); return; }
                return getStockChart(symbol, exchange || "NSE", "1d", "5d")
                    .then(r => setPoints(parse(r.data)))
                    .catch(() => {});
            })
            .catch(() => {});
    }, [symbol]);

    if (points.length < 2) {
        return <div style={{ width: W, height: H }} className="animate-pulse bg-slate-700/30 rounded" />;
    }

    const vals    = points.map(p => p.v);
    const allVals = previousClose > 0 ? [...vals, previousClose] : vals;
    const minV    = Math.min(...allVals);
    const maxV    = Math.max(...allVals);
    const range   = maxV - minV || 1;
    const pad     = H * 0.1;
    const toY     = v => pad + ((maxV - v) / range) * (H - pad * 2);
    const toX     = i => (i / (points.length - 1)) * W;

    const linePts = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(" ");
    const areaPath =
        `M ${toX(0).toFixed(1)},${toY(points[0].v).toFixed(1)} ` +
        points.slice(1).map((p, i) => `L ${toX(i+1).toFixed(1)},${toY(p.v).toFixed(1)}`).join(" ") +
        ` L ${W},${H} L 0,${H} Z`;
    const refY = previousClose > 0 ? toY(previousClose).toFixed(1) : null;
    const fillId = `wl_${symbol}_${up ? "g" : "r"}`;

    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
             preserveAspectRatio="none" style={{ display: "block" }}>
            <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${fillId})`} />
            <polyline points={linePts} fill="none" stroke={color}
                      strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            {refY && (
                <line x1="0" y1={refY} x2={W} y2={refY}
                      stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
            )}
        </svg>
    );
}

export default function WatchlistPage(props) {
    const [superTab, setSuperTab] = useState(props.defaultTab || "stocks");
    const toast = useToast();
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white">Watchlist</h1>
                <p className="text-xs text-slate-500 mt-1">Click any name to view and add transactions</p>
            </div>
            <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                {[{id:"stocks",label:"📈 Stocks"},{id:"mf",label:"📊 Mutual Funds"}].map(t => (
                    <button key={t.id} onClick={() => setSuperTab(t.id)}
                            className={"px-5 py-2 rounded-lg text-sm font-medium transition-colors " +
                            (superTab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}>
                        {t.label}
                    </button>
                ))}
            </div>
            {superTab === "stocks" && <StocksWatchlist toast={toast} />}
            {superTab === "mf"     && <MfWatchlist     toast={toast} />}
        </div>
    );
}

function StocksWatchlist({ toast }) {
    const { hidden: valuesHidden } = usePrivacy();
    const [watchlist,    setWatchlist]   = useState(null);
    const [boardSymbols, setBoardSymbols] = useState(new Set());
    const [loading,      setLoading]     = useState(true);
    const [searchOpen,   setSearchOpen]  = useState(false);
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [activeStock,  setActiveStock] = useState(null);
    const [quickMenuStock, setQuickMenuStock] = useState(null);
    const [chartStock,     setChartStock]     = useState(null);
    const [detailMf, setDetailMf] = useState(null);
    const [dragIdx,  setDragIdx]  = useState(null);
    const [overIdx,  setOverIdx]  = useState(null);
    const [localOrder, setLocalOrder] = useState(null);
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);

    const load = () => {
        getWatchlist()
            .then(res => setWatchlist(res.data))
            .catch(() => toast.error("Failed to load watchlist"))
            .finally(() => setLoading(false));
        getBoardApi()
            .then(res => setBoardSymbols(new Set((res.data || []).map(s => s.symbol))))
            .catch(() => {});
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
        else { setQuery(""); setResults([]); }
    }, [searchOpen]);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try { const res = await searchStocks(q); setResults(res.data.content || []); }
            catch { setResults([]); }
        }, 300);
    };

    const handleAdd = async (stock) => {
        setSearchOpen(false);
        try { await addToWatchlist({ stockId: stock.id }); toast.success(stock.symbol + " added to watchlist"); load(); }
        catch (err) { toast.error(err.userMessage || "Failed to add stock"); }
    };

    const handleRemove = async (item) => {
        try { await removeFromWatchlist(item.id); toast.success(item.stock.symbol + " removed"); load(); }
        catch { toast.error("Failed to remove"); }
    };

    // Priority sort: 1) held stocks, 2) board stocks, 3) rest
    // User drag reorder overrides this once they touch it
    const sortedItems = (() => {
        const raw = watchlist?.items || [];
        if (!raw.length) return raw;
        const held  = raw.filter(i => i.quantityHeld > 0);
        const board = raw.filter(i => !i.quantityHeld && boardSymbols.has(i.stock.symbol));
        const rest  = raw.filter(i => !i.quantityHeld && !boardSymbols.has(i.stock.symbol));
        return [...held, ...board, ...rest];
    })();

    const items = localOrder || sortedItems;

    // Sync localOrder when watchlist loads/reloads (use priority-sorted order)
    useEffect(() => {
        if (watchlist?.items) setLocalOrder(sortedItems);
    }, [watchlist, boardSymbols]);

    const handleDragStart = (i) => setDragIdx(i);
    const handleDragEnd   = ()  => { setDragIdx(null); setOverIdx(null); };
    const handleDragOver  = (i) => setOverIdx(i);
    const handleDrop      = (i) => {
        if (dragIdx === null || dragIdx === i) return;
        const arr = [...items];
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(i, 0, moved);
        setLocalOrder(arr);
        setDragIdx(null); setOverIdx(null);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{items.length} stock{items.length !== 1 ? "s" : ""} watched</p>
                <button onClick={() => setSearchOpen(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    <span className="text-lg leading-none">+</span> Add Stock
                </button>
            </div>

            {searchOpen && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <div className="relative">
                        <input ref={inputRef} type="text" value={query} onChange={e => handleSearch(e.target.value)}
                               placeholder="Search symbol or company name..."
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 pr-10" />
                        <button onClick={() => setSearchOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">✕</button>
                    </div>
                    {results.length > 0 && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                            {results.map(s => (
                                <button key={s.id} type="button" onClick={() => handleAdd(s)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold text-white text-sm">{s.symbol}</span>
                                        <span className="text-slate-400 text-xs ml-2">{s.name}</span>
                                    </div>
                                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">{s.exchange}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && results.length === 0 && (
                        <p className="text-slate-400 text-sm text-center py-3">No results for "{query}"</p>
                    )}
                </div>
            )}

            {loading ? (
                <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : items.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <p className="text-4xl mb-3">👁</p>
                    <p className="text-white font-semibold">No stocks watched yet</p>
                    <p className="text-slate-400 text-sm mt-1 mb-4">Click + Add Stock to start watching</p>
                    <button onClick={() => setSearchOpen(true)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                        + Add Stock
                    </button>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table className="w-full text-sm" style={{minWidth:"600px"}}>
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                            <th className="w-8 px-2 py-3"></th>
                            <th className="text-left px-4 py-3">Stock</th>
                            <th className="text-right px-4 py-3">Price &amp; Change</th>
                            <th className="px-4 py-3 text-center">Chart</th>
                            <th className="text-right px-4 py-3">Since Added</th>
                            <th className="text-center px-4 py-3">Added On</th>
                            <th className="text-center px-4 py-3">Exchange</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((item, idx) => {
                            const chg    = parseFloat(item.currentPrice?.changePercent || 0);
                            const chgAbs = parseFloat(item.currentPrice?.change || 0);
                            const up     = chg >= 0;
                            const isDragging = dragIdx === idx;
                            const isOver     = overIdx === idx && dragIdx !== null && dragIdx !== idx;
                            return (
                                <tr key={item.id}
                                    draggable
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={e => { e.preventDefault(); handleDragOver(idx); }}
                                    onDrop={() => handleDrop(idx)}
                                    className={"border-b border-slate-700/50 transition-all select-none " +
                                    (isDragging ? "opacity-40 bg-slate-700/50 " :
                                        isOver     ? "bg-blue-900/20 border-t-2 border-t-blue-500 " :
                                            "hover:bg-slate-700/30 ")}>
                                    {/* Drag handle */}
                                    <td className="px-2 py-3 text-center">
                                        <div className="flex flex-col gap-0.5 items-center opacity-30
                                                        hover:opacity-70 cursor-grab active:cursor-grabbing">
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"/>
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"/>
                                            </div>
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"/>
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"/>
                                            </div>
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"/>
                                                <div className="w-1 h-1 bg-slate-400 rounded-full"/>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Stock name + logo */}
                                    <td className="px-4 py-3">
                                        <button onClick={() => setQuickMenuStock(item.stock)}
                                                className="text-left group flex items-center gap-2.5">
                                            <div className="relative flex-shrink-0">
                                                <StockLogo symbol={item.stock.symbol} name={item.stock.name} size={34} />
                                                {/* Board indicator dot */}
                                                {boardSymbols.has(item.stock.symbol) && (
                                                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5
                                                                    bg-blue-500 rounded-full border border-slate-800"
                                                         title="On your board" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white group-hover:text-blue-400
                                                                  transition-colors text-sm">{item.stock.symbol}</p>
                                                    {item.quantityHeld > 0 && (
                                                        <span className="text-xs bg-blue-900/30 text-blue-400
                                                                         border border-blue-500/20 px-1.5 py-0.5
                                                                         rounded-lg font-medium">
                                                            {valuesHidden ? "***" : Math.round(parseFloat(item.quantityHeld))} held
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 truncate max-w-[160px]">
                                                    {item.stock.name}
                                                </p>
                                            </div>
                                        </button>
                                    </td>
                                    {/* Price + Change merged */}
                                    <td className="text-right px-4 py-3">
                                        <p className="text-white font-bold text-sm leading-none">
                                            {item.currentPrice ? fmt(item.currentPrice.currentPrice) : "—"}
                                        </p>
                                        {item.currentPrice && (
                                            <div className="flex items-center justify-end gap-1 mt-1">
                                                <span className={"text-[11px] font-bold px-1.5 py-0.5 rounded " +
                                                (up ? "bg-green-500/15 text-green-400"
                                                    : "bg-red-500/15 text-red-400")}>
                                                    {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                                                </span>
                                                <span className={"text-[11px] " + (up ? "text-green-400/70" : "text-red-400/70")}>
                                                    ({up ? "+" : ""}{chgAbs.toFixed(2)})
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    {/* Sparkline chart */}
                                    <td className="px-4 py-2 text-center">
                                        <div className="inline-block">
                                            <WatchlistSparkline
                                                symbol={item.stock.symbol}
                                                exchange={item.stock.exchange}
                                                previousClose={parseFloat(item.currentPrice?.previousClose || 0)}
                                                changePercent={item.currentPrice?.changePercent}
                                            />
                                        </div>
                                    </td>
                                    {/* Since added % */}
                                    <td className="px-4 py-3 text-right">
                                        {item.gainPctSinceAdded != null ? (
                                            <div>
                                                <p className={"text-xs font-bold " +
                                                (parseFloat(item.gainPctSinceAdded) >= 0
                                                    ? "text-green-400" : "text-red-400")}>
                                                    {valuesHidden ? "••••" : (
                                                        (parseFloat(item.gainPctSinceAdded) >= 0 ? "+" : "") +
                                                        parseFloat(item.gainPctSinceAdded).toFixed(2) + "%"
                                                    )}
                                                </p>
                                                <p className="text-slate-600 text-[10px]">since added</p>
                                            </div>
                                        ) : (
                                            <span className="text-slate-700 text-xs">—</span>
                                        )}
                                    </td>
                                    {/* Added on date */}
                                    <td className="px-4 py-3 text-center text-slate-500 text-xs">
                                        {item.addedAt ? fmtDate(item.addedAt.split("T")[0]) : "—"}
                                    </td>
                                    {/* Exchange */}
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[10px] text-slate-500 bg-slate-700/50
                                                         px-1.5 py-0.5 rounded font-medium">
                                            {item.stock.exchange}
                                        </span>
                                    </td>
                                    {/* Remove */}
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRemove(item)}
                                                className="text-slate-600 hover:text-red-400 transition-colors text-xs hover:underline">
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table></div>
                </div>
            )}

            {quickMenuStock && (
                <StockQuickMenu
                    stock={quickMenuStock}
                    onClose={() => setQuickMenuStock(null)}
                    onViewChart={() => {
                        trackStockView(quickMenuStock);
                        setChartStock(quickMenuStock);
                    }}
                    onTransact={() => setActiveStock(quickMenuStock)}
                />
            )}
            {chartStock && (
                <StockDetailModal
                    stock={chartStock}
                    onClose={() => setChartStock(null)}
                />
            )}
            {activeStock && (
                <StockTransactionPanel stock={activeStock}
                                       onClose={() => setActiveStock(null)}
                                       onChanged={() => {}} />
            )}
        </div>
    );
}

function MfWatchlist({ toast }) {
    const [items,        setItems]       = useState([]);
    const [loading,      setLoading]     = useState(true);
    const [searchOpen,   setSearchOpen]  = useState(false);
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [activeMf,     setActiveMf]    = useState(null);
    const [detailMf,     setDetailMf]    = useState(null);   // ← this was missing
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);

    const load = () => {
        getMfWatchlist().then(res => setItems(res.data || [])).catch(() => toast.error("Failed to load MF watchlist")).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
        else { setQuery(""); setResults([]); }
    }, [searchOpen]);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try { const res = await searchMfSchemes(q); setResults(res.data.content || []); }
            catch { setResults([]); }
        }, 300);
    };

    const handleAdd = async (scheme) => {
        setSearchOpen(false);
        try { await addToMfWatchlist({ schemeCode: scheme.schemeCode }); toast.success(scheme.schemeName + " added to watchlist"); load(); }
        catch (err) { toast.error(err.userMessage || "Already in watchlist"); }
    };

    const handleRemove = async (item) => {
        try { await removeFromMfWatchlist(item.id); toast.success("Removed from MF watchlist"); load(); }
        catch { toast.error("Failed to remove"); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{items.length} scheme{items.length !== 1 ? "s" : ""} watched</p>
                <button onClick={() => setSearchOpen(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    <span className="text-lg leading-none">+</span> Add Fund
                </button>
            </div>

            {searchOpen && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <div className="relative">
                        <input ref={inputRef} type="text" value={query} onChange={e => handleSearch(e.target.value)}
                               placeholder="Search fund name e.g. HDFC Mid Cap, Mirae..."
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 pr-10" />
                        <button onClick={() => setSearchOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">✕</button>
                    </div>
                    {results.length > 0 && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                            {results.map(s => (
                                <button key={s.schemeCode} type="button" onClick={() => handleAdd(s)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors">
                                    <p className="font-medium text-white text-sm">{s.schemeName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-slate-400 text-xs">{s.fundHouse || "—"}</span>
                                        {s.nav && <span className="text-slate-500 text-xs">NAV ₹{s.nav}</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && results.length === 0 && (
                        <p className="text-slate-400 text-sm text-center py-3">No results for "{query}"</p>
                    )}
                </div>
            )}

            {loading ? (
                <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : items.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-white font-semibold">No MF schemes watched yet</p>
                    <p className="text-slate-400 text-sm mt-1 mb-4">Click + Add Fund to start watching</p>
                    <button onClick={() => setSearchOpen(true)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                        + Add Fund
                    </button>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table className="w-full text-sm" style={{minWidth:"600px"}}>
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                            <th className="text-left px-5 py-3">Scheme</th>
                            <th className="text-left px-5 py-3">Category</th>
                            <th className="text-right px-5 py-3">Latest NAV</th>
                            <th className="text-right px-5 py-3">NAV Date</th>
                            <th className="text-left px-5 py-3">Added On</th>
                            <th className="text-right px-5 py-3">Since Added</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map(item => (
                            <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                <td className="px-5 py-3">
                                    <button onClick={() => setDetailMf({ schemeCode: item.schemeCode, schemeName: item.schemeName, fundHouse: item.fundHouse, nav: item.nav })}
                                            className="text-left group">
                                        <p className="font-semibold text-white group-hover:text-blue-400 transition-colors text-xs max-w-xs truncate" title={item.schemeName}>{item.schemeName}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{item.fundHouse || "—"}</p>
                                    </button>
                                </td>
                                <td className="px-5 py-3 text-slate-400 text-xs">{item.schemeCategory || "—"}</td>
                                <td className="text-right px-5 py-3 text-white font-semibold">{item.nav ? "₹" + item.nav : "—"}</td>
                                <td className="text-right px-5 py-3 text-slate-400 text-xs">{fmtDate(item.navDate)}</td>
                                <td className="px-5 py-3 text-slate-500 text-xs">
                                    {item.addedAt ? fmtDate(item.addedAt.toString().split("T")[0]) : "—"}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button onClick={() => handleRemove(item)}
                                            className="text-slate-500 hover:text-red-400 transition-colors text-xs hover:underline">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table></div>
                </div>
            )}

            {detailMf && (
                <MfSchemeDetailModal
                    scheme={detailMf}
                    onClose={() => setDetailMf(null)}
                    onTransact={(s) => {
                        setDetailMf(null);
                        setActiveMf(s);
                    }}
                />
            )}

            {activeMf && (
                <MfTransactionPanel scheme={activeMf}
                                    onClose={() => setActiveMf(null)}
                                    onChanged={() => {}} />
            )}
        </div>
    );
}