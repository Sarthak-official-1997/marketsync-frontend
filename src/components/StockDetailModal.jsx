import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import StockTransactionPanel from "./StockTransactionPanel";
import PriceAlertModal       from "./PriceAlertModal";
import { getHoldings }       from "../api/portfolio";
import StockLogo             from "./StockLogo";
// PIECE 1: Fixed imports to include removeFromWatchlist (and optionally getWatchlist if needed by your API)
import { getStockPrice, getStockReturns, getStockChart, addToWatchlist, removeFromWatchlist } from "../api/portfolio";
import { useToast } from "../context/ToastContext";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { addToBoard, removeFromBoard } from "./Layout";
import { getBoardApi } from "../api/board";
import { trackStockView } from "./RecentStocksMarquee";

const fmt = (val, currency = "INR") => {
    if (val == null || isNaN(val)) return "—";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency === "INR" ? "INR" : "USD",
        maximumFractionDigits: 2,
    }).format(val);
};

const fmtPct = (val) => {
    if (val == null) return "—";
    const n = parseFloat(val);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

const clr = (val) => {
    if (val == null) return "text-slate-400";
    return parseFloat(val) >= 0 ? "text-green-400" : "text-red-400";
};

const TIMEFRAMES = [
    { label: "Intraday", desc: "Today · 5-min candles",        interval: "5m",  range: "1d",  intraday: true  },
    { label: "15m",      desc: "Last 5 days · 15-min candles", interval: "15m", range: "5d"                   },
    { label: "1h",       desc: "Last month · 1-hr candles",    interval: "60m", range: "1mo"                  },
    { label: "1D",       desc: "Last 3 months · daily",        interval: "1d",  range: "3mo"                  },
    { label: "1W",       desc: "Last 2 years · weekly",        interval: "1wk", range: "2y"                   },
    { label: "1M",       desc: "All time · monthly",           interval: "1mo", range: "max"                  },
];

// Fixed 30-min tick marks spanning the full NSE session
const INTRADAY_TICKS = [
    "09:15","09:45","10:15","10:45",
    "11:15","11:45","12:15","12:45",
    "13:15","13:45","14:15","14:45",
    "15:15","15:30",
];

const RETURN_PERIODS = [
    { key: "1M", label: "1M" },
    { key: "3M", label: "3M" },
    { key: "6M", label: "6M" },
    { key: "1Y", label: "1Y" },
    { key: "3Y", label: "3Y" },
    { key: "5Y", label: "5Y" },
];

const CustomTooltip = ({ active, payload, label, currency }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 border border-slate-600
                        rounded-xl px-4 py-2.5 shadow-2xl">
            <p className="text-slate-400 text-xs mb-1">{label}</p>
            <p className="text-white font-bold text-base">
                {fmt(payload[0].value, currency)}
            </p>
        </div>
    );
};

