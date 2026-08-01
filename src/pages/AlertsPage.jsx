// src/pages/AlertsPage.jsx
// Client's personal price alerts — set, manage, and track triggered alerts.

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAlerts, toggleAlert, deleteAlert } from "../api/portfolio";
import { searchStocks, getStockPrice } from "../api/portfolio";
import StockLogo    from "../components/StockLogo";
import NotesPanel   from "../components/NotesPanel";
import TradeSetupModal from "../components/TradeSetupModal";
import PushToggle from "../components/PushToggle";
import { sendTestPush } from "../utils/push";
import { useToast } from "../context/ToastContext";
import { useInbox } from "../context/InboxContext";

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const dt = new Date(d);
        return dt.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    } catch { return d; }
};

const fmtPrice = (v) =>
    v != null ? `₹${parseFloat(v).toLocaleString("en-IN",{maximumFractionDigits:2})}` : "—";

// -- Single alert card --------------------------------------------------------─
// -- Groups multiple alerts on the same stock into one collapsible card,
// matching the pattern already used for stocks with multiple transactions.
// Trade-setup rows (3 per setup: ENTRY/TARGET/STOP_LOSS) count as one setup,
// not three, in the breakdown line.
function GroupedAlertCard({ symbol, alertsForSymbol, livePrices, onToggle, onDelete }) {
    const [expanded, setExpanded] = useState(false);

    const simpleAlerts = alertsForSymbol.filter(a => !a.tradeSetupId);
    const setupIds = [...new Set(alertsForSymbol.filter(a => a.tradeSetupId).map(a => a.tradeSetupId))];
    const total = alertsForSymbol.length;

    const parts = [];
    if (simpleAlerts.length > 0) parts.push(`${simpleAlerts.length} Simple`);
    if (setupIds.length > 0) parts.push(`${setupIds.length} Quick Trade`);

    // Every stock — even with just one alert — gets the same collapsed
    // header (symbol + count), for consistency. Collapsed by default always;
    // nothing auto-opens.
    return (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
            <button onClick={() => setExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-white font-bold text-sm">{symbol}</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full flex-shrink-0">
                        {total} {total === 1 ? "alert" : "alerts"}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">{parts.join(" · ")}</span>
                </div>
                <span className={"text-slate-500 text-xs transition-transform flex-shrink-0 " + (expanded ? "rotate-180" : "")}>▼</span>
            </button>
            {expanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40 pt-2">
                    {alertsForSymbol.map(a => (
                        <AlertCard key={a.id} alert={a} livePrice={livePrices[a.symbol]}
                                   onToggle={onToggle} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function AlertCard({ alert, livePrice, onToggle, onDelete }) {
    const [deleting, setDeleting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const toast = useToast();

    const triggered = !!alert.triggeredAt;
    const isOn      = alert.isEnabled && !triggered;

    const cp = parseFloat(livePrice?.currentPrice || 0);
    const tgt = parseFloat(alert.computedTarget || 0);

    // Distance from current price to target
    const distPct = cp > 0 && tgt > 0
        ? ((tgt - cp) / cp * 100)
        : null;

    const typeIcon = {
        PRICE_ABOVE: "↑", PRICE_BELOW: "↓",
        PCT_UP: "🔼",     PCT_DOWN: "🔽",
    }[alert.alertType] || "🔔";

    const typeColor = ["PRICE_ABOVE","PCT_UP"].includes(alert.alertType)
        ? "text-green-400" : "text-red-400";

    const handleToggle = async () => {
        setToggling(true);
        try { await onToggle(alert.id); }
        finally { setToggling(false); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try { await onDelete(alert.id); }
        finally { setDeleting(false); }
    };

    return (
        <div className={
            "bg-slate-800 border rounded-xl p-4 transition-all " +
            (triggered
                ? "border-slate-700/40 opacity-60"
                : isOn
                    ? "border-slate-700/60 hover:border-slate-600"
                    : "border-slate-700/40")
        }>
            <div className="flex items-start gap-3">
                {/* Logo */}
                <StockLogo symbol={alert.symbol} name={alert.name} size={38} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-bold text-sm">{alert.symbol}</p>
                        {alert.exchange && (
                            <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                                {alert.exchange}
                            </span>
                        )}
                        {triggered && (
                            <span className="text-xs bg-green-900/40 text-green-400 border
                                             border-green-500/30 px-2 py-0.5 rounded-full font-bold">
                                ✓ TRIGGERED
                            </span>
                        )}
                        {!triggered && !isOn && (
                            <span className="text-xs bg-slate-700/60 text-slate-500 px-2 py-0.5 rounded-full">
                                paused
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    <p className={"text-sm mt-0.5 font-medium " + typeColor}>
                        <span className="mr-1">{typeIcon}</span>
                        {alert.description}
                    </p>

                    {/* Live distance info */}
                    {!triggered && cp > 0 && distPct != null && (
                        <p className="text-xs text-slate-500 mt-1">
                            Now {fmtPrice(cp)} ·{" "}
                            <span className={Math.abs(distPct) < 2 ? "text-amber-400 font-semibold" : ""}>
                                {Math.abs(distPct).toFixed(2)}% {distPct > 0 ? "to go" : "past target"}
                            </span>
                        </p>
                    )}
                    {triggered && (
                        <p className="text-xs text-slate-500 mt-1">
                            Triggered {fmtDate(alert.triggeredAt)}
                        </p>
                    )}

                    <p className="text-xs text-slate-700 mt-1">Set {fmtDate(alert.createdAt)}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle */}
                    {!triggered && (
                        <button
                            onClick={handleToggle}
                            disabled={toggling}
                            title={isOn ? "Pause alert" : "Resume alert"}
                            className={
                                "w-10 h-5 rounded-full transition-all flex items-center " +
                                (toggling ? "opacity-50 " : "") +
                                (isOn ? "bg-amber-500" : "bg-slate-600")
                            }>
                            <div className={
                                "w-4 h-4 bg-white rounded-full mx-0.5 transition-transform " +
                                (isOn ? "translate-x-5" : "translate-x-0")
                            } />
                        </button>
                    )}
                    {/* Delete */}
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20
                                   rounded-lg transition-colors disabled:opacity-40">
                        {deleting ? "…" : "🗑"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// -- Search bar for setting new alert ----------------------------------------─
function StockSearchForAlert({ onSelect }) {
    const [query,   setQuery]   = useState("");
    const [results, setResults] = useState([]);
    const [open,    setOpen]    = useState(false);
    const timer  = useRef(null);
    const reqId  = useRef(0);      // invalidates stale async responses
    const boxRef = useRef(null);   // container: outside-click + scroll-into-view

    const handleInput = (val) => {
        setQuery(val);
        // Empty field: kill any pending/in-flight request so a late response
        // can't repopulate the dropdown after the user has cleared the box.
        if (!val.trim()) {
            clearTimeout(timer.current);
            reqId.current++;
            setResults([]); setOpen(false);
            return;
        }
        clearTimeout(timer.current);
        const myId = ++reqId.current;
        timer.current = setTimeout(() => {
            searchStocks(val).then(r => {
                if (myId !== reqId.current) return;      // a newer keystroke won
                setResults((r.data?.content || r.data || []).slice(0, 8));
                setOpen(true);
            }).catch(() => {});
        }, 300);
    };

    // Tap anywhere outside the box → close the dropdown.
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
        };
    }, [open]);

    // On mobile the soft keyboard covers a mid-page field. Pull the box to the
    // top so the input AND its results sit in the space above the keyboard.
    const handleFocus = () => {
        setTimeout(() => {
            boxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
    };

    return (
        <div className="relative" ref={boxRef} style={{ scrollMarginTop: 80 }}>
            <input
                type="text"
                value={query}
                onChange={e => handleInput(e.target.value)}
                onFocus={handleFocus}
                placeholder="Search stock to set alert (e.g. HDFCBANK, Reliance…)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl
                           px-4 py-3 text-white text-sm placeholder-slate-500
                           focus:outline-none focus:border-amber-500 transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">🔔</span>

            {open && query.trim() && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-900
                                border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                    {results.map(s => (
                        <button
                            key={s.id || s.symbol}
                            onClick={() => {
                                clearTimeout(timer.current);
                                reqId.current++;
                                setQuery(""); setResults([]); setOpen(false);
                                onSelect(s);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5
                                       hover:bg-slate-800 transition-colors text-left">
                            <StockLogo symbol={s.symbol} name={s.name} size={28} />
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-semibold text-sm truncate">{s.symbol}</p>
                                <p className="text-slate-500 text-xs truncate">{s.name}</p>
                            </div>
                            <span className="flex-shrink-0 ml-2 text-xs text-slate-600">{s.exchange}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// -- Main page ----------------------------------------------------------------─
export default function AlertsPage() {
    const [alerts,     setAlerts]     = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [tab,        setTab]        = useState("active"); // "active"|"triggered"|"all"
    const [alertStock, setAlertStock] = useState(null);     // opens PriceAlertModal
    const [alertPrice, setAlertPrice] = useState(null);
    const [livePrices, setLivePrices] = useState({});
    const toast = useToast();

    const location = useLocation();
    const navigate = useNavigate();
    const { openInbox } = useInbox();
    const fromInbox = !!location.state?.fromInbox;
    const [focusId, setFocusId] = useState(location.state?.alertId ?? null);
    const focusRef = useRef(null);

    // A fresh navigation from the inbox (even to this same route) should re-focus.
    useEffect(() => {
        if (location.state?.alertId) setFocusId(location.state.alertId);
    }, [location.state?.alertId, location.key]);

    // Once alerts are loaded, jump to the Triggered tab, scroll the focused alert
    // into view and ring it briefly, then let the ring fade.
    useEffect(() => {
        if (!focusId || loading) return;
        setTab("triggered");
        const t1 = setTimeout(() => {
            focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
        const t2 = setTimeout(() => setFocusId(null), 3200);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [focusId, loading]);

    const backToInbox = () => { openInbox(); navigate(-1); };

    const load = () => {
        setLoading(true);
        getAlerts()
            .then(r => {
                const list = r.data || [];
                setAlerts(list);
                // Fetch live prices for all symbols
                const symbols = [...new Set(list.map(a => a.symbol))];
                symbols.forEach(sym => {
                    getStockPrice(sym)
                        .then(pr => setLivePrices(prev => ({...prev, [sym]: pr.data})))
                        .catch(() => {});
                });
            })
            .catch(() => toast.error("Failed to load alerts"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleToggle = async (id) => {
        try {
            const res = await toggleAlert(id);
            setAlerts(prev => prev.map(a => a.id === id ? res.data : a));
        } catch { toast.error("Failed to toggle alert"); }
    };

    const handleDelete = async (id) => {
        try {
            await deleteAlert(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
            toast.success("Alert deleted");
        } catch { toast.error("Failed to delete alert"); }
    };

    const handleSelectStock = async (stock) => {
        setAlertStock(stock);
        try {
            const res = await getStockPrice(stock.symbol);
            setAlertPrice(res.data?.currentPrice || null);
        } catch { setAlertPrice(null); }
    };

    // Filter
    const filtered = alerts.filter(a => {
        if (tab === "active")    return a.isEnabled && !a.triggeredAt;
        if (tab === "triggered") return !!a.triggeredAt;
        return true;
    });

    const activeCount    = alerts.filter(a => a.isEnabled && !a.triggeredAt).length;
    const triggeredCount = alerts.filter(a => !!a.triggeredAt).length;

    return (
        <div className="space-y-5">
            {/* Back to Inbox — only when arrived from the inbox Alerts tab */}
            {fromInbox && (
                <button onClick={backToInbox}
                        className="flex items-center gap-1.5 text-sm text-slate-300
                                   hover:text-white bg-slate-800/60 hover:bg-slate-800
                                   border border-slate-700/50 rounded-lg px-3 py-1.5
                                   transition-colors">
                    <span className="text-base leading-none">←</span> Back to Inbox
                </button>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Alerts fire during market hours — get them as phone notifications
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-500/30
                                    text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold">
                        <span>🔔</span>
                        <span>{activeCount} active</span>
                    </div>
                </div>
            </div>

            {/* Enable real phone notifications for this device */}
            <div className="flex items-center gap-2 flex-wrap">
                <PushToggle />
                <button
                    onClick={async () => {
                        try {
                            await sendTestPush();
                            toast.success("Test sent — check your device (enable notifications first if nothing arrives)");
                        } catch (e) {
                            toast.error(e?.response?.data?.message || "Couldn't send test notification");
                        }
                    }}
                    className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700
                               text-slate-300 hover:bg-slate-800 active:bg-slate-700/60 transition-colors">
                    Send test notification
                </button>
            </div>

            {/* Search to set new alert */}
            {tab !== "notes" && (
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-4">
                    <p className="text-white font-semibold text-sm mb-3">
                        + Set New Alert
                    </p>
                    <StockSearchForAlert onSelect={handleSelectStock} />
                    <p className="text-slate-600 text-xs mt-2">
                        Search any NSE/BSE stock or index to set a price or % change alert
                    </p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl w-fit">
                {[
                    ["active",    `Active (${activeCount})`],
                    ["triggered", `Triggered (${triggeredCount})`],
                    ["all",       `All (${alerts.length})`],
                    ["notes",     `📝 Notes`],
                ].map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)}
                            className={
                                "px-4 py-2 rounded-lg text-xs font-semibold transition-all " +
                                (tab === id
                                    ? "bg-amber-500 text-slate-900"
                                    : "text-slate-400 hover:text-white")
                            }>
                        {label}
                    </button>
                ))}
            </div>

            {/* Alert list — or Notes panel on the notes tab */}
            {tab === "notes" ? (
                <NotesPanel />
            ) : loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-12 text-center">
                    <p className="text-4xl mb-3">🔕</p>
                    <p className="text-white font-semibold">No {tab} alerts</p>
                    <p className="text-slate-500 text-sm mt-1">
                        {tab === "active"
                            ? "Use the search above to set your first price alert"
                            : "Triggered alerts will appear here when a price target is hit"}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(() => {
                        // Group by symbol, preserving first-seen order.
                        const bySymbol = new Map();
                        filtered.forEach(a => {
                            if (!bySymbol.has(a.symbol)) bySymbol.set(a.symbol, []);
                            bySymbol.get(a.symbol).push(a);
                        });
                        return [...bySymbol.entries()].map(([symbol, group]) => {
                            const hasFocused = group.some(a => a.id === focusId);
                            return (
                                <div key={symbol}
                                     ref={hasFocused ? focusRef : null}
                                     className={hasFocused
                                         ? "rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 transition-all"
                                         : ""}>
                                    <GroupedAlertCard
                                        symbol={symbol}
                                        alertsForSymbol={group}
                                        livePrices={livePrices}
                                        onToggle={handleToggle}
                                        onDelete={handleDelete}
                                    />
                                </div>
                            );
                        });
                    })()}
                </div>
            )}

            {/* TradeSetupModal — opened by stock search. Replaces the old
                PriceAlertModal: this now covers Simple condition (Above/Below/
                Equals) AND Trade setup (entry/target/stop-loss, AI or manual). */}
            {alertStock && (
                <TradeSetupModal
                    stock={alertStock}
                    currentPrice={alertPrice}
                    onClose={() => { setAlertStock(null); setAlertPrice(null); }}
                    onCreated={() => { load(); setAlertStock(null); }}
                />
            )}
        </div>
    );
}