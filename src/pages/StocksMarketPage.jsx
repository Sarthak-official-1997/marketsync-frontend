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

// ── Recently visited ──────────────────────────────────────────────────────────
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

// ── Board sections persistence ────────────────────────────────────────────────
const SECTIONS_KEY = "ms_board_sections_v2";

function loadSections() {
    try {
        const raw = localStorage.getItem(SECTIONS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveSections(sections) {
    try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections)); }
    catch {}
}

function makeDefaultSections(pinned) {
    return [{
        id:      "sec_default",
        title:   "My Board",
        symbols: pinned.map(s => s.symbol),
        width:   3,
        height:  240,
        order:   0,
    }];
}

// ── Market status helper ──────────────────────────────────────────────────────
function getMarketStatus() {
    const now  = new Date();
    const ist  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day  = ist.getDay();
    const mins = ist.getHours() * 60 + ist.getMinutes();
    const open    = day >= 1 && day <= 5 && mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
    const preOpen = day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 9 * 60 + 15;
    if (preOpen) return { label: "Pre-Open",     color: "text-amber-400", dot: "bg-amber-400" };
    if (open)    return { label: "Market Open",  color: "text-green-400", dot: "bg-green-400 animate-pulse" };
    return         { label: "Market Closed", color: "text-red-400",   dot: "bg-red-400" };
}