export default function StockDetailModal({ stock, onClose }) {
    const [quote,        setQuote]       = useState(null);
    const [returns,      setReturns]     = useState(null);
    const [chartData,    setChartData]   = useState([]);
    const [quoteLoading, setQL]          = useState(true);
    const [txPanel,      setTxPanel]     = useState(null);   // "BUY" | "SELL" | null
    const [alertModal,   setAlertModal]  = useState(false);
    const [heldQty,      setHeldQty]     = useState(null);
    const [retLoading,   setRL]          = useState(true);
    const [chartLoading, setCL]          = useState(true);
    const [showReturns,  setShowReturns] = useState(false);
    const [addingWatch,  setAddingWatch] = useState(false);
    const [onBoard,      setOnBoard]      = useState(false);
    const [activeIdx,    setActiveIdx]   = useState(null);
    const [showSectionPicker, setShowSectionPicker] = useState(false);
    const [boardSections,     setBoardSections]     = useState([]);

    // PIECE 2: Declared missing reactive state variables for Watchlist functionality
    const [inWatchlist, setInWatchlist]         = useState(false);
    const [watchlistItemId, setWatchlistItemId] = useState(null);
    // verticalPadding: controls Y-axis zoom via the chart slider (0.002=Tight → 0.08=Wide)
    const [verticalPadding, setVerticalPadding] = useState(0.01);

    const toast = useToast();
    const isMobile = useMobile();

    // Default: Intraday when market is open (Mon-Fri 09:15-15:30 IST), else 1D
    const [tf, setTf] = useState(() => {
        const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const day = ist.getDay();
        const min = ist.getHours() * 60 + ist.getMinutes();
        const marketOpen = day >= 1 && day <= 5 && min >= 9 * 60 + 15 && min <= 15 * 60 + 30;
        return marketOpen ? TIMEFRAMES[0] : TIMEFRAMES[3];
    });

    // PIECE 3: Updated initialization effect to handle incoming watchlist state properties
    useEffect(() => {
        if (!stock) return;
        setQuote(null); setReturns(null); setChartData([]);
        setQL(true); setRL(true);

        getStockPrice(stock.symbol)
            .then(r => {
                setQuote(r.data);
                // Silently parse if backend tells us it's already watchlisted in the payload
                if (r.data?.inWatchlist !== undefined) {
                    setInWatchlist(r.data.inWatchlist);
                    setWatchlistItemId(r.data.watchlistItemId || null);
                }
                // ── Always re-save to recently viewed with fresh % data ──
                // Works regardless of how the modal was opened (marquee, watchlist,
                // board, search — all go through here)
                trackStockView({
                    id:            stock.id,
                    symbol:        stock.symbol,
                    name:          stock.name,
                    exchange:      stock.exchange,
                    changePercent: r.data?.changePercent ?? null,
                    change:        r.data?.change        ?? null,
                });
            })
            .catch(() => setQuote(null))
            .finally(() => setQL(false));

        getStockReturns(stock.symbol, stock.exchange)
            .then(r => setReturns(r.data)).catch(() => setReturns(null))
            .finally(() => setRL(false));
    }, [stock?.symbol]);

    useEffect(() => {
        if (!stock) return;
        setCL(true); setChartData([]);
        getStockChart(stock.symbol, stock.exchange, tf.interval, tf.range)
            .then(r => {
                // Raw points from backend — timeLabel = "HH:mm" for intraday
                const raw = (r.data?.dataPoints || [])
                    .filter(p => p.close != null)
                    .map(p => ({
                        date:  p.timeLabel || p.date,
                        close: parseFloat(p.close),
                    }));

                let pts = raw;

                if (tf.intraday) {
                    // Build the FULL 09:15-15:30 slot grid (75 × 5-min slots).
                    // Future slots get close=null so the line stops at current time
                    // but the X-axis extends to 15:30 — matching how broker apps look.
                    const slots = [];
                    for (let m = 9 * 60 + 15; m <= 15 * 60 + 30; m += 5) {
                        slots.push(
                            String(Math.floor(m / 60)).padStart(2, "0") + ":" +
                            String(m % 60).padStart(2, "0")
                        );
                    }
                    const dataMap = {};
                    raw.forEach(p => { dataMap[p.date] = p.close; });
                    pts = slots.map(time => ({ date: time, close: dataMap[time] ?? null }));
                } else {
                    // For multi-day timeframes (15m, 1h, 1D, 1W, 1M):
                    // Filter out any null/missing points so there are no gaps between
                    // trading sessions. Recharts activeDot freezes at the last real
                    // point before a null — removing nulls fixes the stuck dot bug.
                    pts = raw.filter(p => p.close != null);
                }

                setChartData(pts);
            })
            .catch(() => setChartData([]))
            .finally(() => setCL(false));
    }, [stock?.symbol, tf]);

    useEffect(() => {
        if (!stock?.symbol) return;
        const checkBoard = () => {
            getBoardApi()
                .then(res => setOnBoard((res.data || []).some(s => s.symbol === stock.symbol)))
                .catch(() => {});
            // Load sections from localStorage for section picker
            try {
                const raw = localStorage.getItem("ms_board_sections_v2");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const secs = Array.isArray(parsed) ? parsed : (parsed.sections || []);
                    setBoardSections(secs.filter(s => s.type !== "index" && s.title));
                }
            } catch {}
        };
        checkBoard();
        window.addEventListener("ms_board_updated", checkBoard);
        return () => window.removeEventListener("ms_board_updated", checkBoard);
    }, [stock?.symbol]);

    // Fetch user holdings to know if SELL button should show + hint in form
    useEffect(() => {
        if (!stock?.symbol) return;
        getHoldings().then(res => {
            const h = (res.data || []).find(h => h.stock?.symbol === stock.symbol);
            setHeldQty(h ? parseFloat(h.quantity || 0) : 0);
        }).catch(() => {});
    }, [stock?.symbol]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    if (!stock) return null;

    const pl        = parseFloat(quote?.changePercent || 0);
    const isPos     = pl >= 0;
    const plClr     = isPos ? "text-green-400" : "text-red-400";
    const tvUrl     = "https://www.tradingview.com/chart/?symbol="
        + (stock.exchange || "NSE") + ":" + stock.symbol + "&interval=W";

    // Chart derived values — ignore null slots when computing direction/firstPrice
    const realPts    = chartData.filter(p => p.close != null);
    const isUp       = realPts.length >= 2
        && realPts[realPts.length - 1].close >= realPts[0].close;
    const lineColor  = isUp ? "#22c55e" : "#ef4444";
    const firstPrice = realPts.length > 0 ? realPts[0].close : null;

    const periodChange = realPts.length >= 2
        ? (((realPts[realPts.length - 1].close - realPts[0].close)
            / realPts[0].close) * 100).toFixed(2)
        : null;

    const returnsOk = returns?.dataReliable === true
        && returns?.returns
        && Object.keys(returns.returns).length > 0;

    // Y-axis domain: uses verticalPadding so the slider controls zoom level
    // Tight (0.002) = price fills the chart, Wide (0.08) = more breathing room
    const yDomain = realPts.length > 0
        ? [
            () => Math.min(...realPts.map(p => p.close)) * (1 - verticalPadding),
            () => Math.max(...realPts.map(p => p.close)) * (1 + verticalPadding),
        ]
        : ["auto", "auto"];

    // ── RENDER ─────────────────────────────────────────────────────────────────
    // FIX: wrap everything in <> so txPanel and alertModal can be siblings of
    // the main modal div within the same return statement.
    return createPortal(
        <>
            {/* On mobile: align to bottom so it feels like a sheet, not a floating dialog.
                On desktop: center it. items-end on mobile allows the sheet to sit flush
                at the bottom edge (though we use 100dvh so it covers everything anyway). */}
            <div
                className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
                onClick={onClose}
            >
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                <div
                    className="relative z-50 bg-slate-900 flex flex-col"
                    style={isMobile ? {
                        // Full-screen on mobile: no 16px gaps on sides that cause the
                        // chart container to be ~350px wide instead of ~390px, which
                        // made the Recharts ResponsiveContainer think it had less space
                        // and rendered the chart clipped/bleeding outside its box.
                        // 100dvh = dynamic viewport height (accounts for browser chrome).
                        // safe-area-inset-* = notch/home-bar padding on iPhone.
                        width: "100vw",
                        height: "100dvh",
                        maxWidth: "100vw",
                        maxHeight: "100dvh",
                        borderRadius: 0,
                        border: "none",
                        paddingTop: "env(safe-area-inset-top, 0px)",
                        paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    } : {
                        width: "calc(100vw - 32px)",
                        height: "calc(100vh - 32px)",
                        maxWidth: "1200px",
                        maxHeight: "960px",
                        borderRadius: "20px",
                        border: "1px solid rgba(71,85,105,0.6)",
                        boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* ── TOP BAR ── */}
                    {isMobile ? (
                        /* ── Mobile top bar — FIXED, never scrolls ──
                           Row 1: logo · symbol · price · BUY · SELL · ✕
                           Row 2: secondary actions (Watch, Board, TradingView, Alert) — scrollable
                           BUY and SELL are in row 1 so they are ALWAYS visible regardless of
                           how far the user has scrolled the chart/returns below. */
                        <div className="flex-shrink-0 border-b border-slate-700/60 px-3 pt-3 pb-2">

                            {/* Row 1: identity + price + primary CTAs + close */}
                            <div className="flex items-center gap-2 mb-2.5">
                                <StockLogo symbol={stock.symbol} name={stock.name} size={30} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-white font-bold text-sm leading-none">
                                            {stock.symbol}
                                        </span>
                                        <span className="text-blue-400 text-[10px] font-semibold
                                                         bg-blue-500/10 px-1 rounded">
                                            {stock.exchange}
                                        </span>
                                    </div>
                                    {quote && !quoteLoading && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-white font-bold text-sm tabular-nums">
                                                {fmt(quote.currentPrice, quote.currency)}
                                            </span>
                                            <span className={"text-[11px] font-semibold tabular-nums " + plClr}>
                                                {isPos ? "+" : ""}{pl.toFixed(2)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {/* BUY — always visible, never in a scroll row */}
                                <button
                                    onClick={e => { e.stopPropagation(); setTxPanel("BUY"); }}
                                    className="flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-lg
                                               bg-green-600 active:bg-green-700 text-white">
                                    BUY
                                </button>
                                {/* SELL — always visible */}
                                <button
                                    onClick={e => { e.stopPropagation(); setTxPanel("SELL"); }}
                                    className="flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-lg
                                               bg-red-600 active:bg-red-700 text-white">
                                    SELL
                                </button>
                                {/* Close */}
                                <button
                                    onClick={onClose}
                                    className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-800
                                               flex items-center justify-center text-slate-400
                                               active:bg-slate-700 text-sm">
                                    ✕
                                </button>
                            </div>

                            {/* Row 2: secondary actions — scrollable horizontally, that's fine */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1"
                                 style={{ scrollbarWidth: "none" }}>
                                <button
                                    onClick={async () => {
                                        setAddingWatch(true);
                                        try {
                                            if (inWatchlist && watchlistItemId) {
                                                await removeFromWatchlist(watchlistItemId);
                                                setInWatchlist(false); setWatchlistItemId(null);
                                                toast.success(`${stock.symbol} removed from watchlist`);
                                            } else {
                                                if (!stock?.id) { toast.error("Missing stock ID"); return; }
                                                const res = await addToWatchlist({ stockId: stock.id });
                                                setInWatchlist(true);
                                                setWatchlistItemId(res.data?.id || null);
                                                toast.success(`${stock.symbol} added to watchlist`);
                                            }
                                        } catch (err) {
                                            const msg = err.response?.data?.message || "";
                                            if (msg.toLowerCase().includes("already")) {
                                                setInWatchlist(true); toast.info("Already in watchlist");
                                            } else { toast.error(msg || "Failed"); }
                                        } finally { setAddingWatch(false); }
                                    }}
                                    disabled={addingWatch}
                                    className={"flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all " +
                                    (inWatchlist ? "bg-green-700 text-white" : "bg-slate-700/80 text-slate-300")}>
                                    {addingWatch ? "…" : inWatchlist ? "✓ Watch" : "👁 Watch"}
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (onBoard) {
                                            await removeFromBoard(stock.symbol);
                                            setOnBoard(false);
                                            toast.success(`${stock.symbol} removed from board`);
                                        } else {
                                            const added = await addToBoard({
                                                id: stock.id, symbol: stock.symbol,
                                                name: stock.name, exchange: stock.exchange,
                                            });
                                            if (added) { setOnBoard(true); toast.success(`${stock.symbol} added to board`); }
                                            else { toast.error(`${stock.symbol} already on board`); }
                                        }
                                    }}
                                    className={"flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all " +
                                    (onBoard ? "bg-purple-700 text-white" : "bg-slate-700/80 text-slate-300")}>
                                    {onBoard ? "✓ Board" : "📌 Board"}
                                </button>
                                <a href={tvUrl} target="_blank" rel="noopener noreferrer"
                                   className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg
                                              bg-blue-600/80 text-white">
                                    TV ↗
                                </a>
                                <button
                                    onClick={e => { e.stopPropagation(); setAlertModal(true); }}
                                    className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg
                                               bg-slate-700/80 text-amber-400">
                                    🔔 Alert
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between
                        px-4 sm:px-7 py-3 sm:py-4 border-b border-slate-700/60
                        flex-shrink-0 gap-2">
                            {/* Left: symbol badge + name */}
                            <div className="flex items-center gap-4">
                                <StockLogo symbol={stock.symbol} name={stock.name} size={48} />
                                <div>
                                    <p className="text-xl font-bold text-white leading-none">
                                        {stock.symbol}
                                    </p>
                                    <span className="text-xs text-blue-400 font-semibold mt-0.5 block">
                                    {stock.exchange}
                                </span>
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-lg">{stock.name}</p>
                                    {stock.sector && (
                                        <p className="text-xs text-slate-400 mt-0.5">{stock.sector}</p>
                                    )}
                                </div>
                            </div>

                            {/* Right: price + action buttons */}
                            <div className="flex items-center gap-3">
                                {quoteLoading ? (
                                    <div className="h-9 w-36 bg-slate-700 rounded animate-pulse" />
                                ) : quote ? (
                                    <div className="text-right mr-2">
                                        <p className="text-3xl font-bold text-white tracking-tight">
                                            {fmt(quote.currentPrice, quote.currency)}
                                        </p>
                                        <p className={"text-sm font-medium " + plClr}>
                                            {isPos ? "▲" : "▼"}{" "}
                                            {fmt(Math.abs(quote.change || 0), quote.currency)}{" "}
                                            ({isPos ? "+" : ""}{pl.toFixed(2)}%) today
                                        </p>
                                    </div>
                                ) : null}

                                {/* Watchlist toggle — green=watchlisted, hover→red to remove */}
                                <button
                                    onClick={async () => {
                                        setAddingWatch(true);
                                        try {
                                            if (inWatchlist && watchlistItemId) {
                                                await removeFromWatchlist(watchlistItemId);
                                                setInWatchlist(false); setWatchlistItemId(null);
                                                toast.success(`${stock.symbol} removed from watchlist`);
                                            } else {
                                                if (!stock?.id) { toast.error("Missing stock ID"); return; }
                                                const res = await addToWatchlist({ stockId: stock.id });
                                                setInWatchlist(true);
                                                setWatchlistItemId(res.data?.id || null);
                                                toast.success(`${stock.symbol} added to watchlist`);
                                            }
                                        } catch (err) {
                                            const msg = err.response?.data?.message || "";
                                            if (msg.toLowerCase().includes("already")) {
                                                setInWatchlist(true); toast.info("Already in watchlist");
                                            } else { toast.error(msg || "Failed"); }
                                        } finally { setAddingWatch(false); }
                                    }}
                                    disabled={addingWatch}
                                    className={
                                        "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold " +
                                        "rounded-xl transition-all whitespace-nowrap disabled:opacity-50 " +
                                        (inWatchlist
                                            ? "bg-green-700 hover:bg-red-700 text-white ring-1 ring-green-500/40"
                                            : "bg-slate-700 hover:bg-slate-600 text-white")
                                    }>
                                    {addingWatch ? "…" : inWatchlist ? "✓ Watchlisted" : "👁 Watchlist"}
                                </button>

                                {/* Add to Board */}
                                <div className="relative">
                                    {/* Section picker dropdown */}
                                    {showSectionPicker && !onBoard && (
                                        <div className="absolute top-full right-0 mt-1 bg-slate-800
                                                border border-slate-700 rounded-xl shadow-xl
                                                z-10 min-w-[180px] overflow-hidden">
                                            <p className="text-[10px] text-slate-500 uppercase
                                                  tracking-wide px-3 py-2 border-b border-slate-700">
                                                Add to section
                                            </p>
                                            {boardSections.map(sec => (
                                                <button key={sec.id}
                                                        onClick={async e => {
                                                            e.stopPropagation();
                                                            setShowSectionPicker(false);
                                                            // Add to board API (pinned list)
                                                            await addToBoard({
                                                                id: stock.id, symbol: stock.symbol,
                                                                name: stock.name, exchange: stock.exchange,
                                                            });
                                                            // Dispatch with target section info
                                                            window.dispatchEvent(new CustomEvent(
                                                                "ms_board_add_to_section",
                                                                { detail: { symbol: stock.symbol, sectionId: sec.id } }
                                                            ));
                                                            setOnBoard(true);
                                                            toast.success(`${stock.symbol} added to "${sec.title}"`);
                                                        }}
                                                        className="w-full text-left px-3 py-2.5 text-sm
                                                           text-slate-300 hover:bg-slate-700
                                                           transition-colors">
                                                    {sec.title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={async e => {
                                            e.stopPropagation();
                                            if (onBoard) {
                                                await removeFromBoard(stock.symbol);
                                                setOnBoard(false);
                                                toast.success(`${stock.symbol} removed from board`);
                                            } else if (boardSections.length > 1) {
                                                // Multiple sections — show picker
                                                setShowSectionPicker(v => !v);
                                            } else {
                                                // Single section or no sections — add directly
                                                const added = await addToBoard({
                                                    id: stock.id, symbol: stock.symbol,
                                                    name: stock.name, exchange: stock.exchange,
                                                });
                                                if (added) {
                                                    setOnBoard(true);
                                                    toast.success(`${stock.symbol} added to board`);
                                                } else {
                                                    toast.error(`${stock.symbol} already on board`);
                                                }
                                            }
                                        }}
                                        className={
                                            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold " +
                                            "rounded-xl transition-all whitespace-nowrap " +
                                            (onBoard
                                                ? "bg-purple-700 hover:bg-red-700 text-white ring-1 ring-purple-500/40"
                                                : "bg-slate-700 hover:bg-purple-600 text-white")
                                        }>
                                        {onBoard ? "✓ On Board" : boardSections.length > 1 && !onBoard ? "📌 Board ▾" : "📌 Board"}
                                    </button>
                                </div>

                                {/* TradingView */}
                                <a href={tvUrl} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center gap-2 px-4 py-2.5
                                          bg-blue-600 hover:bg-blue-700 text-white
                                          text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
                                    <svg xmlns="http://www.w3.org/2000/svg"
                                         className="w-4 h-4" viewBox="0 0 24 24"
                                         fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5 a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                    TradingView
                                </a>

                                {/* Alert bell — glows on hover */}
                                <button
                                    onClick={e => { e.stopPropagation(); setAlertModal(true); }}
                                    title="Set price alert"
                                    className="p-2.5 bg-slate-700/60 hover:bg-amber-500
                                           text-amber-400 hover:text-white rounded-xl transition-all
                                           hover:ring-2 hover:ring-amber-400/60
                                           hover:shadow-lg hover:shadow-amber-500/30 text-base">
                                    🔔
                                </button>

                                {/* BUY — always visible */}
                                <button
                                    onClick={e => { e.stopPropagation(); setTxPanel("BUY"); }}
                                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700
                                           text-white font-bold text-sm rounded-xl transition-colors">
                                    BUY
                                </button>

                                {/* SELL — always visible; panel shows holding hint */}
                                <button
                                    onClick={e => { e.stopPropagation(); setTxPanel("SELL"); }}
                                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700
                                           text-white font-bold text-sm rounded-xl transition-colors">
                                    SELL
                                </button>

                                {/* Close */}
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-white
                                           hover:bg-slate-700 rounded-xl transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg"
                                         className="w-5 h-5" viewBox="0 0 24 24"
                                         fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                    {/* ── end TOP BAR ── */}

                    {/* ── SCROLLABLE BODY ── flex-1 so it takes remaining height, overflow-y-auto so only this scrolls. Header above never moves. */}
                    <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }}>

                        {/* ── STATS STRIP ── */}
                        {quote && !quoteLoading && (
                            <div className={
                                "gap-px bg-slate-800/40 flex-shrink-0 border-b border-slate-700/40 " +
                                (isMobile ? "grid grid-cols-3" : "grid grid-cols-6")
                            }>
                                {[
                                    ["Day High",   fmt(quote.dayHigh,       quote.currency)],
                                    ["Day Low",    fmt(quote.dayLow,        quote.currency)],
                                    ["Prev Close", fmt(quote.previousClose, quote.currency)],
                                    ["52W High",   fmt(quote.weekHigh52,    quote.currency)],
                                    ["52W Low",    fmt(quote.weekLow52,     quote.currency)],
                                    ["Data",       quote.dataSource || "—"],
                                ]
                                    /* On mobile show only the first 3 — Day High/Low/Prev Close */
                                    .filter((_, i) => !isMobile || i < 3)
                                    .map(([label, value]) => (
                                        <div key={label} className={`bg-slate-900 py-3 ${isMobile ? "px-3" : "px-5"}`}>
                                            <p className="text-xs text-slate-500">{label}</p>
                                            <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* ── CHART SECTION ── */}
                        {/* px-2 on mobile: the YAxis needs ~48px, chart line needs the rest.
                        px-6 on desktop was fine because the modal is wider.
                        On a 390px phone: px-6 = 48px total side padding → chart only 342px.
                        px-2 = 16px total → chart gets 374px. Meaningful difference for Recharts. */}
                        <div className={`flex flex-col flex-shrink-0 pt-4 pb-2 ${isMobile ? "px-2" : "px-6"}`}>

                            {/* Chart controls */}
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-semibold text-white">Price Chart</p>
                                    {periodChange && !chartLoading && (
                                        <span className={
                                            "text-xs font-semibold px-2.5 py-1 rounded-full " +
                                            (parseFloat(periodChange) >= 0
                                                ? "bg-green-900/40 text-green-400"
                                                : "bg-red-900/40 text-red-400")
                                        }>
                {parseFloat(periodChange) >= 0 ? "+" : ""}{periodChange}% this period
            </span>
                                    )}
                                </div>

                                <div className={isMobile ? "flex flex-col gap-2" : "flex items-center gap-4"}>
                                    {/* Vertical slider — desktop only, takes up too much mobile width */}
                                    {!isMobile && (
                                        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/40">
                                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Vertical View:</span>
                                            <input
                                                type="range"
                                                min="0.002"
                                                max="0.08"
                                                step="0.002"
                                                value={verticalPadding}
                                                onChange={(e) => setVerticalPadding(parseFloat(e.target.value))}
                                                className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                title="Drag to adjust vertical padding"
                                            />
                                            <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                {verticalPadding === 0.002 ? "Tight" : verticalPadding >= 0.05 ? "Wide" : "Mid"}
            </span>
                                        </div>
                                    )}

                                    {/* Original Timeframe Selectors */}
                                    <div className={isMobile ? "flex flex-col gap-1" : "flex flex-col items-end gap-1"}>
                                        <div className={
                                            "flex gap-1 bg-slate-800 p-1 rounded-xl " +
                                            (isMobile ? "overflow-x-auto" : "")
                                        }
                                             style={isMobile ? { scrollbarWidth: "none" } : {}}>
                                            {TIMEFRAMES.map(t => (
                                                <button
                                                    key={t.label}
                                                    onClick={() => setTf(t)}
                                                    title={t.desc}
                                                    className={
                                                        "flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all " +
                                                        (tf.label === t.label
                                                            ? (t.intraday
                                                                ? "bg-teal-600 text-white shadow"
                                                                : "bg-blue-600 text-white shadow")
                                                            : "text-slate-400 hover:text-white hover:bg-slate-700")
                                                    }>
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Active timeframe description */}
                                        <p className="text-xs text-white/70 pr-1 font-medium tracking-wide">
                                            {tf.desc}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Chart canvas */}
                            <div className="bg-slate-800/40 rounded-2xl border border-slate-700/40
                                    overflow-hidden" style={{height: "clamp(220px, 45vh, 560px)"}}>
                                {chartLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-3">
                                        <div className="w-8 h-8 border-2 border-blue-400
                                                    border-t-transparent rounded-full animate-spin" />
                                        <p className="text-slate-500 text-sm">Loading chart...</p>
                                    </div>
                                ) : chartData.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={chartData}
                                            margin={{ top: 16, right: isMobile ? 4 : 24, bottom: 8, left: 0 }}
                                            onMouseMove={e => {
                                                if (e && e.activeTooltipIndex != null)
                                                    setActiveIdx(e.activeTooltipIndex);
                                            }}
                                            onMouseLeave={() => setActiveIdx(null)}>
                                            <defs>
                                                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35}/>
                                                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.02}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="rgba(30,41,59,0.8)"
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fill: "#475569", fontSize: 11 }}
                                                tickFormatter={d => {
                                                    if (!d) return "";
                                                    // Intraday: already "HH:mm" — pass through
                                                    if (tf.intraday) return d;
                                                    const p = d.toString().split("T")[0].split("-");
                                                    return p.length >= 2 ? p[2] + "/" + p[1] : d;
                                                }}
                                                // Intraday: fixed 30-min marks covering full 09:15-15:30 session
                                                ticks={tf.intraday ? INTRADAY_TICKS : undefined}
                                                interval={tf.intraday ? 0 : "preserveStartEnd"}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={8}
                                            />
                                            <YAxis
                                                tick={{ fill: "#475569", fontSize: 11 }}
                                                tickFormatter={v =>
                                                    "₹" + (v >= 1000
                                                        ? (v / 1000).toFixed(1) + "k"
                                                        : v.toFixed(0))
                                                }
                                                // Intraday: compute domain from real points only
                                                // (null future slots would collapse the axis to 0)
                                                domain={yDomain}
                                                // On mobile: 48px is enough for "₹2.7k" labels.
                                                // 64px on desktop for full "₹2,678" style labels.
                                                width={isMobile ? 48 : 64}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                content={<CustomTooltip currency={quote?.currency || "INR"} />}
                                                cursor={false}
                                            />
                                            {firstPrice && (
                                                <ReferenceLine
                                                    y={firstPrice}
                                                    stroke="#334155"
                                                    strokeDasharray="6 4"
                                                    strokeWidth={1.5}
                                                />
                                            )}
                                            <Area
                                                type="monotone"
                                                dataKey="close"
                                                stroke={lineColor}
                                                strokeWidth={2.5}
                                                fill="url(#priceGrad)"
                                                dot={false}
                                                connectNulls={false}
                                                isAnimationActive={false}
                                                activeDot={false}
                                            />
                                            {/* Snapped crosshair: line and dot both snap to nearest data point.
                                            cursor=false on Tooltip disables Recharts free-moving line.
                                            activeIdx from onMouseMove gives the exact data-point index.
                                            Both the ReferenceLine and the dot use the same date/value. */}
                                            {activeIdx != null && chartData[activeIdx]?.close != null && (
                                                <ReferenceLine
                                                    x={chartData[activeIdx].date}
                                                    stroke="rgba(255,255,255,0.25)"
                                                    strokeWidth={1.5}
                                                />
                                            )}
                                            <Area
                                                type="monotone"
                                                dataKey="close"
                                                stroke="none"
                                                fill="none"
                                                dot={(props) => {
                                                    if (props.index !== activeIdx) return null;
                                                    if (props.payload?.close == null) return null;
                                                    return (
                                                        <circle
                                                            key={props.index}
                                                            cx={props.cx}
                                                            cy={props.cy}
                                                            r={6}
                                                            fill={lineColor}
                                                            stroke="#0f172a"
                                                            strokeWidth={2}
                                                        />
                                                    );
                                                }}
                                                activeDot={false}
                                                connectNulls={false}
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center gap-2">
                                        <p className="text-slate-400">No data for this timeframe</p>
                                        <p className="text-slate-600 text-sm">
                                            Try a different range or open TradingView
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── HISTORICAL RETURNS (collapsible) ── */}
                        <div className={`pb-5 flex-shrink-0 ${isMobile ? "px-2" : "px-6"}`}>
                            <button
                                onClick={() => setShowReturns(v => !v)}
                                className="w-full flex items-center justify-between
                                       px-5 py-3 bg-slate-800/60 hover:bg-slate-800
                                       rounded-2xl border border-slate-700/40 transition-colors">
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-semibold text-white">Historical Returns</p>
                                    {returns?.dataReliable === false && (
                                        <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">
                                        ⚠ Data unreliable
                                    </span>
                                    )}
                                    {returnsOk && (
                                        <div className="flex gap-2">
                                            {RETURN_PERIODS.map(({ key, label }) => {
                                                const r = returns.returns?.[key];
                                                if (!r) return null;
                                                const v = parseFloat(r.absoluteReturn);
                                                return (
                                                    <span key={key}
                                                          className={
                                                              "text-xs font-medium px-2 py-0.5 rounded-full " +
                                                              (v >= 0
                                                                  ? "bg-green-900/30 text-green-400"
                                                                  : "bg-red-900/30 text-red-400")
                                                          }>
                                                    {label}: {fmtPct(r.absoluteReturn)}
                                                </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <span className={"text-slate-400 transition-transform " + (showReturns ? "rotate-180" : "")}>▼</span>
                            </button>

                            {showReturns && (
                                <div className="mt-2 bg-slate-800/60 rounded-2xl border border-slate-700/40 overflow-hidden">
                                    {returns?.dataReliable === false ? (
                                        <div className="p-5 text-center space-y-2">
                                            <p className="text-slate-300 text-sm font-medium">
                                                Historical data unreliable — split-adjusted prices
                                            </p>
                                            <a href={tvUrl} target="_blank" rel="noopener noreferrer"
                                               className="inline-flex items-center gap-1 text-blue-400
                                                      hover:text-blue-300 text-xs underline">
                                                View on TradingView →
                                            </a>
                                        </div>
                                    ) : !returnsOk ? (
                                        <p className="text-slate-400 text-sm text-center p-5">Not available</p>
                                    ) : (
                                        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                                            <table className="w-full text-sm" style={{ minWidth: isMobile ? 480 : undefined }}>
                                                <thead>
                                                <tr className="text-slate-500 text-xs uppercase border-b border-slate-700/40">
                                                    <th className="text-left px-5 py-2.5">Period</th>
                                                    <th className="text-right px-5 py-2.5">Start Price</th>
                                                    <th className="text-right px-5 py-2.5">Absolute</th>
                                                    <th className="text-right px-5 py-2.5">CAGR (p.a.)</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {RETURN_PERIODS.map(({ key }) => {
                                                    const r = returns.returns?.[key];
                                                    if (!r) return null;
                                                    return (
                                                        <tr key={key}
                                                            className="border-b border-slate-700/30 hover:bg-slate-700/20">
                                                            <td className="px-5 py-2.5">
                                                                <p className="text-white font-medium">
                                                                    {key === "1M" ? "1 Month" : key === "3M" ? "3 Months"
                                                                        : key === "6M" ? "6 Months" : key === "1Y" ? "1 Year"
                                                                            : key === "3Y" ? "3 Years" : "5 Years"}
                                                                </p>
                                                                <p className="text-xs text-slate-500">since {r.startDate}</p>
                                                            </td>
                                                            <td className="text-right px-5 py-2.5 text-slate-400 text-xs">
                                                                {fmt(r.priceAtPeriodStart, returns.currency)}
                                                            </td>
                                                            <td className={"text-right px-5 py-2.5 font-semibold " + clr(r.absoluteReturn)}>
                                                                {fmtPct(r.absoluteReturn)}
                                                            </td>
                                                            <td className="text-right px-5 py-2.5 font-medium">
                                                                {r.annualizedReturn != null ? (
                                                                    <span className={clr(r.annualizedReturn)}>
                                                                {fmtPct(r.annualizedReturn)}
                                                            </span>
                                                                ) : (
                                                                    <span className="text-slate-500 text-xs">= absolute</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>{/* end scrollable body */}
                </div>{/* end modal card */}
            </div>{/* end backdrop */}

            {/* Transaction panel — own portal so it renders above StockDetailModal (z-[300]) */}
            {txPanel && createPortal(
                <StockTransactionPanel
                    stock={stock }
                    defaultType={txPanel}
                    onClose={() => setTxPanel(null)}
                    onChanged={() => setTxPanel(null)}
                />,
                document.body
            )}

            {/* Price alert modal — own portal so it renders above StockDetailModal (z-[300]) */}
            {alertModal && createPortal(
                <PriceAlertModal
                    stock={stock}
                    currentPrice={quote?.currentPrice}
                    onClose={() => setAlertModal(false)}
                />,
                document.body
            )}
        </>
        , document.body);
}