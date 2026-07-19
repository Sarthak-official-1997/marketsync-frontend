import { useState, useEffect, useRef } from "react";
import { useMobile } from "../hooks/useMobile";
import {
    removeFromWatchlist, searchStocks,
    getMfWatchlist, addToMfWatchlist, removeFromMfWatchlist, searchMfSchemes,
    getStockChart,
} from "../api/portfolio";
import {
    getWatchlists, addStockToLists, setItemColor,
    createWatchlist, updateWatchlist, deleteWatchlist,
} from "../api/watchlists";
import StockTransactionPanel from "../components/StockTransactionPanel";
import StockQuickMenu   from "../components/StockQuickMenu";
import StockDetailModal from "../components/StockDetailModal";
import MfTransactionPanel    from "../components/MfTransactionPanel";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";
import { useToast } from "../context/ToastContext";
import { getBoardApi } from "../api/board";
import { usePrivacy } from "../context/PrivacyContext";
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

// Preset colour grades (TradingView-style). Stored on each item as a hex string.
const COLOURS = [
    { key: "red",   hex: "#ef4444" },
    { key: "amber", hex: "#f59e0b" },
    { key: "green", hex: "#22c55e" },
    { key: "blue",  hex: "#3b82f6" },
    { key: "grey",  hex: "#64748b" },
];
const colourRank = (c) => {
    if (!c) return 999;
    const i = COLOURS.findIndex(x => x.hex.toLowerCase() === String(c).toLowerCase());
    return i === -1 ? 998 : i;
};