function getGreeting() {
    const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
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

    useEffect(() => {
        const t = setInterval(() => {
            setStatus(getMarketStatus());
            setNow(new Date());
        }, 60_000);
        return () => clearInterval(t);
    }, []);

    const firstName  = user?.fullName?.split(" ")[0] || user?.username || "there";
    const dateStr    = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const totalValue = parseFloat(portfolioSummary?.currentValue || 0);
    const dayPL      = parseFloat(portfolioSummary?.dayPL || 0);
    const dayPLPos   = dayPL >= 0;

    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl px-5 py-4
                        flex items-center justify-between flex-wrap gap-4">
            <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                    {getGreeting()}, {firstName} 👋
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">{dateStr}</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2
                            bg-slate-900/60 rounded-xl border border-slate-700/40">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
                <span className="text-slate-600 text-xs hidden md:block">
                    · NSE / BSE · 9:15 AM – 3:30 PM IST
                </span>
            </div>
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

// ── Single Stock Card — Option A compact ─────────────────────────────────────
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
                "relative bg-slate-800 border rounded-xl p-2.5 select-none group " +
                "transition-all cursor-grab active:cursor-grabbing " +
                (dragging ? "opacity-40 scale-95 " : "") +
                (over
                    ? "border-blue-500 "
                    : "border-slate-700 hover:border-slate-600 ")
            }
        >
            {/* Remove button */}
            <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                className="absolute top-1 right-1 w-4 h-4 rounded opacity-0
                           group-hover:opacity-100 flex items-center justify-center
                           text-slate-500 hover:text-white hover:bg-red-600/70
                           transition-all text-[10px] z-10"
            >✕</button>

            {/* Row 1 — logo + symbol + name */}
            <button onClick={onOpen} className="text-left w-full block mb-1.5 pr-4">
                <div className="flex items-center gap-2">
                    <StockLogo symbol={stock.symbol} name={stock.name} size={26} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-white font-bold text-xs leading-none">
                                {stock.symbol}
                            </span>
                            {stock.exchange && (
                                <span className="text-[9px] text-slate-500 bg-slate-700/50
                                                 px-1 rounded font-medium leading-none py-0.5">
                                    {stock.exchange}
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 text-[10px] mt-0.5 leading-none
                                      truncate">
                            {stock.name}
                        </p>
                    </div>
                </div>
            </button>

            {/* Row 2 — sparkline strip: only renders when data exists, zero dead space */}
            {chart.length > 3 && (
                <div className="h-6 -mx-1 mb-1.5">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart}>
                            <Line
                                type="monotone"
                                dataKey="v"
                                stroke={up ? "#22c55e" : "#ef4444"}
                                strokeWidth={1.5}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Row 3 — price + % chip side by side */}
            {cp > 0 ? (
                <div className="flex items-center justify-between gap-1">
                    <span className="text-white font-bold text-sm leading-none">
                        ₹{cp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                    <span className={
                        "text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 " +
                        (up ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400")
                    }>
                        {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                    </span>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2">
                    <div className="h-3 w-14 bg-slate-700 rounded animate-pulse" />
                    <div className="h-3 w-10 bg-slate-700 rounded animate-pulse" />
                </div>
            )}

            {/* Row 4 — holding info (only when invested) */}
            {holding && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700/40">
                    <div className="flex justify-between">
                        <span className="text-slate-600 text-[9px]">Invested</span>
                        <span className="text-slate-400 text-[10px] font-medium">
                            ₹{parseFloat(holding.totalInvested || 0)
                            .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <div className="flex justify-between mt-0.5">
                        <span className="text-slate-600 text-[9px]">Current</span>
                        <span className={
                            "text-[10px] font-semibold " +
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


// ── FadeScrollBox — scrollable area with top+bottom fade mask ─────────────────
function FadeScrollBox({ children, height }) {
    return (
        <div style={{
            height:          `${height}px`,
            overflowY:       "auto",
            overflowX:       "hidden",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)",
            maskImage:       "linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)",
            scrollbarWidth:  "thin",
            scrollbarColor:  "#334155 transparent",
        }}>
            {children}
        </div>
    );
}

// ── BoardSection — one named, resizable, draggable section ────────────────────
function BoardSection({
                          section, allPinned, prices, holdingsMap,
                          draggingSection, overSection,
                          onSectionDragStart, onSectionDragEnd, onSectionDragOver, onSectionDrop,
                          onUpdateSection, onRemoveSection,
                          onOpenStock, isOnlySection,
                      }) {
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft,   setTitleDraft]   = useState(section.title);
    const [showSearch,   setShowSearch]   = useState(false);
    const [query,        setQuery]        = useState("");
    const [results,      setResults]      = useState([]);
    const [searching,    setSearching]    = useState(false);
    const [dragStockIdx, setDragStockIdx] = useState(null);
    const [overStockIdx, setOverStockIdx] = useState(null);
    const debRef   = useRef(null);
    const height   = section.height || 240;
    const toast    = useToast();

    // Sync title draft if section title changes externally
    useEffect(() => { setTitleDraft(section.title); }, [section.title]);

    const commitTitle = () => {
        setEditingTitle(false);
        const t = titleDraft.trim() || "Untitled";
        setTitleDraft(t);
        onUpdateSection(section.id, { title: t });
    };

    // Stock search within this section
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
            finally  { setSearching(false); }
        }, 300);
    };

    const addStockToThisSection = async (s) => {
        const alreadyInSection = section.symbols.includes(s.symbol);
        if (alreadyInSection) { toast.error(`${s.symbol} already in this section`); return; }
        // Add to board API if not already pinned globally
        const alreadyPinned = allPinned.some(p => p.symbol === s.symbol);
        if (!alreadyPinned) await addToBoard(s);
        onUpdateSection(section.id, { symbols: [...section.symbols, s.symbol] });
        setShowSearch(false); setQuery(""); setResults([]);
        toast.success(`${s.symbol} added`);
    };

    // Stock drag-to-reorder inside this section
    const onStockDragStart = (i) => setDragStockIdx(i);
    const onStockDragEnd   = () => { setDragStockIdx(null); setOverStockIdx(null); };
    const onStockDragOver  = (i) => setOverStockIdx(i);
    const onStockDrop      = (i) => {
        if (dragStockIdx === null || dragStockIdx === i) return;
        const arr = [...section.symbols];
        const [moved] = arr.splice(dragStockIdx, 1);
        arr.splice(i, 0, moved);
        onUpdateSection(section.id, { symbols: arr });
        setDragStockIdx(null); setOverStockIdx(null);
    };

    const removeStockFromSection = (symbol) => {
        onUpdateSection(section.id, {
            symbols: section.symbols.filter(s => s !== symbol),
        });
        removeFromBoard(symbol);
    };

    // Cols inside section based on section width
    const innerCols = section.width === 1 ? "grid-cols-2"
        : section.width === 2 ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";

    return (
        <div
            className={
                "flex flex-col rounded-2xl overflow-hidden transition-all " +
                "bg-slate-800/70 " +
                (draggingSection
                    ? "opacity-40 scale-[0.98] border border-slate-600 "
                    : overSection
                        ? "border-2 border-blue-500/70 "
                        : "border border-slate-700/60 ")
            }
            style={{ gridColumn: `span ${section.width || 2}` }}
            onDragOver={e => { e.preventDefault(); onSectionDragOver(); }}
            onDrop={e => { e.stopPropagation(); onSectionDrop(); }}
        >
            {/* ── Section Header ── */}
            <div
                draggable
                onDragStart={e => { e.stopPropagation(); onSectionDragStart(); }}
                onDragEnd={e => { e.stopPropagation(); onSectionDragEnd(); }}
                className="flex items-center gap-2 px-3 py-2
                           bg-slate-900/60 border-b border-slate-700/50
                           cursor-grab active:cursor-grabbing select-none
                           flex-shrink-0 group/header"
            >
                {/* Drag grip dots */}
                <div className="flex flex-col gap-[3px] opacity-25
                                group-hover/header:opacity-60 transition-opacity flex-shrink-0">
                    {[0,1,2].map(r => (
                        <div key={r} className="flex gap-[3px]">
                            <div className="w-[3px] h-[3px] bg-slate-400 rounded-full"/>
                            <div className="w-[3px] h-[3px] bg-slate-400 rounded-full"/>
                        </div>
                    ))}
                </div>

                {/* Title — editable */}
                {editingTitle ? (
                    <input
                        autoFocus
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={e => {
                            if (e.key === "Enter")  commitTitle();
                            if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(section.title); }
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        className="flex-1 bg-slate-700 border border-blue-500 rounded-lg
                                   px-2 py-0.5 text-white text-sm font-semibold
                                   focus:outline-none min-w-0"
                    />
                ) : (
                    <span className="flex-1 text-white text-sm font-semibold truncate min-w-0">
                        {section.title}
                    </span>
                )}

                {/* Stock count badge */}
                <span className="text-[9px] text-slate-500 bg-slate-700/70
                                 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium">
                    {section.symbols.length}
                </span>

                {/* Action controls — visible on header hover */}
                <div className="flex items-center gap-1
                                opacity-0 group-hover/header:opacity-100
                                transition-opacity flex-shrink-0">

                    {/* Edit title */}
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setEditingTitle(true); }}
                        title="Rename section"
                        className="w-5 h-5 flex items-center justify-center rounded
                                   text-slate-500 hover:text-blue-400 text-xs transition-colors">
                        ✏️
                    </button>

                    {/* Width S / M / L */}
                    {[
                        { w: 1, label: "S", title: "Narrow" },
                        { w: 2, label: "M", title: "Medium" },
                        { w: 3, label: "L", title: "Wide"   },
                    ].map(({ w, label, title }) => (
                        <button
                            key={w}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onUpdateSection(section.id, { width: w }); }}
                            title={title}
                            className={`w-5 h-5 flex items-center justify-center text-[9px]
                                       font-bold rounded transition-colors ${
                                section.width === w
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-500 hover:text-white hover:bg-slate-700"
                            }`}>
                            {label}
                        </button>
                    ))}

                    {/* Add stock */}
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setShowSearch(v => !v); setQuery(""); setResults([]); }}
                        title="Add stock to this section"
                        className="w-5 h-5 flex items-center justify-center rounded
                                   text-slate-500 hover:text-green-400 text-xs transition-colors">
                        ＋
                    </button>

                    {/* Delete section */}
                    {!isOnlySection && (
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onRemoveSection(section.id); }}
                            title="Remove section"
                            className="w-5 h-5 flex items-center justify-center rounded
                                       text-slate-500 hover:text-red-400 text-xs transition-colors">
                            🗑
                        </button>
                    )}
                </div>
            </div>

            {/* ── Inline stock search (opens below header) ── */}
            {showSearch && (
                <div className="px-3 pt-2 pb-1.5 bg-slate-900/50 border-b
                                border-slate-700/40 flex-shrink-0">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onChange={e => handleSearch(e.target.value)}
                            onKeyDown={e => e.key === "Escape" && setShowSearch(false)}
                            placeholder="Search stock to add..."
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                       px-3 py-1.5 text-white text-xs focus:outline-none
                                       focus:border-blue-500"
                        />
                        {searching && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="w-3 h-3 border border-blue-400
                                                border-t-transparent rounded-full animate-spin"/>
                            </div>
                        )}
                    </div>
                    {results.length > 0 && (
                        <div className="mt-1.5 rounded-lg border border-slate-700
                                        overflow-hidden max-h-44 overflow-y-auto">
                            {results.map(s => (
                                <div key={s.id}
                                     className="flex items-center justify-between px-3 py-2
                                                border-b border-slate-700/50 last:border-0
                                                hover:bg-slate-700/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white text-xs font-bold">{s.symbol}</p>
                                        <p className="text-slate-500 text-[10px] truncate">{s.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        <span className="text-[9px] bg-slate-600 text-slate-300
                                                         px-1.5 py-0.5 rounded">
                                            {s.exchange}
                                        </span>
                                        <button
                                            onClick={() => addStockToThisSection(s)}
                                            className="text-[10px] px-2 py-1 bg-blue-600
                                                       hover:bg-blue-700 text-white rounded
                                                       font-medium transition-colors">
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && !searching && results.length === 0 && (
                        <p className="text-slate-600 text-[10px] text-center py-2">
                            No results for "{query}"
                        </p>
                    )}
                </div>
            )}

            {/* ── Cards with fade-scroll ── */}
            <div className="relative flex-1">
                <FadeScrollBox height={height}>
                    {section.symbols.length === 0 ? (
                        <div className="flex flex-col items-center justify-center
                                        text-slate-600 text-xs py-10 gap-2">
                            <span className="text-3xl opacity-30">📌</span>
                            <span>Empty — hover header and click ＋ to add stocks</span>
                        </div>
                    ) : (
                        <div className={`grid ${innerCols} gap-2 px-3 py-3`}>
                            {section.symbols.map((sym, idx) => {
                                const stock = allPinned.find(s => s.symbol === sym);
                                if (!stock) return null;
                                return (
                                    <StockCard
                                        key={sym}
                                        stock={stock}
                                        price={prices[sym]}
                                        holding={holdingsMap[sym] || null}
                                        dragging={dragStockIdx === idx}
                                        over={overStockIdx === idx && dragStockIdx !== null && dragStockIdx !== idx}
                                        onDragStart={() => onStockDragStart(idx)}
                                        onDragEnd={onStockDragEnd}
                                        onDragOver={() => onStockDragOver(idx)}
                                        onDrop={() => onStockDrop(idx)}
                                        onRemove={() => removeStockFromSection(sym)}
                                        onOpen={() => onOpenStock(stock)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </FadeScrollBox>

                {/* ── Height resize handle ── */}
                <div
                    title="Drag to resize"
                    className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize
                               flex items-center justify-center group/resize z-10"
                    onMouseDown={e => {
                        e.preventDefault();
                        const startY = e.clientY;
                        const startH = height;
                        const onMove = (me) => {
                            const newH = Math.max(120, Math.min(600,
                                startH + (me.clientY - startY)));
                            onUpdateSection(section.id, { height: Math.round(newH / 10) * 10 });
                        };
                        const onUp = () => {
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup",   onUp);
                        };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup",   onUp);
                    }}>
                    <div className="w-10 h-1 rounded-full bg-slate-700
                                    group-hover/resize:bg-blue-500/60 transition-colors"/>
                </div>
            </div>
        </div>
    );
}

// ====================================================================
export default function StocksMarketPage() {
// ====================================================================

    const [pinned,           setPinned]           = useState([]);
    const [prices,           setPrices]           = useState({});
    const [holdingsMap,      setHoldingsMap]       = useState({});
    const [portfolioSummary, setPortfolioSummary]  = useState(null);
    const [chartStock,       setChartStock]        = useState(null);
    const [sections,         setSections]          = useState(null); // null = not yet loaded
    const [secDragIdx,       setSecDragIdx]        = useState(null);
    const [secOverIdx,       setSecOverIdx]        = useState(null);
    const toast = useToast();

    // ── Load board from API + initialize sections ─────────────────────────────
    const loadBoard = () =>
        getBoardApi()
            .then(res => {
                const p = res.data || [];
                setPinned(p);
                setSections(prev => {
                    if (prev !== null) return prev;         // already have saved layout
                    const saved = loadSections();
                    if (saved && saved.length > 0) return saved;  // restore from localStorage
                    if (p.length === 0) return [];              // empty board
                    return makeDefaultSections(p);              // first-time migration
                });
            })
            .catch(() => {});

    useEffect(() => {
        loadBoard();
        window.addEventListener("ms_board_updated", loadBoard);
        return () => window.removeEventListener("ms_board_updated", loadBoard);
    }, []);

    // Persist sections to localStorage whenever they change
    useEffect(() => {
        if (sections !== null) saveSections(sections);
    }, [sections]);

    // ── Holdings map ──────────────────────────────────────────────────────────
    useEffect(() => {
        getHoldings()
            .then(res => {
                const map = {};
                (res.data || []).forEach(h => { map[h.stock.symbol] = h; });
                setHoldingsMap(map);
            })
            .catch(() => {});
    }, []);

    // ── Portfolio summary for greeting bar ────────────────────────────────────
    useEffect(() => {
        getPortfolioSummary()
            .then(res => setPortfolioSummary(res.data))
            .catch(() => {});
    }, []);

    // ── Live prices — refresh whenever pinned list changes ────────────────────
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

    // ── Stock actions ─────────────────────────────────────────────────────────
    const openStock = (stock) => {
        addToRecentlyVisited(stock);
        trackStockView({
            ...stock,
            changePercent: prices[stock.symbol]?.changePercent ?? null,
            change:        prices[stock.symbol]?.change        ?? null,
        });
        setChartStock(stock);
    };

    // ── Section management ────────────────────────────────────────────────────
    const addSection = () => {
        const newSec = {
            id:      `sec_${Date.now()}`,
            title:   "New Section",
            symbols: [],
            width:   2,
            height:  240,
            order:   (sections?.length || 0),
        };
        setSections(prev => [...(prev || []), newSec]);
    };

    // Generic updater — merges partial fields into the section
    const updateSection = (id, partial) => {
        setSections(prev => prev.map(s =>
            s.id === id ? { ...s, ...partial } : s
        ));
        // If symbols changed, sync pinned array too
        if (partial.symbols !== undefined) {
            // Nothing to do with server here — board API is managed per-symbol
        }
    };

    const removeSection = (id) => {
        setSections(prev => prev.filter(s => s.id !== id));
    };

    // Section drag reorder
    const onSecDragStart = (i) => setSecDragIdx(i);
    const onSecDragEnd   = () => { setSecDragIdx(null); setSecOverIdx(null); };
    const onSecDragOver  = (i) => setSecOverIdx(i);
    const onSecDrop      = (i) => {
        if (secDragIdx === null || secDragIdx === i) return;
        const arr = [...(sections || [])];
        const [moved] = arr.splice(secDragIdx, 1);
        arr.splice(i, 0, moved);
        setSections(arr);
        setSecDragIdx(null); setSecOverIdx(null);
    };

    // Total unique stocks across all sections (for the LIVE badge count)
    const totalStocks = sections
        ? [...new Set(sections.flatMap(s => s.symbols))].length
        : 0;

    return (
        <div className="space-y-4">

            {/* ── Greeting + market status ── */}
            <GreetingBar portfolioSummary={portfolioSummary} />

            {/* ── Recently viewed marquee ── */}
            <div className="flex items-center bg-slate-900/60 border border-slate-800
                            rounded-xl overflow-hidden">
                <div className="flex-shrink-0 flex items-center gap-2 px-4
                                border-r border-slate-700/60 h-9 bg-slate-800/60">
                    <span className="text-slate-500 text-[10px] font-bold
                                     uppercase tracking-widest whitespace-nowrap">
                        🕐 Recently Viewed
                    </span>
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                    <RecentStocksMarquee onStockClick={(stock) => {
                        setChartStock(stock);
                        trackStockView(stock);
                    }} />
                </div>
            </div>

            {/* ── Board header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-base">📌</span>
                    <h1 className="text-xl font-bold text-white">My Board</h1>
                    {totalStocks > 0 && (
                        <span className="text-xs bg-slate-700 text-slate-400
                                         px-2 py-0.5 rounded-full font-medium">
                            {totalStocks} stock{totalStocks !== 1 ? "s" : ""}
                        </span>
                    )}
                    {totalStocks > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5
                                        bg-green-900/20 border border-green-500/20 rounded-full">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"/>
                            <span className="text-green-400 text-[10px] font-semibold">LIVE</span>
                        </div>
                    )}
                    <p className="text-xs text-slate-600 hidden sm:block">
                        Drag headers to reorder sections · Hover header for controls
                    </p>
                </div>
                <button
                    onClick={addSection}
                    className="flex items-center gap-2 px-4 py-2
                               bg-slate-700 hover:bg-slate-600
                               text-white text-sm font-semibold
                               rounded-xl transition-colors border border-slate-600">
                    ＋ Add Section
                </button>
            </div>

            {/* ── Sections grid or empty state ── */}
            {(!sections || sections.length === 0) ? (
                <div className="bg-slate-800 rounded-2xl border border-slate-700
                                p-16 text-center">
                    <p className="text-5xl mb-4">📌</p>
                    <p className="text-white font-bold text-lg">Your board is empty</p>
                    <p className="text-slate-400 text-sm mt-2 mb-6 max-w-sm mx-auto">
                        Create sections to organise your watchlist — swing trades,
                        sector plays, long-term holds — each with live prices and sparklines.
                    </p>
                    <button
                        onClick={addSection}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                   text-sm font-semibold rounded-xl transition-colors">
                        ＋ Add First Section
                    </button>
                </div>
            ) : (
                <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    {sections.map((section, idx) => (
                        <BoardSection
                            key={section.id}
                            section={section}
                            allPinned={pinned}
                            prices={prices}
                            holdingsMap={holdingsMap}
                            draggingSection={secDragIdx === idx}
                            overSection={
                                secOverIdx === idx &&
                                secDragIdx !== null &&
                                secDragIdx !== idx
                            }
                            onSectionDragStart={() => onSecDragStart(idx)}
                            onSectionDragEnd={onSecDragEnd}
                            onSectionDragOver={() => onSecDragOver(idx)}
                            onSectionDrop={() => onSecDrop(idx)}
                            onUpdateSection={updateSection}
                            onRemoveSection={removeSection}
                            onOpenStock={openStock}
                            isOnlySection={sections.length === 1}
                        />
                    ))}
                </div>
            )}

            {/* ── Stock chart modal ── */}
            {chartStock && (
                <StockDetailModal
                    stock={chartStock}
                    onClose={() => setChartStock(null)}
                />
            )}
        </div>
    );
}