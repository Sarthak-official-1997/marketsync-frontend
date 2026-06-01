import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { searchStocks, addToWatchlist, getStockPrice,
    getStockChart, getHoldings, getPortfolioSummary, getIndexChart, getIndices } from "../api/portfolio";
import IndexConstituentsModal from "../components/IndexConstituentsModal";
import StockDetailModal  from "../components/StockDetailModal";
import StockLogo         from "../components/StockLogo";
import { useToast }      from "../context/ToastContext";
import { usePrivacy } from "../context/PrivacyContext";
import { useAuth }       from "../context/AuthContext";
import { addToBoard, removeFromBoard } from "../components/Layout";
import { getBoardApi } from "../api/board";
import { trackStockView } from "../components/RecentStocksMarquee";
import RecentStocksMarquee from "../components/RecentStocksMarquee";


// -- Available indices for board sections ------------------------------------
const AVAILABLE_INDICES = [
    { symbol: "^NSEI",      name: "NIFTY 50",         short: "NIFTY"     },
    { symbol: "^BSESN",     name: "SENSEX",           short: "SENSEX"    },
    { symbol: "^NSEBANK",   name: "BANK NIFTY",       short: "BANKNIFTY" },
    { symbol: "^NSEMDCP50", name: "MIDCAP SELECT",    short: "MIDCAP"    },
    { symbol: "^CNXPHARMA", name: "NIFTY PHARMA",     short: "PHARMA"   },
    { symbol: "^INDIAVIX",  name: "India VIX",        short: "VIX"       },
    { symbol: "^CNXIT",     name: "NIFTY IT",         short: "NIFTYIT"   },
];

// -- Recently visited ----------------------------------------------------------
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

// -- Board sections persistence ------------------------------------------------
const SECTIONS_KEY = "ms_board_sections_v2";



function saveSections(sections, canvasWidth) {
    try {
        const payload = { sections, canvasWidth: canvasWidth || window.innerWidth };
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(payload));
    } catch {}
}