// Groww-style mini sparkline for watchlist rows
function WatchlistSparkline({ symbol, exchange, previousClose, changePercent, width = 120, height = 40 }) {
    const [points, setPoints] = useState([]);
    const up = parseFloat(changePercent || 0) >= 0;
    const color = up ? "#22c55e" : "#ef4444";
    const W = width, H = height;

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

// ============================================================================
//  SHARED — named-list switcher (All · lists · + New) + sort-by-colour toggle
// ============================================================================
function WatchlistSwitcher({ lists, selectedId, onSelect, onNew, sortByColour, onToggleSort }) {
    const pill = (on, extra = "") =>
        "flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-[6px] rounded-full border transition-colors " +
        (on ? "border-[#7c3aed] text-white " : "border-slate-700 text-slate-400 ") + extra;

    return (
        <div className="flex items-center gap-1.5 px-3 md:px-0 py-2 overflow-x-auto"
             style={{ scrollbarWidth: "none" }}>
            <button onClick={() => onSelect(null)}
                    className={pill(selectedId === null)}
                    style={selectedId === null ? { background: "rgba(124,58,237,.18)" } : { background: "#161d31" }}>
                All
            </button>
            {lists.map(l => (
                <button key={l.id} onClick={() => onSelect(l.id)}
                        className={pill(selectedId === l.id)}
                        style={selectedId === l.id ? { background: "rgba(124,58,237,.18)" } : { background: "#161d31" }}>
                    {l.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />}
                    <span className="whitespace-nowrap">{l.name}</span>
                    <span className="opacity-50">{(l.items || []).length}</span>
                </button>
            ))}
            <button onClick={onNew}
                    className="flex-shrink-0 text-[11px] font-bold px-3 py-[6px] rounded-full border border-dashed border-slate-600 text-slate-400">
                + New
            </button>
            <button onClick={onToggleSort}
                    title="Sort by colour grade"
                    className={"flex-shrink-0 ml-auto text-[11px] font-bold px-3 py-[6px] rounded-full border transition-colors " +
                    (sortByColour ? "border-blue-500/50 text-blue-300" : "border-slate-700 text-slate-500")}
                    style={sortByColour ? { background: "rgba(59,130,246,.12)" } : {}}>
                ⇅ Colour
            </button>
        </div>
    );
}

// Small tappable colour dot shown on each row.
function ColourDot({ color, onTap }) {
    return (
        <button onClick={onTap}
                aria-label="Set colour grade"
                className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 transition-transform active:scale-90"
                style={{ background: color || "transparent", borderColor: color || "#475569" }} />
    );
}

// ============================================================================
//  MOBILE WATCHLIST — STOCKS
// ============================================================================
function MobileStocksWatchlist({ items, loading, boardSymbols, valuesHidden,
                                   onStockTap, onAdd, onRemove, onColourTap }) {
    const [filter, setFilter] = useState("all"); // all | gainers | losers | held

    const filtered = items.filter(item => {
        const chg = parseFloat(item.currentPrice?.changePercent || 0);
        if (filter === "gainers") return chg >= 0;
        if (filter === "losers")  return chg < 0;
        if (filter === "held")    return item.quantityHeld > 0;
        return true;
    });

    return (
        <div className="-mx-4">
            {/* Filter pills */}
            <div className="flex gap-1.5 px-3 py-2 border-b border-slate-800 overflow-x-auto"
                 style={{ scrollbarWidth: "none" }}>
                {[
                    { k: "all",     l: "All"     },
                    { k: "gainers", l: "Gainers" },
                    { k: "losers",  l: "Losers"  },
                    { k: "held",    l: "Held"    },
                ].map(({ k, l }) => (
                    <button key={k} onClick={() => setFilter(k)}
                            className={"flex-shrink-0 text-[9px] font-bold px-2.5 py-[5px] rounded-[11px] border transition-colors " +
                            (filter === k
                                ? "border-[#7c3aed] text-[#b794f6]"
                                : "border-slate-700 text-slate-500")}
                            style={filter === k ? { background: "rgba(124,58,237,.14)" } : { background: "#161d31" }}>
                        {l}
                    </button>
                ))}
                <button onClick={onAdd}
                        className="flex-shrink-0 ml-auto text-[9px] font-bold px-3 py-[5px] rounded-[11px] text-white"
                        style={{ background: "#7c3aed" }}>
                    + Add
                </button>
            </div>

            {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid gap-[10px] px-3.5 py-[11px] border-b border-slate-800/60 items-center animate-pulse"
                         style={{ gridTemplateColumns: "20px 1fr 48px auto" }}>
                        <div className="w-[20px] h-[20px] rounded-[3px] bg-slate-700" />
                        <div><div className="h-[11px] w-3/4 rounded bg-slate-700 mb-1" /><div className="h-[8px] w-1/2 rounded bg-slate-700/60" /></div>
                        <div className="h-[18px] w-12 rounded bg-slate-700/60" />
                        <div className="text-right"><div className="h-[11px] w-12 rounded bg-slate-700 mb-1 ml-auto" /><div className="h-[8px] w-8 rounded bg-slate-700/60 ml-auto" /></div>
                    </div>
                ))
            ) : filtered.length === 0 ? (
                <div className="px-6 py-10 text-center">
                    <p className="text-2xl mb-2">👁</p>
                    <p className="text-slate-400 text-xs">
                        {filter === "all" ? "No stocks watched yet." : `No ${filter} right now.`}
                    </p>
                </div>
            ) : (
                filtered.map(item => {
                    const chg    = parseFloat(item.currentPrice?.changePercent || 0);
                    const cp     = parseFloat(item.currentPrice?.currentPrice || 0);
                    const up     = chg >= 0;
                    const held   = item.quantityHeld > 0;
                    const sinceAdded = item.gainPctSinceAdded != null
                        ? parseFloat(item.gainPctSinceAdded) : null;

                    return (
                        <div key={item.id}
                             className="grid items-center gap-[10px] px-3.5 py-[11px] border-b border-slate-800/60 active:bg-slate-800/40"
                             style={{
                                 gridTemplateColumns: "20px 1fr 48px auto 30px",
                                 borderLeft: item.color ? `3px solid ${item.color}` : "3px solid transparent",
                             }}
                             onClick={() => onStockTap(item.stock)}>
                            <StockLogo symbol={item.stock.symbol} size={20}
                                       className="rounded-[3px] flex-shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[13px] font-extrabold text-white leading-tight flex items-center gap-1.5">
                                    <span className="truncate">{item.stock.symbol}</span>
                                    <ColourDot color={item.color}
                                               onTap={(e) => { e.stopPropagation(); onColourTap(item); }} />
                                    {held && (
                                        <span className="flex-shrink-0 text-[8px] font-bold px-[5px] py-[1px] rounded-[2px]"
                                              style={{ background: "rgba(16,185,129,.16)", color: "#10b981" }}>
                                            HELD
                                        </span>
                                    )}
                                    {boardSymbols.has(item.stock.symbol) && (
                                        <span className="flex-shrink-0 text-[8px] font-bold px-[5px] py-[1px] rounded-[2px]"
                                              style={{ background: "rgba(59,130,246,.16)", color: "#60a5fa" }}>
                                            BOARD
                                        </span>
                                    )}
                                </div>
                                <div className="text-[9px] text-slate-500 truncate leading-tight mt-px">
                                    {sinceAdded != null
                                        ? `since added: ${(sinceAdded >= 0 ? "+" : "") + sinceAdded.toFixed(2) + "%"}`
                                        : item.stock.name}
                                </div>
                            </div>
                            <div className="w-12 h-[18px] flex-shrink-0 overflow-hidden">
                                <WatchlistSparkline
                                    symbol={item.stock.symbol}
                                    exchange={item.stock.exchange}
                                    previousClose={parseFloat(item.currentPrice?.previousClose || 0)}
                                    changePercent={item.currentPrice?.changePercent}
                                    width={48}
                                    height={18}
                                />
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-[13px] font-extrabold text-white tabular-nums leading-tight">
                                    {cp ? "₹" + cp.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                                </div>
                                <div className={"text-[10px] font-bold tabular-nums mt-px " +
                                (up ? "text-green-400" : "text-red-400")}>
                                    {item.currentPrice
                                        ? (up ? "+" : "") + chg.toFixed(2) + "%"
                                        : ""}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                                aria-label={`Remove ${item.stock.symbol} from watchlist`}
                                className="flex-shrink-0 w-[30px] h-[30px] -mr-1 flex items-center
                                           justify-center text-slate-600 active:text-red-400">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    );
                })
            )}
        </div>
    );
}

