import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import StockLogo from "./StockLogo";
import { getIndexConstituents, getStockChart, getIndices } from "../api/portfolio";
import StockDetailModal from "./StockDetailModal";
import { useMobile } from "../hooks/useMobile";

// Mini sparkline — reused from board section style
function RowSparkline({ symbol }) {
    const [pts, setPts] = useState([]);

    useEffect(() => {
        const parse = (res) => (res?.dataPoints || [])
            .filter(p => p.close != null)
            .map(p => parseFloat(p.close))
            .filter(v => v > 0);

        getStockChart(symbol, "NSE", "5m", "1d")
            .then(r => {
                const p = parse(r.data);
                if (p.length > 3) setPts(p);
                else return getStockChart(symbol, "NSE", "1d", "5d")
                    .then(r2 => setPts(parse(r2.data)));
            })
            .catch(() => {});
    }, [symbol]);

    if (pts.length < 2)
        return <div className="w-16 h-5 bg-slate-700/30 rounded animate-pulse" />;

    const W = 64, H = 20;
    const min = Math.min(...pts), max = Math.max(...pts);
    const range = max - min || 1;
    const up = pts[pts.length - 1] >= pts[0];
    const color = up ? "#22c55e" : "#ef4444";
    const toX = i => (i / (pts.length - 1)) * W;
    const toY = v => 2 + ((max - v) / range) * (H - 4);
    const points = pts.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
             preserveAspectRatio="none" style={{ display: "block", flexShrink: 0 }}>
            <polyline points={points} fill="none" stroke={color}
                      strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

// Format market cap in Indian notation
function fmtCap(cap) {
    if (cap == null || cap === 0) return "—";
    if (cap >= 10_000_000_000_000) return "₹" + (cap / 10_000_000_000_000).toFixed(1) + "L Cr";
    if (cap >= 100_000_000_000)    return "₹" + (cap / 100_000_000_000).toFixed(1) + "k Cr";
    if (cap >= 10_000_000)         return "₹" + (cap / 10_000_000).toFixed(1) + " Cr";
    return "₹" + (cap / 10_000_000).toFixed(2) + " Cr";
}

const INDEX_NAMES = {
    "^NSEI":                "NIFTY 50",
    "^NSEBANK":             "BANK NIFTY",
    "^NSEMDCP50":           "MIDCAP SELECT",
    "NIFTYSMLCAP250.NS":    "SMALLCAP 250",
    "NIFTY_MICROCAP250.NS": "MICROCAP 250",
    // ^BSESN (SENSEX) removed — it's a BSE index; NSE has no constituent
    // file for it, so "View constituents" can't be supported for it here.
};

const SORT_FIELDS = [
    { key: "rank",          label: "Rank"    },
    { key: "changePercent", label: "% Change"},
    { key: "currentPrice",  label: "Price"   },
    { key: "marketCap",     label: "Mkt Cap" },
];

export default function IndexConstituentsModal({ symbol, onClose }) {
    const isMobile = useMobile();
    // The index shown can be switched from the dropdown without closing the
    // modal — activeSymbol drives everything below; the `symbol` prop only
    // seeds the initial value when the modal first opens.
    const [activeSymbol, setActiveSymbol] = useState(symbol);
    const [switcherOpen,  setSwitcherOpen] = useState(false);
    const switcherRef = useRef(null);

    const [constituents, setConstituents] = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [sortKey,      setSortKey]      = useState("marketCap");
    const [sortAsc,      setSortAsc]      = useState(false);
    const [search,       setSearch]       = useState("");
    const [detailStock,  setDetailStock]  = useState(null);

    const indexName = INDEX_NAMES[activeSymbol] || activeSymbol;

    // If constituents come back empty, retry twice (short backoff) before
    // giving up and falling back to just the index's live value/% — so the
    // person never sees a bare, unexplained blank list.
    const MAX_RETRIES = 2;
    const [retryCount,   setRetryCount]   = useState(0);
    const [showValueOnly, setShowValueOnly] = useState(false);
    const [indexValue,    setIndexValue]    = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setShowValueOnly(false);
        setIndexValue(null);
        setRetryCount(0);

        const attempt = (n) => {
            getIndexConstituents(activeSymbol)
                .then(res => {
                    if (cancelled) return;
                    const data = res.data || [];
                    if (data.length > 0 || n >= MAX_RETRIES) {
                        setConstituents(data);
                        setLoading(false);
                        if (data.length === 0) fallbackToValueOnly();
                    } else {
                        setRetryCount(n + 1);
                        setTimeout(() => { if (!cancelled) attempt(n + 1); }, 1200);
                    }
                })
                .catch(() => {
                    if (cancelled) return;
                    if (n >= MAX_RETRIES) {
                        setLoading(false);
                        fallbackToValueOnly();
                    } else {
                        setRetryCount(n + 1);
                        setTimeout(() => { if (!cancelled) attempt(n + 1); }, 1200);
                    }
                });
        };

        const fallbackToValueOnly = () => {
            // Constituents genuinely unavailable — show just the index's
            // live value/% instead of a blank, unexplained list.
            getIndices()
                .then(r => {
                    if (cancelled) return;
                    const idx = (r.data || []).find(i => i.symbol === activeSymbol);
                    setIndexValue(idx || null);
                    setShowValueOnly(true);
                })
                .catch(() => { if (!cancelled) setShowValueOnly(true); });
        };

        attempt(0);
        return () => { cancelled = true; };
    }, [activeSymbol]);

    // Close the switcher dropdown on outside click.
    useEffect(() => {
        if (!switcherOpen) return;
        const h = (e) => {
            if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [switcherOpen]);

    const switchIndex = (sym) => {
        if (sym === activeSymbol) { setSwitcherOpen(false); return; }
        setActiveSymbol(sym);
        setSwitcherOpen(false);
        setSearch("");           // fresh context for the newly chosen index
    };

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortAsc(a => !a);
        } else {
            setSortKey(key);
            // For numeric fields default to desc (largest first)
            // For rank and symbol default to asc
            setSortAsc(key === "rank" || key === "symbol");
        }
    };

    const displayed = constituents
        .filter(c => !search ||
            c.symbol.toLowerCase().includes(search.toLowerCase()) ||
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.industry || "").toLowerCase().includes(search.toLowerCase()))
        .slice()
        .sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            // Nulls always go to end regardless of sort direction
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const an = parseFloat(av), bn = parseFloat(bv);
            return sortAsc
                ? (an > bn ? 1 : an < bn ? -1 : 0)
                : (an < bn ? 1 : an > bn ? -1 : 0);
        });

    const gainers  = constituents.filter(c => parseFloat(c.changePercent || 0) > 0).length;
    const losers   = constituents.filter(c => parseFloat(c.changePercent || 0) < 0).length;

    return (
        <>
            {/* StockDetailModal via portal — renders directly on document.body,
            completely outside any stacking context */}
            {detailStock && createPortal(
                <StockDetailModal
                    stock={detailStock}
                    onClose={() => setDetailStock(null)}
                />,
                document.body
            )}

            <div className="fixed inset-0 bg-black/70 z-[250] flex items-start justify-center
                        overflow-y-auto py-6 px-4"
                 onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full
                            max-w-5xl min-h-[80vh] flex flex-col shadow-2xl"
                     style={{ overflowX: "hidden", maxWidth: isMobile ? "100vw" : undefined }}
                     onClick={e => e.stopPropagation()}>

                    {/* ── Header ─────────────────────────────────────────────── */}
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800
                                flex-shrink-0 flex-wrap gap-y-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Index name — tap to switch to a different index without closing the modal */}
                            <div ref={switcherRef} className="relative flex-shrink-0">
                                <button onClick={() => setSwitcherOpen(v => !v)}
                                        className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30
                                                   rounded-xl px-3 py-1.5 hover:bg-blue-500/30 transition-colors">
                                    <span className="text-blue-300 font-bold text-sm">{indexName}</span>
                                    <span className={"text-blue-400 text-[10px] transition-transform " +
                                    (switcherOpen ? "rotate-180" : "")}>▼</span>
                                </button>

                                {switcherOpen && (
                                    <div className="absolute left-0 top-full mt-1.5 w-52 bg-slate-800
                                                    border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                                        {Object.entries(INDEX_NAMES).map(([sym, name]) => (
                                            <button key={sym} onClick={() => switchIndex(sym)}
                                                    className={"w-full flex items-center justify-between px-3.5 py-2.5 text-left " +
                                                    "text-sm transition-colors hover:bg-slate-700/60 " +
                                                    (sym === activeSymbol ? "text-blue-300 font-semibold bg-slate-700/40" : "text-slate-300")}>
                                                {name}
                                                {sym === activeSymbol && <span className="text-blue-400 text-xs">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {!loading && !error && !showValueOnly && (
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-500">{constituents.length} stocks</span>
                                    <span className="text-green-400 font-medium">{gainers} ▲</span>
                                    <span className="text-red-400 font-medium">{losers} ▼</span>
                                </div>
                            )}
                        </div>

                        {/* Search — hidden in the value-only fallback, nothing to search */}
                        {!showValueOnly && (
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search symbol, name, sector..."
                                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5
                                       text-white text-xs focus:outline-none focus:border-blue-500
                                       w-56 flex-shrink-0"
                            />
                        )}

                        <button onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-xl
                                       text-slate-400 hover:text-white hover:bg-slate-800
                                       transition-colors flex-shrink-0 text-sm">
                            ✕
                        </button>
                    </div>

                    {/* ── Table header (desktop only — mobile rows are self-labeling) ── */}
                    {!isMobile && (
                        <div className="grid text-[10px] font-semibold text-slate-500 uppercase
                                tracking-wide px-4 py-2 border-b border-slate-800/60
                                bg-slate-900/80 flex-shrink-0"
                             style={{ gridTemplateColumns: "32px 36px 1fr 140px 88px 72px 72px 68px 52px" }}>
                            {[
                                { key: "rank",          label: "#"       },
                                { key: null,            label: ""        },
                                { key: "symbol",        label: "Stock"   },
                                { key: "industry",      label: "Sector"  },
                                { key: "marketCap",     label: "Mkt Cap" },
                                { key: "currentPrice",  label: "Price"   },
                                { key: "changePercent", label: "Change"  },
                                { key: null,            label: "Chart"   },
                                { key: null,            label: ""        },
                            ].map(({ key, label }, i) => (
                                <div key={i}
                                     className={key ? "cursor-pointer hover:text-slate-300 transition-colors" : ""}
                                     onClick={() => key && handleSort(key)}>
                                    {label}
                                    {sortKey === key && (
                                        <span className="ml-0.5 text-blue-400">
                                    {sortAsc ? "↑" : "↓"}
                                </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Table body ───────────────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto" style={{
                        scrollbarWidth: "thin", scrollbarColor: "#334155 transparent",
                        overflowX: "hidden",
                    }}>
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent
                                            rounded-full animate-spin" />
                                <p className="text-slate-500 text-sm">
                                    {retryCount > 0
                                        ? `Still trying to load ${indexName} constituents... (attempt ${retryCount + 1} of ${MAX_RETRIES + 1})`
                                        : `Loading ${indexName} constituents from NSE...`}
                                </p>
                                <p className="text-slate-600 text-xs">
                                    First load may take 20-30 seconds
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center justify-center py-20">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Constituents genuinely unavailable after retries — show the
                            index's live value instead of a bare empty list, so the
                            person always gets something useful, not a blank screen. */}
                        {!loading && !error && showValueOnly && (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                                <p className="text-3xl">📊</p>
                                {indexValue ? (
                                    <>
                                        <p className="text-white font-bold text-2xl tabular-nums">
                                            {parseFloat(indexValue.value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                        </p>
                                        <p className={"text-sm font-semibold " +
                                        (parseFloat(indexValue.changePercent || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                                            {parseFloat(indexValue.changePercent || 0) >= 0 ? "▲ +" : "▼ "}
                                            {Math.abs(parseFloat(indexValue.changePercent || 0)).toFixed(2)}%
                                        </p>
                                    </>
                                ) : null}
                                <p className="text-slate-500 text-sm max-w-sm">
                                    Constituents for {indexName} aren't available right now — showing the index value only.
                                </p>
                                <p className="text-slate-600 text-xs">
                                    This usually resolves on its own; try again in a little while.
                                </p>
                            </div>
                        )}

                        {!loading && !error && !showValueOnly && displayed.length === 0 && (
                            <div className="flex items-center justify-center py-20">
                                <p className="text-slate-500 text-sm">No stocks match your search</p>
                            </div>
                        )}

                        {!loading && !error && !showValueOnly && displayed.map((c, i) => {
                            const chg    = parseFloat(c.changePercent || 0);
                            const up     = chg >= 0;
                            const price  = parseFloat(c.currentPrice  || 0);

                            // ── MOBILE: compact single row that fits 380px, no h-scroll ──
                            if (isMobile) {
                                return (
                                    <div key={c.symbol}
                                         className={`flex items-center gap-2.5 px-3 py-2.5 border-b
                                                 border-slate-800/40 active:bg-slate-800/50
                                                 transition-colors cursor-pointer
                                                 ${i % 2 === 0 ? "" : "bg-slate-900/30"}`}
                                         style={{ minWidth: 0 }}
                                         onClick={() => setDetailStock({
                                             id: i, symbol: c.symbol, name: c.name, exchange: "NSE"
                                         })}>

                                        {/* rank + logo */}
                                        <span className="text-slate-600 text-[10px] font-mono w-4 flex-shrink-0 text-right">
                                            {c.rank}
                                        </span>
                                        <div className="flex-shrink-0">
                                            <StockLogo symbol={c.symbol} name={c.name} size={26} />
                                        </div>

                                        {/* symbol + sector + mkt cap stacked */}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-white font-bold text-xs leading-tight truncate">
                                                {c.symbol}
                                            </p>
                                            <p className="text-slate-500 text-[10px] leading-tight truncate">
                                                {(c.industry || "—")} · {fmtCap(c.marketCap)}
                                            </p>
                                        </div>

                                        {/* sparkline (fixed, doesn't stretch) */}
                                        <div className="flex-shrink-0 w-14">
                                            <RowSparkline symbol={c.symbol} />
                                        </div>

                                        {/* price + change stacked, right-aligned */}
                                        <div className="flex-shrink-0 text-right" style={{ minWidth: 62 }}>
                                            <p className="text-xs font-bold text-white leading-tight">
                                                {price > 0
                                                    ? "₹" + price.toLocaleString("en-IN", { maximumFractionDigits: 2 })
                                                    : "—"}
                                            </p>
                                            <p className={`text-[10px] font-bold leading-tight ${up ? "text-green-400" : "text-red-400"}`}>
                                                <span className="text-[8px] mr-0.5">{up ? "▲" : "▼"}</span>
                                                {Math.abs(chg).toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                );
                            }

                            // ── DESKTOP: full 9-column grid table ──
                            return (
                                <div key={c.symbol}
                                     className={`grid items-center px-4 py-2.5 border-b
                                             border-slate-800/40 hover:bg-slate-800/40
                                             transition-colors cursor-pointer
                                             ${i % 2 === 0 ? "" : "bg-slate-900/30"}`}
                                     style={{ gridTemplateColumns: "32px 36px 1fr 140px 88px 72px 72px 68px 28px" }}
                                     onClick={() => setDetailStock({
                                         id: i, symbol: c.symbol, name: c.name, exchange: "NSE"
                                     })}>

                                    {/* Rank */}
                                    <div className="text-slate-600 text-xs font-mono">{c.rank}</div>

                                    {/* Logo */}
                                    <div>
                                        <StockLogo symbol={c.symbol} name={c.name} size={28} />
                                    </div>

                                    {/* Symbol + Name */}
                                    <div className="min-w-0">
                                        <p className="text-white font-bold text-xs leading-none">
                                            {c.symbol}
                                        </p>
                                        <p className="text-slate-500 text-[10px] mt-0.5 truncate">
                                            {c.name}
                                        </p>
                                    </div>

                                    {/* Sector */}
                                    <div className="truncate">
                                    <span className="text-[10px] text-slate-500 bg-slate-800
                                                     px-1.5 py-0.5 rounded font-medium">
                                        {c.industry || "—"}
                                    </span>
                                    </div>

                                    {/* Market cap */}
                                    <div className="text-xs text-slate-400 font-medium">
                                        {fmtCap(c.marketCap)}
                                    </div>

                                    {/* Price */}
                                    <div className="text-xs font-bold text-white">
                                        {price > 0
                                            ? "₹" + price.toLocaleString("en-IN",
                                            { maximumFractionDigits: 2 })
                                            : "—"}
                                    </div>

                                    {/* Change % */}
                                    <div className={`text-xs font-bold ${up ? "text-green-400" : "text-red-400"}`}>
                                        <span className="text-[9px] mr-0.5">{up ? "▲" : "▼"}</span>
                                        {Math.abs(chg).toFixed(2)}%
                                    </div>

                                    {/* Sparkline */}
                                    <div>
                                        <RowSparkline symbol={c.symbol} />
                                    </div>



                                    {/* Arrow */}
                                    <div className="text-slate-700 text-xs">›</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Footer ──────────────────────────────────────────────── */}
                    {!loading && !error && constituents.length > 0 && (
                        <div className="px-6 py-3 border-t border-slate-800 flex items-center
                                    justify-between flex-shrink-0">
                            <p className="text-slate-600 text-[10px]">
                                Data: NSE India · Prices: Yahoo Finance · Refreshed daily 6:30 AM IST
                            </p>
                            <p className="text-slate-600 text-[10px]">
                                Click any stock to view full chart
                            </p>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}