function loadSectionsWithMeta() {
    try {
        const raw = localStorage.getItem(SECTIONS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Support both old format (plain array) and new format ({sections, canvasWidth})
        if (Array.isArray(parsed)) return { sections: parsed, canvasWidth: null };
        return parsed;
    } catch { return null; }
}

// Top 9 NIFTY 50 stocks shown to new users on first board load.
// These are reliably available on NSE and Yahoo Finance.
const NIFTY50_DEFAULT_STOCKS = [
    "RELIANCE", "HDFCBANK", "ICICIBANK", "INFY", "TCS",
    "BAJFINANCE", "SBIN", "AXISBANK", "LT",
];

function makeDefaultSections(pinned) {
    const vw    = Math.max(800, window.innerWidth - 240);
    const col1w = Math.round(vw * 0.55);
    const col2w = Math.round(vw * 0.40);
    const gap   = Math.round(vw * 0.02);

    // For a new user (empty pinned), prefill with 9 NIFTY 50 stocks.
    // For returning users who already have stocks, use their pinned list.
    const boardSymbols = pinned.length > 0
        ? pinned.map(s => s.symbol)
        : NIFTY50_DEFAULT_STOCKS;

    return [
        {
            id:       "sec_default",
            title:    pinned.length > 0 ? "My Board" : "NIFTY 50 — Top Picks",
            symbols:  boardSymbols,
            x: 0, y: 0, w: col1w, h: 340,
            cardScale: 1,
        },
        {
            id:      "sec_indices_default",
            type:    "index",
            title:   "Market Indices",
            // Removed ^NSESMCP (SMALLCAP) — Yahoo Finance symbol unreliable.
            // Use ^CNXIT (NIFTY IT) instead which works consistently.
            indices: ["^NSEI", "^BSESN", "^NSEBANK", "^NSEMDCP50", "^CNXIT"],
            x: col1w + gap, y: 0, w: col2w, h: 420,
            cardScale: 1,
        },
    ];
}

// -- Market status helper ------------------------------------------------------
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

// -- Greeting + Market Status Bar ----------------------------------------------
function GreetingBar({ portfolioSummary }) {
    const { user } = useAuth();
    const { hidden: valuesHidden } = usePrivacy();
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
                            {valuesHidden ? "••••••" : fmt(totalValue)}
                        </p>
                    </div>
                    {dayPL !== 0 && (
                        <div className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
                            dayPLPos
                                ? "bg-green-900/20 border-green-500/30 text-green-400"
                                : "bg-red-900/20 border-red-500/30 text-red-400"
                        }`}>
                            {valuesHidden ? "••••" : (dayPLPos ? "▲ +" : "▼ ") + fmt(Math.abs(dayPL))}
                            <span className="text-xs font-normal ml-1 opacity-70">today</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// -- MiniChart  Groww-style intraday sparkline --------------------------------
// Raw SVG: filled area + dashed prev-close reference line. No axes, no labels.
// points: [{v: number}]  prevClose: number  up: bool
function MiniChart({ points, prevClose, up }) {
    const W = 200, H = 36;
    const color  = up ? "#22c55e" : "#ef4444";
    const fillId = `mc_${up ? "g" : "r"}`;

    if (!points || points.length < 2) {
        return <div className="-mx-2.5 my-1.5 h-9 bg-slate-700/30 animate-pulse rounded" />;
    }

    const vals    = points.map(p => p.v);
    const allVals = prevClose > 0 ? [...vals, prevClose] : vals;
    const minV    = Math.min(...allVals);
    const maxV    = Math.max(...allVals);
    const range   = maxV - minV || 1;
    const pad     = H * 0.1;
    const toY     = v => pad + ((maxV - v) / range) * (H - pad * 2);
    const toX     = i  => (i / (points.length - 1)) * W;

    const linePts = points
        .map((p, i) => `${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`)
        .join(" ");

    const areaPath =
        `M ${toX(0).toFixed(1)},${toY(points[0].v).toFixed(1)} ` +
        points.slice(1).map((p, i) =>
            `L ${toX(i + 1).toFixed(1)},${toY(p.v).toFixed(1)}`
        ).join(" ") +
        ` L ${W},${H} L 0,${H} Z`;

    const refY = prevClose > 0 ? toY(prevClose).toFixed(1) : null;

    return (
        <div className="-mx-2.5 my-1.5" style={{ height: `${H}px` }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
                 preserveAspectRatio="none" style={{ display: "block" }}>
                <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.01" />
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
        </div>
    );
}

// -- Single Stock Card (smaller  fits inside section grids) -------------------
function StockCard({ stock, price, holding, dragging, over,
                       onDragStart, onDragEnd, onDragOver, onDrop,
                       onRemove, onOpen }) {

    const { hidden: valuesHidden } = usePrivacy();

    const [chart, setChart] = useState([]);

    useEffect(() => {
        // Backend wraps points inside { dataPoints: [...] }
        const parsePoints = (res) =>
            (res?.dataPoints || [])
                .filter(p => p.close != null)
                .map(p => ({ v: parseFloat(p.close) }))
                .filter(p => p.v > 0);

        // Try today intraday (5m candles, same as StockDetailModal).
        // If empty  public holiday, pre-market, weekend  fall back to
        // last 5 trading days so the sparkline always shows something.
        getStockChart(stock.symbol, stock.exchange || "NSE", "5m", "1d")
            .then(res => {
                const points = parsePoints(res.data);
                if (points.length > 3) {
                    setChart(points);
                } else {
                    return getStockChart(stock.symbol, stock.exchange || "NSE", "1d", "5d")
                        .then(r => setChart(parsePoints(r.data)))
                        .catch(() => {});
                }
            })
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
            onMouseDown={e => e.stopPropagation()}
            className={
                "relative bg-slate-800 border rounded-xl p-2.5 select-none group " +
                "transition-all cursor-default " +
                (dragging ? "opacity-40 scale-95 " : "") +
                (over
                    ? "border-blue-500 bg-slate-750 "
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

            {/* Row 1  logo + symbol + name */}
            <button onClick={onOpen} className="text-left w-full block pr-4">
                <div className="flex items-center gap-2">
                    <StockLogo symbol={stock.symbol} name={stock.name} size={26} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
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
                        <p className="text-slate-500 text-[10px] mt-0.5 leading-none truncate">
                            {stock.name}
                        </p>
                    </div>
                </div>
            </button>

            {/* Row 2  Groww-style mini chart: area + prev-close reference line, no axes */}
            <MiniChart points={chart} prevClose={parseFloat(price?.previousClose || 0)} up={up} />

            {/* Row 3  price left, % chip right */}
            {cp > 0 ? (
                <div className="flex items-center justify-between gap-1 mt-1">
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
                <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="h-3 w-14 bg-slate-700 rounded animate-pulse" />
                    <div className="h-3 w-10 bg-slate-700 rounded animate-pulse" />
                </div>
            )}

            {/* Holding badge */}
            {holding && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700/50 space-y-0.5">
                    <div className="flex justify-between">
                        <span className="text-slate-600 text-[9px]">Invested</span>
                        <span className="text-slate-300 text-[10px] font-semibold">
                            {valuesHidden ? "••••••" : "₹" + parseFloat(holding.totalInvested || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500 text-[9px]">Current</span>
                        <span className={
                            "text-[10px] font-semibold " +
                            (parseFloat(holding.unrealizedPL || 0) >= 0
                                ? "text-green-400" : "text-red-400")
                        }>
                            {valuesHidden ? "••••••" : "₹" + parseFloat(holding.currentValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}


// -- IndexChart — live sparkline for index sections --------------------------
function IndexChart({ symbol, up }) {
    const [points, setPoints] = useState([]);
    const [prevClose, setPrevClose] = useState(0);
    const W = 260, H = 52;
    const color = up === undefined
        ? (points.length >= 2 && points[points.length-1].v > points[0].v ? "#22c55e" : "#ef4444")
        : (up ? "#22c55e" : "#ef4444");

    const fetchChart = () => {
        const parse = (res) => (res?.dataPoints || [])
            .filter(p => p.close != null)
            .map(p => ({ v: parseFloat(p.close) }))
            .filter(p => p.v > 0);

        getIndexChart(symbol, "5m", "1d")
            .then(res => {
                const pts = parse(res.data);
                if (pts.length > 3) {
                    setPoints(pts);
                    if (res.data?.previousClose) setPrevClose(parseFloat(res.data.previousClose));
                } else {
                    return getIndexChart(symbol, "1d", "5d")
                        .then(r => setPoints(parse(r.data)));
                }
            })
            .catch(() => {});
    };

    useEffect(() => {
        fetchChart();
        // Refresh every 60s during market hours
        const t = setInterval(fetchChart, 60_000);
        return () => clearInterval(t);
    }, [symbol]);

    if (points.length < 2) {
        return <div className="h-[52px] bg-slate-700/20 rounded animate-pulse" />;
    }

    const vals    = points.map(p => p.v);
    const allVals = prevClose > 0 ? [...vals, prevClose] : vals;
    const minV    = Math.min(...allVals);
    const maxV    = Math.max(...allVals);
    const range   = maxV - minV || 1;
    const pad     = H * 0.08;
    const toY     = v => pad + ((maxV - v) / range) * (H - pad * 2);
    const toX     = i => (i / (points.length - 1)) * W;

    const linePts = points.map((p, i) =>
        `${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(" ");
    const areaPath =
        `M ${toX(0).toFixed(1)},${toY(points[0].v).toFixed(1)} ` +
        points.slice(1).map((p, i) =>
            `L ${toX(i+1).toFixed(1)},${toY(p.v).toFixed(1)}`).join(" ") +
        ` L ${W},${H} L 0,${H} Z`;
    const refY = prevClose > 0 ? toY(prevClose).toFixed(1) : null;
    const fillId = `ic_${symbol.replace(/[^a-z0-9]/gi, "_")}`;

    return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
             preserveAspectRatio="none" style={{ display: "block" }}>
            <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.01" />
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

// -- IndexCard — single index display card for inside IndexSection -----------
function IndexCard({ symbol, name, short, onClick }) {
    const [data, setData] = useState(null);

    const fetchData = () => {
        getIndices()
            .then(res => {
                const idx = (res.data || []).find(i => i.symbol === symbol);
                if (idx) setData(idx);
            })
            .catch(() => {});
    };

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 30_000);
        return () => clearInterval(t);
    }, [symbol]);

    const chg = parseFloat(data?.changePercent || 0);
    const up  = chg >= 0;
    const val = data?.value;

    return (
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col gap-1.5
                        cursor-pointer hover:border-blue-500/40 hover:bg-slate-800
                        transition-all group"
             onClick={onClick}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-white font-bold text-xs">{short}</p>
                    <p className="text-slate-500 text-[9px] truncate max-w-[90px]">{name}</p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    up ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}>
                    {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                </span>
            </div>
            <IndexChart symbol={symbol} up={up} />
            <div className="flex items-center justify-between">
                <span className="text-white font-bold text-sm">
                    {val != null
                        ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(val)
                        : <span className="h-4 w-16 bg-slate-700 rounded animate-pulse inline-block" />}
                </span>
                <span className={`text-xs font-semibold ${up ? "text-green-400" : "text-red-400"}`}>
                    {up ? "+" : ""}{chg.toFixed(2)}%
                </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-blue-400">View constituents</span>
                <span className="text-[9px] text-blue-400">›</span>
            </div>
        </div>
    );
}

// -- SectionScrollArea  natural height, scrolls only when content overflows ---
function SectionScrollArea({ children, minH }) {
    return (
        <div style={{
            overflowY:       "auto",
            overflowX:       "hidden",
            minHeight:       `${minH || 160}px`,
            scrollbarWidth:  "thin",
            scrollbarColor:  "#334155 transparent",
            WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
            maskImage:       "linear-gradient(to bottom, black 80%, transparent 100%)",
        }}>
            {children}
        </div>
    );
}

// -- BoardSection  one named, resizable, draggable section --------------------
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
    const debRef         = useRef(null);
    const searchPanelRef = useRef(null);
    const sectionRef     = useRef(null);
    const toast = useToast();

    const x = section.x || 0;
    const y = section.y || 0;
    const w = section.w || 420;
    const h = section.h || 260;

    // Card columns based on section pixel width AND cardScale
    // cardScale: 0.5=tiny 0.75=small 1=normal 1.25=large 1.5=xl
    const cardScale  = section.cardScale || 1;
    // Higher scale = fewer columns (cards take more space)
    const scaledW    = w / cardScale;
    const innerCols  = scaledW < 280 ? "grid-cols-1"
        : scaledW < 460 ? "grid-cols-2"
            : scaledW < 680 ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";

    useEffect(() => { setTitleDraft(section.title); }, [section.title]);

    const commitTitle = () => {
        setEditingTitle(false);
        const t = titleDraft.trim() || "Untitled";
        setTitleDraft(t);
        onUpdateSection(section.id, { title: t });
    };

    const closeSearch = () => { setShowSearch(false); setQuery(""); setResults([]); };

    useEffect(() => {
        if (!showSearch) return;
        const handle = (e) => {
            if (searchPanelRef.current && !searchPanelRef.current.contains(e.target))
                closeSearch();
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [showSearch]);

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
        // Stubs (negative id) are display-only and not real board entries
        const alreadyPinned = allPinned.some(p => p.symbol === s.symbol && (p.id || 0) > 0);
        if (!alreadyPinned) await addToBoard(s);
        onUpdateSection(section.id, { symbols: [...section.symbols, s.symbol] });
        setShowSearch(false); setQuery(""); setResults([]);
        toast.success(`${s.symbol} added`);
    };

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

    // -- Drag to move the whole section ----------------------------------------
    const startDrag = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest("[data-resize]") || e.target.closest("[data-search]") ||
            e.target.closest("input") || e.target.closest("button")) return;
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        const origX = section.x || 0, origY = section.y || 0;
        const canvas = sectionRef.current?.parentElement;
        const onMove = (me) => {
            const maxX = canvas ? canvas.offsetWidth - w : 9999;
            const nx = Math.max(0, Math.min(maxX, origX + me.clientX - startX));
            const ny = Math.max(0, origY + me.clientY - startY);
            onUpdateSection(section.id, { x: Math.round(nx), y: Math.round(ny) });
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // -- Resize from any edge or corner ----------------------------------------
    const HANDLE = 6;
    const startResize = (e, edges) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const origX = section.x || 0, origY = section.y || 0;
        const origW = section.w || 420, origH = section.h || 260;
        const onMove = (me) => {
            const dx = me.clientX - startX, dy = me.clientY - startY;
            const updates = {};
            if (edges.right)  updates.w = Math.max(200, Math.round(origW + dx));
            if (edges.bottom) updates.h = Math.max(120, Math.round(origH + dy));
            if (edges.left) {
                const nw = Math.max(200, Math.round(origW - dx));
                updates.w = nw;
                updates.x = Math.max(0, Math.round(origX + origW - nw));
            }
            if (edges.top) {
                const nh = Math.max(120, Math.round(origH - dy));
                updates.h = nh;
                updates.y = Math.max(0, Math.round(origY + origH - nh));
            }
            onUpdateSection(section.id, updates);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    return (
        <div
            ref={sectionRef}
            className="absolute flex flex-col rounded-2xl bg-slate-800/90
                       border border-slate-700/60 overflow-visible"
            style={{ left: x, top: y, width: w, height: h, zIndex: 10 }}
        >
            {/* Top edge resize */}
            <div data-resize className="absolute left-3 right-3 cursor-ns-resize"
                 style={{ top: -HANDLE/2, height: HANDLE }}
                 onMouseDown={e => startResize(e, { top: true })} />
            {/* Left edge resize */}
            <div data-resize className="absolute top-3 bottom-3 cursor-ew-resize"
                 style={{ left: -HANDLE/2, width: HANDLE }}
                 onMouseDown={e => startResize(e, { left: true })} />
            {/* Right edge resize */}
            <div data-resize className="absolute top-3 bottom-3 cursor-ew-resize group/rr"
                 style={{ right: -HANDLE/2, width: HANDLE }}
                 onMouseDown={e => startResize(e, { right: true })}>
                <div className="absolute inset-y-0 right-0 flex items-center">
                    <div className="w-1 h-8 rounded-full bg-slate-600/0
                                    group-hover/rr:bg-blue-500/60 transition-colors" />
                </div>
            </div>
            {/* Bottom edge resize */}
            <div data-resize className="absolute left-3 right-3 cursor-ns-resize group/rb"
                 style={{ bottom: -HANDLE/2, height: HANDLE }}
                 onMouseDown={e => startResize(e, { bottom: true })}>
                <div className="absolute inset-x-0 bottom-0 flex justify-center">
                    <div className="h-1 w-12 rounded-full bg-slate-600/0
                                    group-hover/rb:bg-blue-500/60 transition-colors" />
                </div>
            </div>
            {/* Corner handles */}
            {[
                { pos: { top:-HANDLE/2, left:-HANDLE/2 },    edges: { top:true, left:true },    cur: "nwse-resize" },
                { pos: { top:-HANDLE/2, right:-HANDLE/2 },   edges: { top:true, right:true },   cur: "nesw-resize" },
                { pos: { bottom:-HANDLE/2, left:-HANDLE/2 }, edges: { bottom:true, left:true }, cur: "nesw-resize" },
                { pos: { bottom:-HANDLE/2, right:-HANDLE/2 },edges: { bottom:true, right:true },cur: "nwse-resize" },
            ].map((corner, i) => (
                <div key={i} data-resize
                     className="absolute w-3 h-3 z-20"
                     style={{ ...corner.pos, cursor: corner.cur }}
                     onMouseDown={e => startResize(e, corner.edges)} />
            ))}

            {/* -- Section Header -- */}
            <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0
                            bg-slate-900/60 border-b border-slate-700/50
                            rounded-t-2xl cursor-move select-none group/header"
                 onMouseDown={startDrag}>
                {/* Grip dots */}
                <div className="flex flex-col gap-[3px] opacity-25
                                group-hover/header:opacity-70 transition-opacity flex-shrink-0">
                    {[0,1,2].map(r => (
                        <div key={r} className="flex gap-[3px]">
                            <div className="w-[3px] h-[3px] bg-slate-400 rounded-full"/>
                            <div className="w-[3px] h-[3px] bg-slate-400 rounded-full"/>
                        </div>
                    ))}
                </div>

                {/* Title */}
                {editingTitle ? (
                    <input autoFocus value={titleDraft}
                           onChange={e => setTitleDraft(e.target.value)}
                           onBlur={commitTitle}
                           onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(section.title); } }}
                           onClick={e => e.stopPropagation()}
                           onMouseDown={e => e.stopPropagation()}
                           className="flex-1 bg-slate-700 border border-blue-500 rounded-lg
                                      px-2 py-0.5 text-white text-sm font-semibold
                                      focus:outline-none min-w-0" />
                ) : (
                    <span className="flex-1 text-white text-sm font-semibold truncate min-w-0"
                          onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}>
                        {section.title}
                    </span>
                )}

                {/* Stock count */}
                <span className="text-[9px] text-slate-500 bg-slate-700/70
                                 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium">
                    {section.symbols.length}
                </span>

                {/* Controls */}
                <div className="flex items-center gap-1 flex-shrink-0
                                opacity-0 group-hover/header:opacity-100 transition-opacity"
                     onMouseDown={e => e.stopPropagation()}>
                    {/* Card size - / + buttons */}
                    <div className="flex items-center gap-0.5 mr-0.5">
                        <button
                            onClick={e => { e.stopPropagation(); onUpdateSection(section.id, { cardScale: Math.max(0.5, parseFloat(((section.cardScale||1) - 0.25).toFixed(2))) }); }}
                            title="Smaller cards"
                            disabled={(section.cardScale||1) <= 0.5}
                            className="w-5 h-5 flex items-center justify-center rounded
                                       text-slate-400 hover:text-white hover:bg-slate-600
                                       disabled:opacity-30 disabled:cursor-not-allowed
                                       text-xs font-bold transition-all">
                            −
                        </button>
                        <span className="text-[9px] text-slate-600 w-5 text-center font-mono">
                            {Math.round((section.cardScale||1)*100)}%
                        </span>
                        <button
                            onClick={e => { e.stopPropagation(); onUpdateSection(section.id, { cardScale: Math.min(2, parseFloat(((section.cardScale||1) + 0.25).toFixed(2))) }); }}
                            title="Larger cards"
                            disabled={(section.cardScale||1) >= 2}
                            className="w-5 h-5 flex items-center justify-center rounded
                                       text-slate-400 hover:text-white hover:bg-slate-600
                                       disabled:opacity-30 disabled:cursor-not-allowed
                                       text-xs font-bold transition-all">
                            ＋
                        </button>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setEditingTitle(true); }}
                            title="Rename"
                            className="w-6 h-6 flex items-center justify-center rounded-lg
                                       text-slate-500 hover:text-blue-400 hover:bg-blue-500/15
                                       hover:ring-1 hover:ring-blue-500/40 text-xs transition-all">
                        ✏️
                    </button>
                    <button onClick={e => { e.stopPropagation(); if (showSearch) closeSearch(); else { setShowSearch(true); setQuery(""); setResults([]); } }}
                            title="Add stock"
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg
                                       text-[10px] font-medium transition-all border ${
                                showSearch
                                    ? "bg-blue-600/20 text-blue-300 border-blue-500/50"
                                    : "bg-slate-800 text-slate-300 border-slate-600 hover:text-white hover:border-slate-500"
                            }`}>
                        <span className="font-bold">＋</span>
                        <span>Add stock</span>
                    </button>
                    {!isOnlySection && (
                        <button onClick={e => { e.stopPropagation(); onRemoveSection(section.id); }}
                                title="Remove section"
                                className="w-6 h-6 flex items-center justify-center rounded-lg
                                           text-slate-500 hover:text-red-400 hover:bg-red-500/15
                                           hover:ring-1 hover:ring-red-500/40 text-xs transition-all">
                            🗑
                        </button>
                    )}
                </div>
            </div>

            {/* -- Search panel -- */}
            {showSearch && (
                <div ref={searchPanelRef} data-search
                     className="px-3 pt-2 pb-1.5 bg-slate-900/50 border-b
                                border-slate-700/40 flex-shrink-0"
                     onMouseDown={e => e.stopPropagation()}>
                    <div className="relative">
                        <input autoFocus type="text" value={query}
                               onChange={e => handleSearch(e.target.value)}
                               onKeyDown={e => e.key === "Escape" && closeSearch()}
                               placeholder="Search stock to add..."
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-1.5 pr-8 text-white text-xs focus:outline-none
                                          focus:border-blue-500" />
                        <button onClick={closeSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2
                                           text-slate-500 hover:text-white text-sm
                                           transition-colors leading-none"
                                title="Close">✕</button>
                        {searching && (
                            <div className="absolute right-7 top-1/2 -translate-y-1/2">
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
                                                         px-1.5 py-0.5 rounded">{s.exchange}</span>
                                        <button onClick={() => addStockToThisSection(s)}
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

            {/* -- Cards -- */}
            <div style={{ flex: "1 1 0", overflowY: "auto", overflowX: "hidden", minHeight: 0,
                scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
                {section.symbols.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center
                                    text-slate-600 text-xs gap-2">
                        <span className="text-3xl opacity-30">📌</span>
                        <span>Empty — hover header and click ＋ to add stocks</span>
                    </div>
                ) : (
                    <div className={`grid ${innerCols} gap-2 px-3 py-3`}
                         style={{ transform: `scale(${cardScale})`, transformOrigin: "top left",
                             width: `${(100/cardScale).toFixed(1)}%` }}>
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
            </div>
        </div>
    );
}



// -- IndexSection — freeform board section for index charts ------------------
function IndexSection({ section, onUpdateSection, onRemoveSection, isOnlySection }) {
    const [showPicker,      setShowPicker]      = useState(false);
    const [customSymbol,    setCustomSymbol]    = useState("");
    const [customName,      setCustomName]      = useState("");
    const [constituentSym,  setConstituentSym]  = useState(null);
    const x = section.x || 0, y = section.y || 0;
    const w = section.w || 460, h = section.h || 380;
    const sectionRef = useRef(null);
    const HANDLE = 6;

    const indices   = section.indices   || [];
    const cardScale = section.cardScale || 1;
    const scaledW   = w / cardScale;
    const cols      = scaledW < 320 ? "grid-cols-1" : scaledW < 560 ? "grid-cols-2" : "grid-cols-3";

    const toggleIndex = (sym) => {
        const next = indices.includes(sym)
            ? indices.filter(s => s !== sym)
            : [...indices, sym];
        onUpdateSection(section.id, { indices: next });
    };

    const addCustomIndex = () => {
        const sym = customSymbol.trim().toUpperCase();
        if (!sym) return;
        if (!indices.includes(sym)) {
            onUpdateSection(section.id, { indices: [...indices, sym] });
        }
        setCustomSymbol(""); setCustomName("");
    };

    const startDrag = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest("[data-resize]") || e.target.closest("[data-search]") ||
            e.target.closest("button") || e.target.closest("input")) return;
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        const origX = section.x || 0, origY = section.y || 0;
        const canvas = sectionRef.current?.parentElement;
        const onMove = (me) => {
            const maxX = canvas ? canvas.offsetWidth - w : 9999;
            onUpdateSection(section.id, {
                x: Math.max(0, Math.min(maxX, Math.round(origX + me.clientX - startX))),
                y: Math.max(0, Math.round(origY + me.clientY - startY)),
            });
        };
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const startResize = (e, edges) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const origX = section.x||0, origY = section.y||0, origW = section.w||320, origH = section.h||220;
        const onMove = (me) => {
            const dx = me.clientX - startX, dy = me.clientY - startY;
            const u = {};
            if (edges.right)  u.w = Math.max(200, Math.round(origW + dx));
            if (edges.bottom) u.h = Math.max(120, Math.round(origH + dy));
            if (edges.left)   { u.w = Math.max(200, Math.round(origW - dx)); u.x = Math.max(0, Math.round(origX + origW - u.w)); }
            if (edges.top)    { u.h = Math.max(120, Math.round(origH - dy)); u.y = Math.max(0, Math.round(origY + origH - u.h)); }
            onUpdateSection(section.id, u);
        };
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };


    return (
        <div ref={sectionRef}
             className="absolute flex flex-col rounded-2xl bg-slate-800/90
                        border border-blue-500/20 overflow-visible"
             style={{ left: x, top: y, width: w, height: h, zIndex: 10 }}>
            {/* Resize handles */}
            <div data-resize className="absolute left-3 right-3 cursor-ns-resize" style={{ top: -HANDLE/2, height: HANDLE }} onMouseDown={e => startResize(e, { top: true })} />
            <div data-resize className="absolute top-3 bottom-3 cursor-ew-resize" style={{ left: -HANDLE/2, width: HANDLE }} onMouseDown={e => startResize(e, { left: true })} />
            <div data-resize className="absolute top-3 bottom-3 cursor-ew-resize group/rr" style={{ right: -HANDLE/2, width: HANDLE }} onMouseDown={e => startResize(e, { right: true })}>
                <div className="absolute inset-y-0 right-0 flex items-center"><div className="w-1 h-8 rounded-full bg-slate-600/0 group-hover/rr:bg-blue-500/60 transition-colors"/></div>
            </div>
            <div data-resize className="absolute left-3 right-3 cursor-ns-resize group/rb" style={{ bottom: -HANDLE/2, height: HANDLE }} onMouseDown={e => startResize(e, { bottom: true })}>
                <div className="absolute inset-x-0 bottom-0 flex justify-center"><div className="h-1 w-12 rounded-full bg-slate-600/0 group-hover/rb:bg-blue-500/60 transition-colors"/></div>
            </div>
            {[
                { pos:{top:-HANDLE/2,left:-HANDLE/2},   edges:{top:true,left:true},   cur:"nwse-resize" },
                { pos:{top:-HANDLE/2,right:-HANDLE/2},  edges:{top:true,right:true},  cur:"nesw-resize" },
                { pos:{bottom:-HANDLE/2,left:-HANDLE/2},edges:{bottom:true,left:true},cur:"nesw-resize" },
                { pos:{bottom:-HANDLE/2,right:-HANDLE/2},edges:{bottom:true,right:true},cur:"nwse-resize"},
            ].map((corner,i) => (
                <div key={i} data-resize className="absolute w-3 h-3 z-20"
                     style={{...corner.pos, cursor: corner.cur}}
                     onMouseDown={e => startResize(e, corner.edges)} />
            ))}

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0
                            bg-slate-900/60 border-b border-blue-500/20
                            rounded-t-2xl cursor-move select-none group/header"
                 onMouseDown={startDrag}>
                <div className="flex flex-col gap-[3px] opacity-30 group-hover/header:opacity-70 transition-opacity flex-shrink-0">
                    {[0,1,2].map(r=><div key={r} className="flex gap-[3px]"><div className="w-[3px] h-[3px] bg-slate-400 rounded-full"/><div className="w-[3px] h-[3px] bg-slate-400 rounded-full"/></div>)}
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20
                                 text-blue-400 border border-blue-500/30 font-semibold flex-shrink-0">
                    📊 INDICES
                </span>
                <span className="flex-1 text-white text-sm font-semibold truncate min-w-0">
                    {section.title || "Indices"}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100
                                transition-opacity flex-shrink-0"
                     onMouseDown={e => e.stopPropagation()}>
                    {/* Card size - / + */}
                    <div className="flex items-center gap-0.5 mr-0.5">
                        <button
                            onClick={e => { e.stopPropagation(); onUpdateSection(section.id, { cardScale: Math.max(0.5, parseFloat(((section.cardScale||1) - 0.25).toFixed(2))) }); }}
                            disabled={(section.cardScale||1) <= 0.5}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-400
                                       hover:text-white hover:bg-slate-600 disabled:opacity-30
                                       disabled:cursor-not-allowed text-xs font-bold transition-all">
                            −
                        </button>
                        <span className="text-[9px] text-slate-600 w-5 text-center font-mono">
                            {Math.round((section.cardScale||1)*100)}%
                        </span>
                        <button
                            onClick={e => { e.stopPropagation(); onUpdateSection(section.id, { cardScale: Math.min(2, parseFloat(((section.cardScale||1) + 0.25).toFixed(2))) }); }}
                            disabled={(section.cardScale||1) >= 2}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-400
                                       hover:text-white hover:bg-slate-600 disabled:opacity-30
                                       disabled:cursor-not-allowed text-xs font-bold transition-all">
                            ＋
                        </button>
                    </div>
                    <button data-search
                            onClick={e => { e.stopPropagation(); setShowPicker(v => !v); }}
                            title="Manage indices"
                            className={`w-6 h-6 flex items-center justify-center rounded-lg
                                       text-xs font-bold transition-all ${
                                showPicker
                                    ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/40"
                                    : "text-slate-500 hover:text-blue-400 hover:bg-blue-500/15 hover:ring-1 hover:ring-blue-500/40"
                            }`}>
                        ⚙
                    </button>
                    {!isOnlySection && (
                        <button onClick={e => { e.stopPropagation(); onRemoveSection(section.id); }}
                                className="w-6 h-6 flex items-center justify-center rounded-lg
                                           text-slate-500 hover:text-red-400 hover:bg-red-500/15
                                           hover:ring-1 hover:ring-red-500/40 text-xs transition-all">
                            🗑
                        </button>
                    )}
                </div>
            </div>

            {/* Index picker + custom search */}
            {showPicker && (
                <div data-search
                     className="px-3 py-2.5 bg-slate-900/70 border-b border-blue-500/20
                                flex-shrink-0 space-y-2.5"
                     onMouseDown={e => e.stopPropagation()}>
                    {/* Preset toggles */}
                    <div>
                        <p className="text-slate-500 text-[10px] mb-1.5 font-semibold uppercase tracking-wide">
                            Indian indices
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {AVAILABLE_INDICES.map(idx => (
                                <button key={idx.symbol}
                                        onClick={() => toggleIndex(idx.symbol)}
                                        className={`text-[10px] px-2 py-1 rounded-lg font-semibold
                                                   transition-all border ${
                                            indices.includes(idx.symbol)
                                                ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                                                : "bg-slate-700/50 text-slate-400 border-slate-600/50 hover:border-blue-500/40"
                                        }`}>
                                    {idx.short}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Custom index search */}
                    <div>
                        <p className="text-slate-500 text-[10px] mb-1.5 font-semibold uppercase tracking-wide">
                            Add any index (Yahoo Finance symbol)
                        </p>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={customSymbol}
                                onChange={e => setCustomSymbol(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addCustomIndex()}
                                placeholder="e.g. ^GSPC, ^FTSE, ^DJI"
                                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg
                                           px-2.5 py-1 text-white text-[10px] focus:outline-none
                                           focus:border-blue-500 min-w-0"
                            />
                            <button
                                onClick={addCustomIndex}
                                disabled={!customSymbol.trim()}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                           text-white text-[10px] font-semibold rounded-lg
                                           transition-colors flex-shrink-0">
                                Add
                            </button>
                        </div>
                        <p className="text-slate-700 text-[9px] mt-1">
                            Find symbols at finance.yahoo.com — prefix ^ for indices
                        </p>
                    </div>
                    {/* Active indices list with remove */}
                    {indices.filter(s => !AVAILABLE_INDICES.find(i => i.symbol === s)).length > 0 && (
                        <div>
                            <p className="text-slate-500 text-[10px] mb-1 font-semibold uppercase tracking-wide">
                                Custom
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {indices.filter(s => !AVAILABLE_INDICES.find(i => i.symbol === s)).map(sym => (
                                    <div key={sym}
                                         className="flex items-center gap-1 bg-slate-700/50
                                                    border border-slate-600/50 rounded-lg px-2 py-1">
                                        <span className="text-[10px] text-slate-300 font-semibold">{sym}</span>
                                        <button onClick={() => toggleIndex(sym)}
                                                className="text-slate-500 hover:text-red-400 text-xs leading-none">
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {constituentSym && createPortal(
                <IndexConstituentsModal
                    symbol={constituentSym}
                    onClose={() => setConstituentSym(null)}
                />,
                document.body
            )}
            {/* Index cards */}
            <div style={{ flex:"1 1 0", overflowY:"auto", overflowX:"hidden", minHeight:0,
                scrollbarWidth:"thin", scrollbarColor:"#334155 transparent" }}>
                {indices.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center
                                    text-slate-600 text-xs gap-2">
                        <span className="text-2xl opacity-30">📊</span>
                        <span>Hover header, click ⚙ to manage indices</span>
                    </div>
                ) : (
                    <div className={`grid ${cols} gap-2 p-3`}
                         style={{ transform: `scale(${cardScale})`, transformOrigin: "top left",
                             width: `${(100/cardScale).toFixed(1)}%` }}>
                        {indices.map(sym => {
                            const preset = AVAILABLE_INDICES.find(i => i.symbol === sym);
                            return <IndexCard key={sym} symbol={sym}
                                              name={preset?.name || sym}
                                              short={preset?.short || sym}
                                              onClick={() => setConstituentSym(sym)} />;
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ====================================================================
// Safe array accessor — sections can be null, a {_raw,_savedW} object,
// or an actual array. Always returns an array for safe iteration.
function sectionsArray(sections) {
    if (!sections) return [];
    if (Array.isArray(sections)) return sections;
    return []; // _raw intermediate state — not an array yet
}

export default function StocksMarketPage() {
// ====================================================================

    const [pinned,           setPinned]           = useState([]);
    const [prices,           setPrices]           = useState({});
    const [holdingsMap,      setHoldingsMap]       = useState({});
    const [portfolioSummary, setPortfolioSummary]  = useState(null);
    const [chartStock,       setChartStock]        = useState(null);
    const [sections,         setSections]          = useState(null);
    const [secDragIdx,       setSecDragIdx]        = useState(null);
    const [secOverIdx,       setSecOverIdx]        = useState(null);
    const [boardZoom,        setBoardZoom]         = useState(1);
    const [canvasWidth,      setCanvasWidth]       = useState(null);
    const [boardLoading,     setBoardLoading]      = useState(true);
    const canvasRef     = useRef(null);
    const measureRef    = useRef(null); // always-mounted wrapper for width measurement
    const scalingDone   = useRef(false);
    const toast = useToast();

    // -- Load board from API + initialize sections -----------------------------
    const loadBoard = (isUpdate = false) =>
        getBoardApi()
            .then(res => {
                const p = res.data || [];
                setPinned(p);
                setSections(prev => {
                    // On explicit update (ms_board_updated), always refresh pinned
                    // but keep existing section layout — just update symbols list
                    if (isUpdate && prev !== null && !prev._raw) {
                        // A new stock was added — ensure it appears in the default section
                        // if no sections exist yet, create default
                        if (prev.length === 0 && p.length > 0) {
                            return makeDefaultSections(p);
                        }
                        // Otherwise update existing sections with new stock symbols
                        // (addStockToThisSection handles this via onUpdateSection already,
                        //  but for board-level adds via search bar, sync the first section)
                        return prev;
                    }
                    // Initial load
                    if (prev !== null) return prev;
                    const meta = loadSectionsWithMeta();
                    if (meta && meta.sections && meta.sections.length > 0) {
                        // Store raw sections — scaling applied after canvas mounts
                        return { _raw: meta.sections, _savedW: meta.canvasWidth };
                    }
                    if (p.length === 0) {
                        // New user — show default board with NIFTY 50 top stocks.
                        // Populate pinned with stubs so StockCard renders symbol/logo.
                        // These are NOT saved to the board API — user hasn't pinned them.
                        const stubs = NIFTY50_DEFAULT_STOCKS.map((sym, i) => ({
                            id:       -(i + 1), // negative ids = stubs, not real board entries
                            symbol:   sym,
                            name:     sym,
                            exchange: "NSE",
                        }));
                        setPinned(stubs);
                        return makeDefaultSections([]);
                    }
                    return makeDefaultSections(p);
                });
            })
            .catch(() => {})
            .finally(() => setBoardLoading(false));

    // Apply proportional scaling as soon as _raw sections are available.
    // We measure the container width directly from the DOM rather than
    // waiting for ResizeObserver (which can't fire until the canvas renders,
    // creating a deadlock). canvasRef may be null here — use the persistent
    // measureRef wrapper instead, which is always mounted.
    useEffect(() => {
        if (!sections || !sections._raw || scalingDone.current) return;

        // Compute current canvas area width:
        // 1. Try the persistent measureRef wrapper (always mounted)
        // 2. Fall back to window.innerWidth minus sidebar (152px) minus padding (32px)
        const measuredW = measureRef.current?.offsetWidth
            || Math.max(800, window.innerWidth - 152 - 32);

        const savedW   = sections._savedW;
        const currentW = measuredW;
        scalingDone.current = true;

        if (savedW && Math.abs(savedW - currentW) > 50) {
            const ratio = currentW / savedW;
            setSections(sections._raw.map(s => ({
                ...s,
                x: Math.max(0, Math.round((s.x || 0) * ratio)),
                y: Math.max(0, Math.round((s.y || 0) * ratio)),
                w: Math.max(200, Math.round((s.w || 420) * ratio)),
                h: Math.max(120, Math.round((s.h || 260) * ratio)),
            })));
        } else {
            setSections(sections._raw);
        }
    }, [sections]);

    useEffect(() => {
        loadBoard(false);
        const onUpdate = () => loadBoard(true);
        window.addEventListener("ms_board_updated", onUpdate);
        return () => window.removeEventListener("ms_board_updated", onUpdate);
    }, []);

    // ResizeObserver on measureRef — always mounted so always fires.
    // Updates canvasWidth for saveSections persistence (not for initial scaling).
    useEffect(() => {
        if (!measureRef.current) return;
        const ro = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect?.width;
            if (w && w > 100) setCanvasWidth(Math.round(w));
        });
        ro.observe(measureRef.current);
        return () => ro.disconnect();
    }, []);

    // Persist sections — save real canvas width alongside layout
    useEffect(() => {
        if (sections !== null && !sections._raw) {
            const w = canvasWidth || canvasRef.current?.offsetWidth;
            if (w) saveSections(sections, w);
        }
    }, [sections, canvasWidth]);

    // -- Holdings map ----------------------------------------------------------
    useEffect(() => {
        getHoldings()
            .then(res => {
                const map = {};
                (res.data || []).forEach(h => { map[h.stock.symbol] = h; });
                setHoldingsMap(map);
            })
            .catch(() => {});
    }, []);

    // -- Portfolio summary for greeting bar ------------------------------------
    useEffect(() => {
        getPortfolioSummary()
            .then(res => setPortfolioSummary(res.data))
            .catch(() => {});
    }, []);

    // -- Live prices  refresh whenever pinned list changes --------------------
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

    // -- Stock actions ---------------------------------------------------------
    const openStock = (stock) => {
        addToRecentlyVisited(stock);
        trackStockView({
            ...stock,
            changePercent: prices[stock.symbol]?.changePercent ?? null,
            change:        prices[stock.symbol]?.change        ?? null,
        });
        setChartStock(stock);
    };

    // -- Section management ----------------------------------------------------
    const addIndexSection = () => {
        const offset = sectionsArray(sections).length * 32;
        const newSec = {
            id:      `idx_${Date.now()}`,
            type:    "index",
            title:   "Indices",
            indices: ["^NSEI", "^NSEBANK"],
            x: 20 + offset,
            y: 20 + offset,
            w: 380,
            h: 280,
        };
        setSections(prev => [...sectionsArray(prev), newSec]);
    };

    const addSection = () => {
        const offset = sectionsArray(sections).length * 32;
        const newSec = {
            id:      `sec_${Date.now()}`,
            title:   "New Section",
            symbols: [],
            x: 20 + offset,
            y: 20 + offset,
            w: 420,
            h: 260,
            cardScale: 1,
        };
        setSections(prev => [...sectionsArray(prev), newSec]);
    };

    // Generic updater  merges partial fields into the section
    const updateSection = (id, partial) => {
        setSections(prev => {
            const arr = sectionsArray(prev);
            return arr.map(s => s.id === id ? { ...s, ...partial } : s);
        });
        // If symbols changed, sync pinned array too
        if (partial.symbols !== undefined) {
            // Nothing to do with server here  board API is managed per-symbol
        }
    };

    const removeSection = (id) => {
        setSections(prev => sectionsArray(prev).filter(s => s.id !== id));
    };

    // Section drag reorder
    const onSecDragStart = (i) => setSecDragIdx(i);
    const onSecDragEnd   = () => { setSecDragIdx(null); setSecOverIdx(null); };
    const onSecDragOver  = (i) => setSecOverIdx(i);
    const onSecDrop      = (i) => {
        if (secDragIdx === null || secDragIdx === i) return;
        const arr = [...sectionsArray(sections)];
        const [moved] = arr.splice(secDragIdx, 1);
        arr.splice(i, 0, moved);
        setSections(arr);
        setSecDragIdx(null); setSecOverIdx(null);
    };

    // Total unique stocks across all sections (for the LIVE badge count)
    const totalStocks = [...new Set(
        sectionsArray(sections).flatMap(s => s.symbols || [])
    )].length;

    return (
        <div className="space-y-4">

            {/* -- Greeting + market status -- */}
            <GreetingBar portfolioSummary={portfolioSummary} />

            {/* -- Recently viewed marquee -- */}
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

            {/* -- Board header -- */}
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
                        Drag section headers to move · Pull edges to resize
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700
                                    rounded-xl px-2.5 py-1.5">
                        <button
                            onClick={() => setBoardZoom(z => Math.max(0.3, parseFloat((z - 0.1).toFixed(1))))}
                            disabled={boardZoom <= 0.3}
                            className="w-5 h-5 flex items-center justify-center text-slate-400
                                       hover:text-white disabled:opacity-30 text-xs font-bold
                                       transition-colors">
                            −
                        </button>
                        <button
                            onClick={() => setBoardZoom(1)}
                            title="Reset zoom"
                            className="text-[10px] text-slate-400 hover:text-white transition-colors
                                       font-mono w-8 text-center">
                            {Math.round(boardZoom * 100)}%
                        </button>
                        <button
                            onClick={() => setBoardZoom(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}
                            disabled={boardZoom >= 1.5}
                            className="w-5 h-5 flex items-center justify-center text-slate-400
                                       hover:text-white disabled:opacity-30 text-xs font-bold
                                       transition-colors">
                            ＋
                        </button>
                    </div>
                    <button
                        onClick={addIndexSection}
                        className="flex items-center gap-2 px-4 py-2
                                   bg-slate-700/50 hover:bg-blue-600/20
                                   text-slate-400 hover:text-blue-300
                                   text-sm font-semibold rounded-xl
                                   border border-slate-600 hover:border-blue-500/50
                                   transition-all duration-200">
                        📊 Add Index Section
                    </button>
                    <button
                        onClick={addSection}
                        className="flex items-center gap-2 px-4 py-2
                                   bg-blue-600/20 hover:bg-blue-600/40
                                   text-blue-400 hover:text-blue-300
                                   text-sm font-semibold rounded-xl
                                   border border-blue-500/50 hover:border-blue-400
                                   shadow-[0_0_12px_rgba(59,130,246,0.35)]
                                   hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]
                                   transition-all duration-200">
                        ＋ Add Section
                    </button>
                </div>
            </div>

            {/* -- Freeform canvas board -- */}
            {/* Persistent width-measurement wrapper — always mounted so
                ResizeObserver and measureRef.current always work */}
            <div ref={measureRef} className="w-full">
                {boardLoading ? (
                    /* Board is loading — show skeleton so user knows it's coming */
                    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-12
                                flex flex-col items-center justify-center gap-4 min-h-[320px]">
                        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent
                                    rounded-full animate-spin" />
                        <p className="text-slate-500 text-sm">Loading your board...</p>
                    </div>
                ) : (!sections || sections.length === 0) ? (
                    <div className="bg-slate-800 rounded-2xl border border-slate-700
                                p-16 text-center">
                        <p className="text-5xl mb-4">📌</p>
                        <p className="text-white font-bold text-lg">Your board is empty</p>
                        <p className="text-slate-400 text-sm mt-2 mb-6 max-w-sm mx-auto">
                            Create sections to organise your watchlist, swing trades,
                            sector plays, long-term holds, each with live prices and sparklines.
                        </p>
                        <button onClick={addSection}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                       text-sm font-semibold rounded-xl transition-colors">
                            ＋ Add First Section
                        </button>
                    </div>
                ) : sections._raw ? (
                    /* Sections loaded but waiting for canvas width to scale — brief spinner */
                    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-12
                                flex flex-col items-center justify-center gap-4 min-h-[320px]">
                        <div className="w-8 h-8 border-2 border-blue-500/60 border-t-transparent
                                    rounded-full animate-spin" />
                        <p className="text-slate-600 text-xs">Applying layout...</p>
                    </div>
                ) : (() => {
                    const canvasH = sections.reduce((max, s) =>
                        Math.max(max, (s.y || 0) + (s.h || 260) + 40), 360);
                    return (
                        <div ref={canvasRef} className="relative w-full select-none overflow-hidden"
                             style={{ height: (canvasH * boardZoom) + "px" }}>
                            <div style={{
                                transform: `scale(${boardZoom})`,
                                transformOrigin: "top left",
                                width: `${(100 / boardZoom).toFixed(2)}%`,
                                height: canvasH + "px",
                            }}>
                                {sections.map((section) =>
                                    section.type === "index" ? (
                                        <IndexSection
                                            key={section.id}
                                            section={section}
                                            onUpdateSection={updateSection}
                                            onRemoveSection={removeSection}
                                            isOnlySection={sections.length === 1}
                                        />
                                    ) : (
                                        <BoardSection
                                            key={section.id}
                                            section={section}
                                            allPinned={pinned}
                                            prices={prices}
                                            holdingsMap={holdingsMap}
                                            draggingSection={false}
                                            overSection={false}
                                            onSectionDragStart={() => {}}
                                            onSectionDragEnd={() => {}}
                                            onSectionDragOver={() => {}}
                                            onSectionDrop={() => {}}
                                            onUpdateSection={updateSection}
                                            onRemoveSection={removeSection}
                                            onOpenStock={openStock}
                                            isOnlySection={sections.length === 1}
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    );
                })()}

            </div>{/* end measureRef wrapper */}

            {/* -- Stock chart modal — portal so it renders above all layout layers -- */}
            {chartStock && createPortal(
                <StockDetailModal
                    stock={chartStock}
                    onClose={() => setChartStock(null)}
                />,
                document.body
            )}
        </div>
    );
}