// ============================================================================
//  MOBILE WATCHLIST — MF  (unchanged)
// ============================================================================
function MobileMfWatchlist({ items, loading, onSchemeTap, onAdd }) {
    return (
        <div className="-mx-4">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">
                    {items.length} scheme{items.length !== 1 ? "s" : ""} watched
                </div>
                <button onClick={onAdd}
                        className="text-[9px] font-bold px-3 py-[5px] rounded-[11px] text-white"
                        style={{ background: "#7c3aed" }}>
                    + Add Fund
                </button>
            </div>

            <div className="grid gap-2 px-3 py-[5px] border-b border-slate-700"
                 style={{ gridTemplateColumns: "14px 1fr auto", background: "#0d1117" }}>
                <div />
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wide">Scheme</div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wide text-right">NAV</div>
            </div>

            {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="grid gap-2 px-3 py-[6px] border-b border-slate-800/60 animate-pulse"
                         style={{ gridTemplateColumns: "14px 1fr auto" }}>
                        <div className="w-[14px] h-[14px] rounded-[3px] bg-slate-700" />
                        <div><div className="h-[9px] w-3/4 rounded bg-slate-700 mb-1" /><div className="h-[7px] w-1/2 rounded bg-slate-700/60" /></div>
                        <div className="h-[9px] w-10 rounded bg-slate-700 ml-auto" />
                    </div>
                ))
            ) : items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                    <p className="text-2xl mb-2">📊</p>
                    <p className="text-slate-400 text-xs">No MF schemes watched yet.</p>
                </div>
            ) : (
                items.map(item => (
                    <div key={item.id}
                         className="grid items-center gap-2 px-3 py-[6px] border-b border-slate-800/60 active:bg-slate-800/40"
                         style={{ gridTemplateColumns: "14px 1fr auto" }}
                         onClick={() => onSchemeTap({
                             schemeCode: item.schemeCode,
                             schemeName: item.schemeName,
                             fundHouse:  item.fundHouse,
                             nav:        item.nav,
                         })}>
                        <div className="w-[14px] h-[14px] rounded-[3px] flex-shrink-0 flex items-center
                                        justify-center text-[6px] font-black text-white"
                             style={{ background: "#7c3aed" }}>
                            {(item.fundHouse || "M").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold text-white truncate leading-tight">
                                {item.schemeName?.length > 24
                                    ? item.schemeName.slice(0, 23) + "…"
                                    : item.schemeName}
                            </div>
                            <div className="text-[8px] text-slate-500 truncate leading-tight mt-px">
                                {item.fundHouse}{item.schemeCategory ? " · " + item.schemeCategory : ""}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-[11px] font-bold text-white tabular-nums">
                                {item.nav ? "₹" + parseFloat(item.nav).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                            </div>
                            <div className="text-[8px] text-slate-500 tabular-nums mt-px">
                                {item.navDate || ""}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

export default function WatchlistPage(props) {
    const [superTab, setSuperTab] = useState(props.defaultTab || "stocks");
    const isMobile = useMobile();
    const toast = useToast();
    return (
        <div className={isMobile ? "" : "space-y-4"}>
            {!isMobile && (
                <div>
                    <h1 className="text-2xl font-bold text-white">Watchlist</h1>
                    <p className="text-xs text-slate-500 mt-1">Click any name to view and add transactions</p>
                </div>
            )}
            {isMobile ? (
                <div className="flex mx-3 mt-[7px] mb-0 rounded-[7px] p-[2px] border border-slate-700"
                     style={{ background: "#161d31" }}>
                    {[{ id: "stocks", l: "Stocks" }, { id: "mf", l: "Mutual Funds" }].map(t => (
                        <button key={t.id} onClick={() => setSuperTab(t.id)}
                                className={"flex-1 text-center text-[9.5px] font-bold py-[5px] rounded-[5px] transition-colors " +
                                (superTab === t.id ? "text-white" : "text-slate-500")}
                                style={superTab === t.id ? { background: "#7c3aed" } : {}}>
                            {t.l}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                    {[{ id: "stocks", label: "📈 Stocks" }, { id: "mf", label: "📊 Mutual Funds" }].map(t => (
                        <button key={t.id} onClick={() => setSuperTab(t.id)}
                                className={"px-5 py-2 rounded-lg text-sm font-medium transition-colors " +
                                (superTab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
            {superTab === "stocks" && <StocksWatchlist toast={toast} isMobile={isMobile} />}
            {superTab === "mf"     && <MfWatchlist     toast={toast} isMobile={isMobile} />}
        </div>
    );
}

// Tiny centred modal for creating / renaming a list.
function ListNameModal({ title, initial = "", onSave, onClose }) {
    const [name, setName] = useState(initial);
    const ref = useRef(null);
    useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);
    return (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-4 w-full max-w-[300px]"
                 onClick={e => e.stopPropagation()}>
                <p className="text-white text-sm font-semibold mb-3">{title}</p>
                <input ref={ref} type="text" value={name}
                       onChange={e => setName(e.target.value)}
                       onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
                       placeholder="List name"
                       className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5
                                  text-white text-sm focus:outline-none focus:border-purple-500 mb-3" />
                <div className="flex gap-2">
                    <button onClick={onClose}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700">
                        Cancel
                    </button>
                    <button onClick={() => name.trim() && onSave(name.trim())}
                            disabled={!name.trim()}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 disabled:opacity-40">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

function StocksWatchlist({ toast, isMobile }) {
    const { hidden: valuesHidden } = usePrivacy();
    const [lists,        setLists]        = useState([]);
    const [selectedId,   setSelectedId]   = useState(null);   // null = "All"
    const [sortByColour, setSortByColour] = useState(false);
    const [boardSymbols, setBoardSymbols] = useState(new Set());
    const [loading,      setLoading]     = useState(true);
    const [searchOpen,   setSearchOpen]  = useState(false);
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [activeStock,  setActiveStock] = useState(null);
    const [quickMenuStock, setQuickMenuStock] = useState(null);
    const [chartStock,     setChartStock]     = useState(null);
    const [colourItem,   setColourItem]  = useState(null);   // item whose colour popover is open
    const [newListOpen,  setNewListOpen] = useState(false);
    const [renameList,   setRenameList]  = useState(null);   // list being renamed
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);

    const load = () => {
        getWatchlists()
            .then(res => setLists(res.data || []))
            .catch(() => toast.error("Failed to load watchlist"))
            .finally(() => setLoading(false));
        getBoardApi()
            .then(res => setBoardSymbols(new Set((res.data || []).map(s => s.symbol))))
            .catch(() => {});
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        const onChanged = () => load();
        window.addEventListener("watchlist:changed", onChanged);
        return () => window.removeEventListener("watchlist:changed", onChanged);
    }, []);
    useEffect(() => {
        if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
        else { setQuery(""); setResults([]); }
    }, [searchOpen]);

    const defaultList  = lists.find(l => l.isDefault) || lists[0];
    const selectedList = selectedId ? lists.find(l => l.id === selectedId) : null;

    // Raw items for the current view. "All" = merged across every list, deduped
    // by symbol (first list that contains it wins its colour).
    const rawItems = (() => {
        if (selectedId) return selectedList?.items || [];
        const seen = new Map();
        lists.forEach(l => (l.items || []).forEach(it => {
            if (!seen.has(it.stock.symbol)) seen.set(it.stock.symbol, it);
        }));
        return [...seen.values()];
    })();

    // Sort: by colour grade, or the default held → board → rest priority.
    const items = (() => {
        const arr = [...rawItems];
        if (sortByColour) {
            return arr.sort((a, b) => colourRank(a.color) - colourRank(b.color));
        }
        const held  = arr.filter(i => i.quantityHeld > 0);
        const board = arr.filter(i => !i.quantityHeld && boardSymbols.has(i.stock.symbol));
        const rest  = arr.filter(i => !i.quantityHeld && !boardSymbols.has(i.stock.symbol));
        return [...held, ...board, ...rest];
    })();

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try { const res = await searchStocks(q); setResults(res.data.content || []); }
            catch { setResults([]); }
        }, 300);
    };

    // Add to the currently-selected list, or the default list when on "All".
    const handleAdd = async (stock) => {
        setSearchOpen(false);
        const targetId = selectedId || defaultList?.id;
        if (!targetId) { toast.error("No list to add to"); return; }
        try {
            await addStockToLists(stock.id, [targetId]);
            toast.success(stock.symbol + " added");
            window.dispatchEvent(new Event("watchlist:changed"));
            load();
        } catch (err) { toast.error(err.userMessage || "Failed to add stock"); }
    };

    const handleRemove = async (item) => {
        try { await removeFromWatchlist(item.id); toast.success(item.stock.symbol + " removed"); load(); }
        catch { toast.error("Failed to remove"); }
    };

    const handleSetColour = async (item, hex) => {
        setColourItem(null);
        try { await setItemColor(item.id, hex); load(); }
        catch { toast.error("Failed to set colour"); }
    };

    const handleCreateList = async (name) => {
        setNewListOpen(false);
        try { const res = await createWatchlist(name); toast.success(`List "${name}" created`); await load(); if (res.data?.id) setSelectedId(res.data.id); }
        catch (err) { toast.error(err.userMessage || "Failed to create list"); }
    };

    const handleRenameList = async (name) => {
        const id = renameList?.id; setRenameList(null);
        if (!id) return;
        try { await updateWatchlist(id, { name, color: undefined }); toast.success("List renamed"); load(); }
        catch (err) { toast.error(err.userMessage || "Failed to rename"); }
    };

    const handleDeleteList = async (list) => {
        if (!window.confirm(`Delete list "${list.name}"? The stocks stay in your other lists.`)) return;
        try { await deleteWatchlist(list.id); toast.success("List deleted"); setSelectedId(null); load(); }
        catch (err) { toast.error(err.userMessage || "Failed to delete"); }
    };

    return (
        <div className={isMobile ? "" : "space-y-3"}>

            {/* Named-list switcher — shared across mobile + desktop */}
            <WatchlistSwitcher
                lists={lists}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onNew={() => setNewListOpen(true)}
                sortByColour={sortByColour}
                onToggleSort={() => setSortByColour(v => !v)}
            />

            {/* Rename / delete for the selected non-default list */}
            {selectedList && !selectedList.isDefault && (
                <div className="flex items-center gap-2 px-3 md:px-0 -mt-1 mb-1">
                    <button onClick={() => setRenameList(selectedList)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-white
                                       border border-slate-700 rounded-lg px-2.5 py-1">
                        ✎ Rename
                    </button>
                    <button onClick={() => handleDeleteList(selectedList)}
                            className="text-[11px] font-semibold text-red-400 hover:text-red-300
                                       border border-red-500/30 rounded-lg px-2.5 py-1">
                        🗑 Delete list
                    </button>
                </div>
            )}

            {/* ── MOBILE ── */}
            {isMobile && (
                <MobileStocksWatchlist
                    items={items}
                    loading={loading}
                    boardSymbols={boardSymbols}
                    valuesHidden={valuesHidden}
                    onStockTap={setQuickMenuStock}
                    onAdd={() => setSearchOpen(v => !v)}
                    onRemove={handleRemove}
                    onColourTap={setColourItem}
                />
            )}

            {/* ── MOBILE add-stock search overlay ── */}
            {isMobile && searchOpen && (
                <div className="fixed inset-0 z-[9000] bg-black/60 backdrop-blur-sm"
                     onClick={() => setSearchOpen(false)}>
                    <div className="bg-slate-900 border-b border-slate-700 p-3"
                         onClick={e => e.stopPropagation()}
                         style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}>
                        <div className="relative">
                            <input ref={inputRef} type="text" value={query}
                                   onChange={e => handleSearch(e.target.value)}
                                   placeholder={selectedList ? `Add to "${selectedList.name}"…` : "Search symbol or company…"}
                                   className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                                              text-white text-sm focus:outline-none focus:border-purple-500 pr-10" />
                            <button onClick={() => setSearchOpen(false)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none">
                                ✕
                            </button>
                        </div>
                        {results.length > 0 && (
                            <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800">
                                {results.map(s => (
                                    <button key={s.id} type="button" onClick={() => handleAdd(s)}
                                            className="w-full text-left px-4 py-3 active:bg-slate-800 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="font-semibold text-white text-sm">{s.symbol}</span>
                                            <span className="text-slate-400 text-xs ml-2">{s.name}</span>
                                        </div>
                                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex-shrink-0">
                                            {s.exchange}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {query.length >= 2 && results.length === 0 && (
                            <p className="text-slate-400 text-sm text-center py-4">No results for "{query}"</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── DESKTOP ── */}
            {!isMobile && (
                <>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">
                            {items.length} stock{items.length !== 1 ? "s" : ""}
                            {selectedList ? ` in ${selectedList.name}` : " watched"}
                        </p>
                        <button onClick={() => setSearchOpen(v => !v)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                            <span className="text-lg leading-none">+</span> Add Stock
                        </button>
                    </div>

                    {searchOpen && (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                            <div className="relative">
                                <input ref={inputRef} type="text" value={query} onChange={e => handleSearch(e.target.value)}
                                       placeholder={selectedList ? `Add to "${selectedList.name}"…` : "Search symbol or company name..."}
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
                            <p className="text-white font-semibold">
                                {selectedList ? `"${selectedList.name}" is empty` : "No stocks watched yet"}
                            </p>
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
                                {items.map((item) => {
                                    const chg    = parseFloat(item.currentPrice?.changePercent || 0);
                                    const chgAbs = parseFloat(item.currentPrice?.change || 0);
                                    const up     = chg >= 0;
                                    return (
                                        <tr key={item.id}
                                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                                            style={{ borderLeft: item.color ? `3px solid ${item.color}` : "3px solid transparent" }}>
                                            {/* Colour dot */}
                                            <td className="px-2 py-3 text-center">
                                                <div className="flex justify-center">
                                                    <ColourDot color={item.color} onTap={() => setColourItem(item)} />
                                                </div>
                                            </td>
                                            {/* Stock name + logo */}
                                            <td className="px-4 py-3">
                                                <button onClick={() => setQuickMenuStock(item.stock)}
                                                        className="text-left group flex items-center gap-2.5">
                                                    <div className="relative flex-shrink-0">
                                                        <StockLogo symbol={item.stock.symbol} name={item.stock.name} size={34} />
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
                </>
            )}

            {/* ── Colour picker overlay (shared) ── */}
            {colourItem && (
                <div className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
                     onClick={() => setColourItem(null)}>
                    <div className="absolute inset-0 bg-black/60" />
                    <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-4 w-full max-w-[240px]"
                         onClick={e => e.stopPropagation()}>
                        <p className="text-white text-sm font-semibold mb-3 text-center">
                            {colourItem.stock.symbol} · colour
                        </p>
                        <div className="flex items-center justify-center gap-3 mb-3">
                            {COLOURS.map(c => (
                                <button key={c.key} onClick={() => handleSetColour(colourItem, c.hex)}
                                        aria-label={c.key}
                                        className={"w-8 h-8 rounded-full border-2 transition-transform active:scale-90 " +
                                        (String(colourItem.color).toLowerCase() === c.hex.toLowerCase()
                                            ? "border-white" : "border-white/10")}
                                        style={{ background: c.hex }} />
                            ))}
                        </div>
                        <button onClick={() => handleSetColour(colourItem, null)}
                                className="w-full text-xs text-slate-400 hover:text-white py-2 rounded-lg border border-slate-700">
                            Clear colour
                        </button>
                    </div>
                </div>
            )}

            {/* ── Create / rename list modals ── */}
            {newListOpen && (
                <ListNameModal title="New watchlist" onSave={handleCreateList} onClose={() => setNewListOpen(false)} />
            )}
            {renameList && (
                <ListNameModal title="Rename list" initial={renameList.name}
                               onSave={handleRenameList} onClose={() => setRenameList(null)} />
            )}

            {/* ── Overlays — shared ── */}
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

function MfWatchlist({ toast, isMobile }) {
    const [items,        setItems]       = useState([]);
    const [loading,      setLoading]     = useState(true);
    const [searchOpen,   setSearchOpen]  = useState(false);
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [activeMf,     setActiveMf]    = useState(null);
    const [detailMf,     setDetailMf]    = useState(null);
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
        <div className={isMobile ? "" : "space-y-3"}>
            {isMobile && (
                <MobileMfWatchlist
                    items={items}
                    loading={loading}
                    onSchemeTap={setDetailMf}
                    onAdd={() => setSearchOpen(v => !v)}
                />
            )}

            {!isMobile && (
                <>
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
                </>
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