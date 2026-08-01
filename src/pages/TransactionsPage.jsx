import {useState, useEffect, useRef, useMemo} from "react";
import {
    getTransactions, addTransaction, deleteTransaction, bulkDeleteTransactions,
    searchStocks, getStockPrice,
} from "../api/portfolio";
import StockTransactionPanel from "../components/StockTransactionPanel";
import StockLogo from "../components/StockLogo";
import {useToast} from "../context/ToastContext";
import AiTradeImportModal from "../components/AiTradeImportModal";
import ExcelImportModal from "../components/ExcelImportModal";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        return `${day}/${m}/${y}`;
    } catch { return d; }
};

const fmtShortDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        const mo = ["Jan","Feb","Mar","Apr","May","Jun",
            "Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${day} ${mo[parseInt(m,10)-1]} ${y}`;
    } catch { return d; }
};

const today = () => new Date().toISOString().split("T")[0];

const MONTHS = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({dialog, onConfirm, onCancel}) {
    if (!dialog.open) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel}/>
            <div className="relative z-10 bg-slate-800 border border-slate-700 rounded-2xl
                            shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-900/40 rounded-xl flex items-center
                                    justify-center flex-shrink-0">
                        <span className="text-red-400 text-lg">🗑</span>
                    </div>
                    <div>
                        <p className="text-white font-semibold">{dialog.title || "Confirm Delete"}</p>
                        <p className="text-slate-400 text-sm mt-0.5">{dialog.message}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onCancel}
                            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white
                                       text-sm font-medium rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white
                                       text-sm font-bold rounded-xl transition-colors">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Stock Group Card ─────────────────────────────────────────────────────────
function StockGroupCard({group, expanded, onToggle, onOpenPanel, onAskDelete, selectedIds, onToggleSelect, onDeleteGroupSelected, bulkDeleting}) {
    const buys  = group.transactions.filter(t => t.type === "BUY");
    const sells = group.transactions.filter(t => t.type === "SELL");
    const totalBought = buys.reduce((s,t) => s + parseFloat(t.totalAmount || 0), 0);
    const totalSold   = sells.reduce((s,t) => s + parseFloat(t.totalAmount || 0), 0);
    const latest = group.transactions[0];
    const selectedInGroup = group.transactions.filter(t => selectedIds?.has(t.id));

    return (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden
                        transition-all duration-200">
            <button onClick={onToggle}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30
                               transition-colors text-left">
                <div className="w-12 h-12 bg-blue-600/15 border border-blue-500/30
                                rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-300 text-xs font-bold leading-tight text-center px-1">
                        {group.symbol.slice(0,4)}
                    </span>
                </div>
                <StockLogo symbol={group.symbol} name={group.name} size={36} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-bold text-base">{group.symbol}</p>
                        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-lg">
                            {group.transactions.length} transaction{group.transactions.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">{group.name}</p>
                </div>
                <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    {buys.length > 0 && (
                        <div className="text-center">
                            <p className="text-green-400 font-semibold text-sm">{buys.length} BUY</p>
                            <p className="text-slate-500 text-xs">{fmt(totalBought)}</p>
                        </div>
                    )}
                    {sells.length > 0 && (
                        <div className="text-center">
                            <p className="text-red-400 font-semibold text-sm">{sells.length} SELL</p>
                            <p className="text-slate-500 text-xs">{fmt(totalSold)}</p>
                        </div>
                    )}
                    <div className="text-right">
                        <p className="text-slate-500 text-xs">Last</p>
                        <p className="text-slate-300 text-xs font-medium">
                            {fmtDate(latest?.transactionDate)}
                        </p>
                    </div>
                </div>
                <div className={"text-slate-500 transition-transform duration-200 flex-shrink-0 " +
                (expanded ? "rotate-180" : "")}>▼</div>
            </button>

            {expanded && (
                <div className="border-t border-slate-700/60">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-slate-900/40 text-slate-500 text-xs uppercase">
                            <th className="text-left px-5 py-2.5">Type</th>
                            <th className="text-right px-5 py-2.5">Qty</th>
                            <th className="text-right px-5 py-2.5">Price</th>
                            <th className="text-right px-5 py-2.5">Total</th>
                            <th className="text-right px-5 py-2.5">Date</th>
                            <th className="px-5 py-2.5"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {group.transactions.map(tx => {
                            const isBuy = tx.type === "BUY";
                            return (
                                <tr key={tx.id}
                                    className="border-t border-slate-700/30 hover:bg-slate-700/20
                                               transition-colors">
                                    <td className="px-2 py-3 w-8" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox"
                                               checked={selectedIds?.has(tx.id) || false}
                                               onChange={() => onToggleSelect?.(tx.id)}
                                               className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={"text-xs font-bold px-2.5 py-1 rounded-lg " +
                                        (isBuy ? "bg-green-900/40 text-green-400"
                                            : "bg-red-900/40 text-red-400")}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="text-right px-5 py-3 text-white">
                                        {parseFloat(tx.quantity || 0).toLocaleString("en-IN")}
                                    </td>
                                    <td className="text-right px-5 py-3 text-slate-300">
                                        {fmt(tx.pricePerShare)}
                                    </td>
                                    <td className={"text-right px-5 py-3 font-semibold " +
                                    (isBuy ? "text-white" : "text-orange-300")}>
                                        {fmt(tx.totalAmount)}
                                    </td>
                                    <td className="text-right px-5 py-3 text-slate-400 text-xs">
                                        <p>{fmtDate(tx.transactionDate)}</p>
                                        {tx.notes && (
                                            <p className="text-slate-600 italic mt-0.5 max-w-[140px] truncate">
                                                {tx.notes}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button onClick={() => onOpenPanel(tx)}
                                                    className="text-xs text-blue-400 hover:text-blue-300
                                                               hover:underline">
                                                + Add
                                            </button>
                                            <button onClick={() => onAskDelete(tx)}
                                                    className="text-xs text-slate-600 hover:text-red-400
                                                               hover:underline">
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-slate-700/30 bg-slate-900/20
                                    flex items-center justify-between gap-3 flex-wrap">
                        <button
                            onClick={() => onOpenPanel({
                                stockId: group.stockId,
                                stockSymbol: group.symbol,
                                stockName: group.name,
                                stockExchange: group.exchange || "NSE",
                            })}
                            className="flex items-center gap-2 text-xs text-blue-400
                                       hover:text-blue-300 transition-colors font-medium">
                            <span className="text-base leading-none">+</span>
                            Add transaction for {group.symbol}
                        </button>
                        {selectedInGroup.length > 0 && (
                            <button
                                onClick={() => onDeleteGroupSelected(selectedInGroup.map(t => t.id))}
                                disabled={bulkDeleting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600
                                           hover:bg-red-700 active:bg-red-700 disabled:opacity-50
                                           text-white text-xs font-semibold rounded-lg transition-colors">
                                🗑 Delete {selectedInGroup.length} selected
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({transactions, year, month, onNavigate, onAddOnDate}) {
    const [selectedDate,  setSelectedDate]  = useState(null);
    const [showMonthPick, setShowMonthPick] = useState(false);
    const [showYearPick,  setShowYearPick]  = useState(false);
    const [showAiImport,  setShowAiImport]  = useState(false);

    const txByDate = useMemo(() => {
        const map = {};
        transactions.forEach(tx => {
            const key = (tx.transactionDate || "").toString().split("T")[0];
            if (!key || key.length !== 10) return;
            if (!map[key]) map[key] = [];
            map[key].push(tx);
        });
        return map;
    }, [transactions]);

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [
        ...Array(firstDay).fill(null),
        ...Array.from({length: daysInMonth}, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const dateKey = (day) => day
        ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
        : null;

    const now     = new Date();
    const isToday = (d) => d && now.getFullYear() === year
        && now.getMonth() === month && now.getDate() === d;

    const selectedTxs = selectedDate ? (txByDate[selectedDate] || []) : [];

    const monthTxs = transactions.filter(tx => {
        const key = (tx.transactionDate || "").toString().split("T")[0];
        return key.startsWith(`${year}-${String(month+1).padStart(2,"0")}`);
    });

    const yearRange = Array.from(
        {length: now.getFullYear() - 2014 + 1},
        (_, i) => 2015 + i
    ).reverse();

    return (
        <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3
                                border-b border-slate-700/60 bg-slate-900/30 gap-2">
                    <button
                        onClick={() => {
                            if (month === 0) onNavigate(year - 1, 11);
                            else onNavigate(year, month - 1);
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-slate-700
                                   hover:bg-slate-600 text-white rounded-xl transition-colors text-lg">
                        ‹
                    </button>

                    {/* Month + Year pickers */}
                    <div className="flex items-center gap-2 flex-1 justify-center">
                        {/* Month */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowMonthPick(v => !v); setShowYearPick(false); }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white
                                           font-bold text-sm rounded-lg transition-colors
                                           flex items-center gap-1">
                                {MONTHS[month]}
                                <span className="text-slate-400 text-xs">▾</span>
                            </button>
                            {showMonthPick && (
                                <div className="absolute top-full left-0 mt-1 bg-slate-800
                                                border border-slate-700 rounded-xl shadow-2xl
                                                z-50 p-2 grid grid-cols-3 gap-1 w-44">
                                    {MONTHS.map((m, i) => (
                                        <button key={i}
                                                onClick={() => { onNavigate(year, i); setShowMonthPick(false); }}
                                                className={"py-1.5 rounded-lg text-xs font-medium transition-colors " +
                                                (i === month
                                                    ? "bg-blue-600 text-white"
                                                    : "text-slate-300 hover:bg-slate-700")}>
                                            {m.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Year */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowYearPick(v => !v); setShowMonthPick(false); }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white
                                           font-bold text-sm rounded-lg transition-colors
                                           flex items-center gap-1">
                                {year}
                                <span className="text-slate-400 text-xs">▾</span>
                            </button>
                            {showYearPick && (
                                <div className="absolute top-full left-0 mt-1 bg-slate-800
                                                border border-slate-700 rounded-xl shadow-2xl
                                                z-50 max-h-48 overflow-y-auto w-24">
                                    {yearRange.map(y => (
                                        <button key={y}
                                                onClick={() => { onNavigate(y, month); setShowYearPick(false); }}
                                                className={"w-full py-2 text-sm font-medium transition-colors " +
                                                (y === year
                                                    ? "bg-blue-600 text-white"
                                                    : "text-slate-300 hover:bg-slate-700")}>
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {monthTxs.length > 0 && (
                            <span className="text-slate-500 text-xs hidden sm:block">
                                {monthTxs.length} tx
                            </span>
                        )}
                    </div>

                    {/* ✨ AI Import */}
                    <button
                        onClick={() => setShowAiImport(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                                   bg-gradient-to-r from-blue-600 to-purple-600
                                   hover:from-blue-500 hover:to-purple-500
                                   text-white rounded-lg transition-all mr-1">
                        ✨ AI
                    </button>

                    <button
                        onClick={() => {
                            if (month === 11) onNavigate(year + 1, 0);
                            else onNavigate(year, month + 1);
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-slate-700
                                   hover:bg-slate-600 text-white rounded-xl transition-colors text-lg">
                        ›
                    </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-700/40">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                        <div key={d} className="py-2.5 text-center text-xs font-semibold
                                                text-slate-500 uppercase tracking-wide">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7">
                    {cells.map((day, i) => {
                        const key     = dateKey(day);
                        const txs     = key ? (txByDate[key] || []) : [];
                        const hasBuy  = txs.some(t => t.type === "BUY");
                        const hasSell = txs.some(t => t.type === "SELL");
                        const active  = selectedDate === key && txs.length > 0;
                        const isWknd  = i % 7 === 0 || i % 7 === 6;
                        const isFuture = day && new Date(year, month, day) > now;

                        return (
                            <div key={i}
                                 onClick={() => {
                                     if (!day) return;
                                     if (txs.length > 0) {
                                         setSelectedDate(active ? null : key);
                                     } else if (!isFuture && onAddOnDate) {
                                         onAddOnDate(key);
                                     }
                                 }}
                                 className={[
                                     "relative flex flex-col items-center py-3 border-b border-r",
                                     "border-slate-700/20 min-h-[72px] group",
                                     !day ? "bg-slate-900/10" : "",
                                     day && !isFuture ? "cursor-pointer" : "",
                                     active ? "bg-blue-600/15" : "",
                                     txs.length > 0 && !active
                                         ? "hover:bg-slate-700/30 transition-colors" : "",
                                     day && txs.length === 0 && !isFuture
                                         ? "hover:bg-slate-700/20 transition-colors" : "",
                                     isWknd && day ? "bg-slate-900/20" : "",
                                 ].filter(Boolean).join(" ")}>
                                {day && (
                                    <>
                                        <span className={[
                                            "text-sm font-bold w-9 h-9 flex items-center",
                                            "justify-center rounded-full transition-all duration-150",
                                            isToday(day) && txs.length === 0
                                                ? "bg-blue-600 text-white ring-2 ring-blue-400/60"
                                                : hasBuy && !hasSell
                                                    ? "bg-green-500/20 text-green-200 ring-1 ring-green-400/60 shadow-[0_0_14px_rgba(74,222,128,0.55)]"
                                                    : hasSell && !hasBuy
                                                        ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/60 shadow-[0_0_14px_rgba(248,113,113,0.55)]"
                                                        : hasBuy && hasSell
                                                            ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.55)]"
                                                            : isFuture
                                                                ? "text-slate-700"
                                                                : "text-slate-400",
                                        ].join(" ")}>
                                            {day}
                                        </span>
                                        {txs.length >= 3 && (
                                            <span className={"text-[9px] font-bold mt-0.5 px-1.5 rounded-full " +
                                            (hasBuy && !hasSell ? "text-green-500 bg-green-500/10"
                                                : hasSell && !hasBuy ? "text-red-500 bg-red-500/10"
                                                    : "text-amber-500 bg-amber-500/10")}>
                                                {txs.length}
                                            </span>
                                        )}
                                        {txs.length === 0 && !isFuture && onAddOnDate && (
                                            <span className="absolute bottom-1 text-[9px] text-slate-600
                                                             opacity-0 group-hover:opacity-100
                                                             transition-opacity font-medium">
                                                + add
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-700/40
                                bg-slate-900/20 flex-wrap">
                    {[
                        {color: "green", label: "Buy"},
                        {color: "red",   label: "Sell"},
                        {color: "amber", label: "Mixed"},
                    ].map(({color, label}) => (
                        <div key={label} className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full bg-${color}-500/20
                                             ring-1 ring-${color}-400/60`} />
                            <span className="text-xs text-slate-500">{label}</span>
                        </div>
                    ))}
                    <span className="text-slate-700 text-xs ml-auto hidden sm:block">
                        Click any date to add transaction
                    </span>
                </div>
            </div>

            {/* Selected date transactions */}
            {selectedDate && selectedTxs.length > 0 && (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-semibold text-sm">
                            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN",
                                {weekday: "long", day: "numeric", month: "long", year: "numeric"})}
                        </p>
                        {onAddOnDate && (
                            <button
                                onClick={() => onAddOnDate(selectedDate)}
                                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                                           text-white rounded-lg transition-colors font-medium">
                                + Add more
                            </button>
                        )}
                    </div>
                    {selectedTxs.map(tx => (
                        <div key={tx.id}
                             className="flex items-center gap-3 py-2.5
                                        border-b border-slate-700/40 last:border-0">
                            <span className={"text-xs font-bold px-2 py-0.5 rounded-full " +
                            (tx.type === "BUY"
                                ? "bg-green-900/40 text-green-400"
                                : "bg-red-900/40 text-red-400")}>
                                {tx.type}
                            </span>
                            <p className="text-white text-sm font-medium flex-1">
                                {tx.stockSymbol || tx.stock?.symbol}
                            </p>
                            <p className="text-slate-400 text-sm">{tx.quantity} shares</p>
                            <p className="text-white text-sm font-semibold">
                                {fmt(tx.pricePerShare)}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {showAiImport && (
                <AiTradeImportModal
                    onClose={() => setShowAiImport(false)}
                    onImported={() => setShowAiImport(false)}
                />
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
    const [transactions,   setTx]            = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [viewMode,       setViewMode]       = useState("stocks");
    const [filterType,     setFilterType]     = useState("ALL");
    const [showAdd,        setShowAdd]        = useState(false);
    const [prefilledDate,  setPrefilledDate]  = useState(null);  // ← date from calendar click
    const [quickAddStock,  setQuickAddStock]  = useState(null);
    const [activeStock,    setActiveStock]    = useState(null);
    const [dialog,         setDialog]         = useState({open: false});
    const [selectedIds,    setSelectedIds]    = useState(new Set());
    const [bulkDeleting,   setBulkDeleting]   = useState(false);
    const [calYear,        setCalYear]        = useState(new Date().getFullYear());
    const [calMonth,       setCalMonth]       = useState(new Date().getMonth());
    const [expandedSymbol, setExpanded]       = useState(null);
    const [showAiImport,   setShowAiImport]   = useState(false);
    const [showExcelImport, setShowExcelImport] = useState(false);
    const toast = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res  = await getTransactions(0, 500);
            const data = res.data?.content || res.data || [];
            setTx([...data].sort((a, b) => {
                const da = (a.transactionDate || "").toString();
                const db = (b.transactionDate || "").toString();
                return db.localeCompare(da);
            }));
        } catch {
            toast.error("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const groups = useMemo(() => {
        const filtered = filterType === "ALL"
            ? transactions
            : transactions.filter(t => t.type === filterType);
        const map = new Map();
        filtered.forEach(tx => {
            if (!map.has(tx.stockSymbol)) {
                map.set(tx.stockSymbol, {
                    symbol: tx.stockSymbol,
                    name: tx.stockName || tx.stockSymbol,
                    exchange: tx.stockExchange || "NSE",
                    stockId: tx.stockId,
                    transactions: [],
                });
            }
            map.get(tx.stockSymbol).transactions.push(tx);
        });
        return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
    }, [transactions, filterType]);

    const openPanel = (tx) => setActiveStock({
        id: tx.stockId,
        symbol: tx.stockSymbol,
        name: tx.stockName,
        exchange: tx.stockExchange || "NSE",
    });

    const askDelete = (tx) => setDialog({
        open: true,
        title: "Delete Transaction",
        message: `Delete ${tx.type} ${tx.quantity} × ${tx.stockSymbol}?`,
        tx,
    });

    const handleDeleteConfirmed = async () => {
        const tx = dialog.tx;
        setDialog({open: false});
        try {
            await deleteTransaction(tx.id);
            toast.success(`Deleted ${tx.stockSymbol} transaction`);
            load();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(transactions.map(t => t.id)));
    };

    const clearSelection = () => setSelectedIds(new Set());

    const deleteByIds = async (ids) => {
        if (!ids.length) return;
        const confirmed = window.confirm(
            `Delete ${ids.length} transaction${ids.length > 1 ? "s" : ""}? This will recompute your holdings.`
        );
        if (!confirmed) return;
        setBulkDeleting(true);
        try {
            await bulkDeleteTransactions(ids);
            toast.success(`Deleted ${ids.length} transaction${ids.length > 1 ? "s" : ""}`);
            setSelectedIds(prev => {
                const next = new Set(prev);
                ids.forEach(i => next.delete(i));
                return next;
            });
            load();
        } catch {
            toast.error("Delete failed");
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleBulkDelete = () => deleteByIds([...selectedIds]);

    const handleExportCSV = () => {
        const rows = transactions.map(t => [
            t.stockSymbol || "", t.type || "", t.quantity || "",
            t.pricePerShare || "", t.totalAmount || "", t.transactionDate || "", t.notes || "",
        ]);
        const csv = [["Stock","Type","Qty","Price","Total","Date","Notes"], ...rows]
            .map(r => r.map(v => `"${v}"`).join(",")).join("\n");
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(new Blob([csv], {type: "text/csv"})),
            download: `transactions_${today()}.csv`,
        });
        a.click();
    };

    // Called from calendar when user clicks an empty date
    const handleAddOnDate = (dateStr) => {
        setPrefilledDate(dateStr);
        setShowAdd(true);
    };

    // How many distinct stocks the current selection spans. The top (bulk) bar
    // only makes sense when it's 2+; a single-stock selection is handled by that
    // stock's own "Delete N selected" button.
    const selectedStockSpan = useMemo(() => {
        const syms = new Set();
        transactions.forEach(t => { if (selectedIds.has(t.id)) syms.add(t.stockSymbol); });
        return syms.size;
    }, [transactions, selectedIds]);
    const showTopBulk = selectedStockSpan >= 2;

    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transactions</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {transactions.length} total · {groups.length} stocks
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowAiImport(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600
                                       hover:bg-purple-700 text-white text-sm font-semibold
                                       rounded-xl transition-colors">
                        ✨ AI Import
                    </button>
                    <button onClick={() => setShowExcelImport(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600
                                       hover:bg-emerald-700 text-white text-sm font-semibold
                                       rounded-xl transition-colors">
                        📊 Import Excel
                    </button>
                    <button onClick={() => { setPrefilledDate(null); setShowAdd(true); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600
                                       hover:bg-blue-700 text-white text-sm font-semibold
                                       rounded-xl transition-colors">
                        + Add Transaction
                    </button>
                    <button onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700
                                       hover:bg-slate-600 text-white text-sm font-medium
                                       rounded-xl border border-slate-600 transition-colors">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            {/* Sticky bulk bar — only when the selection spans 2+ stocks.
                Stays pinned on scroll; collapses to per-stock delete at 1 stock. */}
            {showTopBulk && (
                <div className="sticky top-14 md:top-0 z-40 flex items-center gap-2
                                bg-blue-600/20 backdrop-blur border border-blue-500/40
                                rounded-xl px-3 py-2 shadow-lg">
                    <span className="text-blue-200 text-sm font-medium">
                        {selectedIds.size} selected · {selectedStockSpan} stocks
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700
                                   active:bg-red-700 disabled:opacity-50 text-white text-xs
                                   font-semibold rounded-lg transition-colors">
                        {bulkDeleting ? "Deleting…" : "🗑 Delete selected"}
                    </button>
                    <button onClick={clearSelection}
                            className="ml-auto text-slate-300 hover:text-white active:text-white
                                       text-sm transition-colors px-1">
                        ✕
                    </button>
                </div>
            )}

            {/* Controls bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex bg-slate-800 border border-slate-700/60 rounded-xl p-1 gap-1">
                    {[
                        {id: "stocks",   icon: "📦", label: "By Stock"},
                        {id: "calendar", icon: "📅", label: "Calendar"},
                    ].map(m => (
                        <button key={m.id} onClick={() => setViewMode(m.id)}
                                className={"flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs " +
                                "font-semibold transition-all " +
                                (viewMode === m.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                                    : "text-slate-400 hover:text-white")}>
                            <span>{m.icon}</span>{m.label}
                        </button>
                    ))}
                </div>
                {viewMode === "stocks" && (
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                        {["ALL","BUY","SELL"].map(t => (
                            <button key={t} onClick={() => setFilterType(t)}
                                    className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors " +
                                    (filterType === t
                                        ? t === "BUY" ? "bg-green-600 text-white"
                                            : t === "SELL" ? "bg-red-600 text-white"
                                                : "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-white")}>
                                {t}
                            </button>
                        ))}
                    </div>
                )}
                <p className="text-xs text-slate-600 ml-auto">
                    {viewMode === "stocks"
                        ? `${groups.length} stock${groups.length !== 1 ? "s" : ""}`
                        : `${MONTHS[calMonth]} ${calYear}`}
                </p>
            </div>

            {/* Content */}
            {loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse"/>
                    ))}
                </div>
            ) : transactions.length === 0 ? (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60 p-16 text-center">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-white font-semibold">No transactions yet</p>
                    <p className="text-slate-500 text-sm mt-2 mb-4">
                        Add manually or use ✨ AI Import to scan a screenshot
                    </p>
                    <div className="flex items-center gap-3 justify-center">
                        <button onClick={() => setShowAiImport(true)}
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700
                                           text-white text-sm font-semibold rounded-xl
                                           transition-colors">
                            ✨ AI Import
                        </button>
                        <button onClick={() => setShowExcelImport(true)}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700
                                           text-white text-sm font-semibold rounded-xl
                                           transition-colors">
                            📊 Import Excel
                        </button>
                        <button onClick={() => { setPrefilledDate(null); setShowAdd(true); }}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700
                                           text-white text-sm font-semibold rounded-xl
                                           transition-colors">
                            + Add Manually
                        </button>
                    </div>
                </div>
            ) : viewMode === "stocks" ? (
                <div className="space-y-3">
                    {groups.length === 0 ? (
                        <div className="bg-slate-800 rounded-2xl border border-slate-700/60
                                        p-12 text-center">
                            <p className="text-slate-500 text-sm">No transactions match this filter</p>
                        </div>
                    ) : groups.map(group => (
                        <StockGroupCard
                            key={group.symbol}
                            group={group}
                            expanded={expandedSymbol === group.symbol}
                            onToggle={() => setExpanded(
                                expandedSymbol === group.symbol ? null : group.symbol
                            )}
                            onOpenPanel={openPanel}
                            onAskDelete={askDelete}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onDeleteGroupSelected={deleteByIds}
                            bulkDeleting={bulkDeleting}
                        />
                    ))}
                </div>
            ) : (
                <CalendarView
                    transactions={transactions}
                    year={calYear}
                    month={calMonth}
                    onNavigate={(y, m) => { setCalYear(y); setCalMonth(m); }}
                    onAddOnDate={handleAddOnDate}  // ← wired up
                />
            )}

            {/* Modals */}
            {showAdd && (
                <AddTransactionModal
                    onClose={() => { setShowAdd(false); setPrefilledDate(null); }}
                    onSaved={() => { setShowAdd(false); setPrefilledDate(null); load(); }}
                    onSavedAndMore={() => load()}
                    toast={toast}
                    defaultDate={prefilledDate}  // ← passed to modal
                />
            )}

            {quickAddStock && (
                <AddTransactionModal
                    onClose={() => setQuickAddStock(null)}
                    onSaved={() => { setQuickAddStock(null); load(); }}
                    onSavedAndMore={() => load()}
                    toast={toast}
                    lockedStock={quickAddStock}
                />
            )}

            {activeStock && (
                <StockTransactionPanel
                    stock={activeStock}
                    onClose={() => setActiveStock(null)}
                    onChanged={() => load()}
                />
            )}

            {showAiImport && (
                <AiTradeImportModal
                    onClose={() => setShowAiImport(false)}
                    onImported={() => { setShowAiImport(false); load(); }}
                />
            )}

            {showExcelImport && (
                <ExcelImportModal
                    onClose={() => setShowExcelImport(false)}
                    onImported={() => load()}
                />
            )}

            <ConfirmDialog
                dialog={dialog}
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setDialog({open: false})}
            />
        </div>
    );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────
function AddTransactionModal({onClose, onSaved, onSavedAndMore, toast, lockedStock, defaultDate}) {
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [stock,        setStock]       = useState(null);
    const [livePrice,    setLivePrice]   = useState(null);
    const [priceLoading, setPriceLoad]   = useState(false);
    const [form,         setForm]        = useState({
        type: "BUY", quantity: "", price: "",
        date: defaultDate || today(),  // ← uses prefilled date if provided
        notes: "",
    });
    const [saving, setSaving] = useState(false);
    const debRef   = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (lockedStock) {
            selectStock(lockedStock);
        } else {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, []);

    // Update date if defaultDate changes
    useEffect(() => {
        if (defaultDate) setForm(f => ({...f, date: defaultDate}));
    }, [defaultDate]);

    const handleSearch = (q) => {
        setQuery(q);
        setStock(null);
        setLivePrice(null);
        clearTimeout(debRef.current);
        if (q.length < 2) { setResults([]); return; }
        debRef.current = setTimeout(async () => {
            try {
                const res = await searchStocks(q);
                setResults(res.data?.content || []);
            } catch { setResults([]); }
        }, 300);
    };

    const selectStock = async (s) => {
        setStock(s);
        setQuery(s.symbol + " — " + s.name);
        setResults([]);
        setPriceLoad(true);
        try {
            const res = await getStockPrice(s.symbol);
            const p   = res?.currentPrice;
            if (p) {
                setLivePrice(p);
                setForm(f => ({...f, price: p.toString()}));
            }
        } catch {} finally { setPriceLoad(false); }
    };

    const handleSubmit = async (keepOpen = false) => {
        if (!stock)       { toast.error("Select a stock"); return; }
        if (!form.quantity) { toast.error("Enter quantity"); return; }
        if (!form.price)    { toast.error("Enter price"); return; }
        setSaving(true);
        try {
            await addTransaction({
                stockId: stock.id,
                type: form.type,
                quantity: parseFloat(form.quantity),
                pricePerShare: parseFloat(form.price),
                transactionDate: form.date,
                notes: form.notes || null,
            });
            toast.success(`${form.type} ${form.quantity} × ${stock.symbol} saved`);
            if (keepOpen) {
                setForm(f => ({...f, quantity: "", notes: ""}));
                onSavedAndMore();
            } else onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save");
        } finally { setSaving(false); }
    };

    const total = form.quantity && form.price
        ? (parseFloat(form.quantity) * parseFloat(form.price)).toFixed(2) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
            <div className="relative z-50 w-full max-w-lg bg-slate-900 rounded-2xl
                            border border-slate-700 shadow-2xl"
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700">
                    <div>
                        <h2 className="text-white font-bold text-lg">Add Transaction</h2>
                        {defaultDate && (
                            <p className="text-blue-400 text-xs mt-0.5">
                                📅 {new Date(defaultDate + "T00:00:00")
                                .toLocaleDateString("en-IN",
                                    {day: "numeric", month: "short", year: "numeric"})}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700
                                       rounded-xl transition-colors">✕</button>
                </div>
                <div className="p-6 space-y-4">
                    {/* Stock search */}
                    <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1.5">
                            Stock *
                        </label>
                        <div className="relative">
                            <input ref={inputRef} type="text" value={query}
                                   onChange={e => !lockedStock && handleSearch(e.target.value)}
                                   placeholder="Search symbol or company..."
                                   readOnly={!!lockedStock}
                                   className={"w-full bg-slate-800 border border-slate-700 rounded-xl " +
                                   "px-4 py-2.5 text-white text-sm focus:outline-none " +
                                   "focus:border-blue-500 " +
                                   (lockedStock ? "opacity-70 cursor-not-allowed" : "")}/>
                            {results.length > 0 && !stock && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800
                                                border border-slate-700 rounded-xl shadow-xl
                                                max-h-52 overflow-y-auto">
                                    {results.map(s => (
                                        <button key={s.id} onClick={() => selectStock(s)}
                                                className="w-full text-left px-4 py-3
                                                           hover:bg-slate-700 border-b
                                                           border-slate-700/50 last:border-0">
                                            <span className="font-bold text-white text-sm">
                                                {s.symbol}
                                            </span>
                                            <span className="text-slate-400 text-xs ml-2">
                                                {s.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {stock && (
                            <div className="flex items-center gap-3 mt-1.5">
                                <p className="text-xs text-green-400">✓ {stock.symbol}</p>
                                {priceLoading && (
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <span className="w-3 h-3 border border-blue-400
                                                         border-t-transparent rounded-full
                                                         animate-spin inline-block"/>
                                        Fetching price…
                                    </span>
                                )}
                                {livePrice && !priceLoading && (
                                    <span className="text-xs bg-blue-900/40 text-blue-300
                                                     px-2.5 py-1 rounded-lg font-semibold">
                                        Live: ₹{parseFloat(livePrice).toLocaleString("en-IN",
                                        {maximumFractionDigits: 2})}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* BUY/SELL toggle */}
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                        {["BUY","SELL"].map(t => (
                            <button key={t} onClick={() => setForm(f => ({...f, type: t}))}
                                    className={"px-6 py-2 rounded-lg text-sm font-bold transition-colors " +
                                    (form.type === t
                                        ? t === "BUY" ? "bg-green-600 text-white"
                                            : "bg-red-600 text-white"
                                        : "text-slate-400 hover:text-white")}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Fields */}
                    <div className="grid grid-cols-3 gap-3">
                        {[["Quantity *","quantity","e.g. 10"],
                            ["Price (₹) *","price","e.g. 500"]].map(([l, k, p]) => (
                            <div key={k}>
                                <label className="text-xs text-slate-400 block mb-1">
                                    {l}
                                    {k === "price" && livePrice && (
                                        <button type="button"
                                                onClick={() => setForm(f => ({
                                                    ...f, price: livePrice.toString()
                                                }))}
                                                className="ml-2 text-blue-400 hover:text-blue-300
                                                           underline font-normal">
                                            use live
                                        </button>
                                    )}
                                </label>
                                <input type="number" step="0.01" min="0.01"
                                       value={form[k]}
                                       onChange={e => setForm(f => ({...f, [k]: e.target.value}))}
                                       placeholder={p}
                                       className="w-full bg-slate-800 border border-slate-700
                                                  rounded-xl px-3 py-2.5 text-white text-sm
                                                  focus:outline-none focus:border-blue-500"/>
                            </div>
                        ))}
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Date *</label>
                            <input type="date" value={form.date} max={today()}
                                   onChange={e => setForm(f => ({...f, date: e.target.value}))}
                                   className="w-full bg-slate-800 border border-slate-700
                                              rounded-xl px-3 py-2.5 text-white text-sm
                                              focus:outline-none focus:border-blue-500"/>
                        </div>
                    </div>

                    {total && (
                        <div className="flex items-center justify-between bg-slate-800
                                        rounded-xl px-4 py-2.5">
                            <span className="text-slate-400 text-sm">Total</span>
                            <span className="text-white font-bold">₹{total}</span>
                        </div>
                    )}

                    <input type="text" value={form.notes}
                           onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                           placeholder="Notes (optional)"
                           className="w-full bg-slate-800 border border-slate-700 rounded-xl
                                      px-4 py-2.5 text-white text-sm focus:outline-none
                                      focus:border-blue-500"/>

                    <div className="flex gap-2 pt-1">
                        <button onClick={() => handleSubmit(false)} disabled={saving}
                                className={"flex-1 py-3 rounded-xl text-white font-bold text-sm " +
                                "transition-colors disabled:opacity-50 " +
                                (form.type === "BUY"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-600 hover:bg-red-700")}>
                            {saving ? "Saving…" : `Save ${form.type}`}
                        </button>
                        <button onClick={() => handleSubmit(true)} disabled={saving}
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600
                                           text-white text-sm font-semibold rounded-xl
                                           transition-colors disabled:opacity-50">
                            Save & Add Another
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}