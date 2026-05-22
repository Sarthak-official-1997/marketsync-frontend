import {useState, useEffect, useRef, useMemo} from "react";
import {
    getTransactions, addTransaction, deleteTransaction,
    searchStocks, getStockPrice,
} from "../api/portfolio";
import StockTransactionPanel from "../components/StockTransactionPanel";
import {useToast} from "../context/ToastContext";

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        return `${day}/${m}/${y}`;
    } catch {
        return d;
    }
};

const fmtShortDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${day} ${mo[parseInt(m, 10) - 1]} ${y}`;
    } catch {
        return d;
    }
};

const today = () => new Date().toISOString().split("T")[0];

const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

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
function StockGroupCard({group, expanded, onToggle, onOpenPanel, onAskDelete}) {
    const buys = group.transactions.filter(t => t.type === "BUY");
    const sells = group.transactions.filter(t => t.type === "SELL");
    const totalBought = buys.reduce((s, t) => s + parseFloat(t.totalAmount || 0), 0);
    const totalSold = sells.reduce((s, t) => s + parseFloat(t.totalAmount || 0), 0);
    const latest = group.transactions[0]; // already sorted newest-first

    return (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden
                        transition-all duration-200">
            {/* ── Card header — click to expand ── */}
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30
                           transition-colors text-left"
            >
                {/* Stock badge */}
                <div className="w-12 h-12 bg-blue-600/15 border border-blue-500/30
                                rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-300 text-xs font-bold leading-tight text-center px-1">
                        {group.symbol.slice(0, 4)}
                    </span>
                </div>

                {/* Stock info */}
                <StockLogo symbol={group.symbol} name={group.name} size={36} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-bold text-base">{group.symbol}</p>
                        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-lg">
                            {group.transactions.length} transaction{group.transactions.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">
                        {group.name}
                    </p>
                </div>

                {/* Summary stats */}
                <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    {buys.length > 0 && (
                        <div className="text-center">
                            <p className="text-green-400 font-semibold text-sm">
                                {buys.length} BUY
                            </p>
                            <p className="text-slate-500 text-xs">{fmt(totalBought)}</p>
                        </div>
                    )}
                    {sells.length > 0 && (
                        <div className="text-center">
                            <p className="text-red-400 font-semibold text-sm">
                                {sells.length} SELL
                            </p>
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

                {/* Chevron */}
                <div className={"text-slate-500 transition-transform duration-200 flex-shrink-0 " +
                (expanded ? "rotate-180" : "")}>
                    ▼
                </div>
            </button>

            {/* ── Expanded transaction list ── */}
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
                                    <td className="px-5 py-3">
                                        <span className={"text-xs font-bold px-2.5 py-1 rounded-lg " +
                                        (isBuy
                                            ? "bg-green-900/40 text-green-400"
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
                                            <button
                                                onClick={() => onOpenPanel(tx)}
                                                className="text-xs text-blue-400 hover:text-blue-300
                                                           hover:underline">
                                                + Add
                                            </button>
                                            <button
                                                onClick={() => onAskDelete(tx)}
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
                    {/* Add transaction shortcut */}
                    <div className="px-5 py-3 border-t border-slate-700/30 bg-slate-900/20">
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
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({transactions, year, month, onNavigate}) {
    const [selectedDate, setSelectedDate] = useState(null);

    // Map of "YYYY-MM-DD" → transactions[]
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

    const prevMonth = () => {
        if (month === 0) onNavigate(year - 1, 11);
        else onNavigate(year, month - 1);
    };
    const nextMonth = () => {
        if (month === 11) onNavigate(year + 1, 0);
        else onNavigate(year, month + 1);
    };

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();  // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [
        ...Array(firstDay).fill(null),
        ...Array.from({length: daysInMonth}, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const dateKey = (day) => day
        ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        : null;

    const now = new Date();
    const isToday = (d) =>
        d && now.getFullYear() === year &&
        now.getMonth() === month && now.getDate() === d;

    const selectedTxs = selectedDate ? (txByDate[selectedDate] || []) : [];

    // Count transactions in this month for summary
    const monthTxs = transactions.filter(tx => {
        const key = (tx.transactionDate || "").toString().split("T")[0];
        return key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);
    });

    return (
        <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">

                {/* ── Month navigation ── */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700/60 bg-slate-900/30">
                    <button
                        onClick={prevMonth}
                        className="w-9 h-9 flex items-center justify-center bg-slate-700
                                   hover:bg-slate-600 text-white rounded-xl transition-colors
                                   text-lg font-bold">
                        ‹
                    </button>

                    <div className="text-center">
                        <p className="text-white font-bold text-lg">
                            {MONTHS[month]} {year}
                        </p>
                        {monthTxs.length > 0 && (
                            <p className="text-slate-500 text-xs mt-0.5">
                                {monthTxs.length} transaction{monthTxs.length !== 1 ? "s" : ""} this month
                            </p>
                        )}
                    </div>

                    <button
                        onClick={nextMonth}
                        className="w-9 h-9 flex items-center justify-center bg-slate-700
                                   hover:bg-slate-600 text-white rounded-xl transition-colors
                                   text-lg font-bold">
                        ›
                    </button>
                </div>

                {/* ── Day headers ── */}
                <div className="grid grid-cols-7 border-b border-slate-700/40">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                        <div key={d}
                             className="py-2.5 text-center text-xs font-semibold
                                        text-slate-500 uppercase tracking-wide">
                            {d}
                        </div>
                    ))}
                </div>

                {/* ── Calendar grid ── */}
                <div className="grid grid-cols-7">
                    {cells.map((day, i) => {
                        const key = dateKey(day);
                        const txs = key ? (txByDate[key] || []) : [];
                        const hasBuy = txs.some(t => t.type === "BUY");
                        const hasSell = txs.some(t => t.type === "SELL");
                        const active = selectedDate === key && txs.length > 0;
                        const isWeekend = i % 7 === 0 || i % 7 === 6;

                        return (
                            <div
                                key={i}
                                onClick={() => {
                                    if (!day || !key || txs.length === 0) return;
                                    setSelectedDate(active ? null : key);
                                }}
                                className={[
                                    "relative flex flex-col items-center py-3 border-b border-r",
                                    "border-slate-700/20 min-h-[72px]",
                                    !day ? "bg-slate-900/10" : "",
                                    txs.length > 0 ? "cursor-pointer" : "",
                                    active ? "bg-blue-600/15" : "",
                                    txs.length > 0 && !active
                                        ? "hover:bg-slate-700/30 transition-colors" : "",
                                    isWeekend && day ? "bg-slate-900/20" : "",
                                ].join(" ")}
                            >
                                {day && (
                                    <>
                                        {/* Glowing date circle — color tells you what happened */}
                                        <span className={[
                                            "text-sm font-bold w-9 h-9 flex items-center justify-center",
                                            "rounded-full transition-all duration-150",
                                            isToday(day) && txs.length === 0
                                                ? "bg-blue-600 text-white ring-2 ring-blue-400/60"
                                                : isToday(day) && hasBuy && !hasSell
                                                    ? "bg-blue-600 text-white ring-2 ring-green-400/80 " +
                                                    "shadow-[0_0_14px_rgba(74,222,128,0.5)]"
                                                    : isToday(day) && hasSell && !hasBuy
                                                        ? "bg-blue-600 text-white ring-2 ring-red-400/80 " +
                                                        "shadow-[0_0_14px_rgba(248,113,113,0.5)]"
                                                        : isToday(day)
                                                            ? "bg-blue-600 text-white ring-2 ring-amber-400/80 " +
                                                            "shadow-[0_0_14px_rgba(251,191,36,0.5)]"
                                                            : hasBuy && !hasSell
                                                                // BUY only — green glow
                                                                ? "bg-green-500/20 text-green-200 " +
                                                                "ring-1 ring-green-400/60 " +
                                                                "shadow-[0_0_14px_rgba(74,222,128,0.55)]"
                                                                : hasSell && !hasBuy
                                                                    // SELL only — red glow
                                                                    ? "bg-red-500/20 text-red-200 " +
                                                                    "ring-1 ring-red-400/60 " +
                                                                    "shadow-[0_0_14px_rgba(248,113,113,0.55)]"
                                                                    : hasBuy && hasSell
                                                                        // Mixed BUY+SELL on same day — amber glow
                                                                        ? "bg-amber-500/20 text-amber-200 " +
                                                                        "ring-1 ring-amber-400/60 " +
                                                                        "shadow-[0_0_14px_rgba(251,191,36,0.55)]"
                                                                        : "text-slate-500",
                                        ].join(" ")}>
            {day}
        </span>

                                        {/* Count badge for 3+ transactions (subtle, below circle) */}
                                        {txs.length >= 3 && (
                                            <span className={
                                                "text-[9px] font-bold mt-0.5 px-1.5 rounded-full " +
                                                (hasBuy && !hasSell ? "text-green-500 bg-green-500/10"
                                                    : hasSell && !hasBuy ? "text-red-500 bg-red-500/10"
                                                        : "text-amber-500 bg-amber-500/10")
                                            }>
                {txs.length}
            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Legend ── */}
                <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-700/40
                bg-slate-900/20">
                    <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-green-500/20 ring-1 ring-green-400/60
                         shadow-[0_0_8px_rgba(74,222,128,0.5)] flex items-center
                         justify-center text-green-200 text-[10px] font-bold">
            12
        </span>
                        <span className="text-xs text-slate-500">Buy</span>
                    </div>
                    <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-red-500/20 ring-1 ring-red-400/60
                         shadow-[0_0_8px_rgba(248,113,113,0.5)] flex items-center
                         justify-center text-red-200 text-[10px] font-bold">
            8
        </span>
                        <span className="text-xs text-slate-500">Sell</span>
                    </div>
                    <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-amber-500/20 ring-1 ring-amber-400/60
                         shadow-[0_0_8px_rgba(251,191,36,0.5)] flex items-center
                         justify-center text-amber-200 text-[10px] font-bold">
            5
        </span>
                        <span className="text-xs text-slate-500">Both</span>
                    </div>
                    <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center
                         justify-center text-white text-[10px] font-bold">
            {new Date().getDate()}
        </span>
                        <span className="text-xs text-slate-500">Today</span>
                    </div>
                    <span className="text-xs text-slate-600 ml-auto">Click a glowing date to view transactions</span>
                </div>
            </div>

            {/* ── Selected date transactions ── */}
            {selectedDate && selectedTxs.length > 0 && (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5
                                    border-b border-slate-700/60 bg-slate-900/20">
                        <div>
                            <p className="text-white font-semibold">
                                {fmtShortDate(selectedDate)}
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                                {selectedTxs.length} transaction{selectedTxs.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700
                                       rounded-lg transition-colors text-xs">
                            ✕
                        </button>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-slate-500 text-xs uppercase">
                            <th className="text-left px-5 py-2.5">Stock</th>
                            <th className="text-left px-5 py-2.5">Type</th>
                            <th className="text-right px-5 py-2.5">Qty</th>
                            <th className="text-right px-5 py-2.5">Price</th>
                            <th className="text-right px-5 py-2.5">Total</th>
                        </tr>
                        </thead>
                        <tbody>
                        {selectedTxs.map(tx => {
                            const isBuy = tx.type === "BUY";
                            return (
                                <tr key={tx.id}
                                    className="border-t border-slate-700/30 hover:bg-slate-700/20">
                                    <td className="px-5 py-3">
                                        <p className="text-white font-semibold">{tx.stockSymbol}</p>
                                        <p className="text-slate-500 text-xs">{tx.stockName}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={"text-xs font-bold px-2.5 py-1 rounded-lg " +
                                        (isBuy
                                            ? "bg-green-900/40 text-green-400"
                                            : "bg-red-900/40 text-red-400")}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="text-right px-5 py-3 text-white">
                                        {parseFloat(tx.quantity || 0).toLocaleString()}
                                    </td>
                                    <td className="text-right px-5 py-3 text-slate-300">
                                        {fmt(tx.pricePerShare)}
                                    </td>
                                    <td className={"text-right px-5 py-3 font-semibold " +
                                    (isBuy ? "text-white" : "text-orange-300")}>
                                        {fmt(tx.totalAmount)}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
    const [transactions, setTx] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState("stocks");   // "stocks" | "calendar"
    const [filterType, setFilterType] = useState("ALL");
    const [showAdd, setShowAdd] = useState(false);
    const [quickAddStock, setQuickAddStock] = useState(null); // for locked-stock quick-add
    const [livePrices, setLivePrices]  = useState({});        // symbol → StockPriceDto
    const [heldQty, setHeldQty]        = useState({});        // symbol → quantity
    const [activeStock, setActiveStock] = useState(null);
    const [dialog, setDialog] = useState({open: false});
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [expandedSymbol, setExpanded] = useState(null);
    const toast = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await getTransactions(0, 500);
            const data = res.data?.content || res.data || [];
            // Sort newest first
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

    useEffect(() => {
        load();
    }, []);

    // ── Stock groups ──────────────────────────────────────────────────────────
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

    const handleExportCSV = () => {
        const rows = transactions.map(t => [
            t.stockSymbol || "", t.type || "", t.quantity || "",
            t.pricePerShare || "", t.totalAmount || "", t.transactionDate || "", t.notes || "",
        ]);
        const csv = [["Stock", "Type", "Qty", "Price", "Total", "Date", "Notes"], ...rows]
            .map(r => r.map(v => `"${v}"`).join(",")).join("\n");
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(new Blob([csv], {type: "text/csv"})),
            download: `transactions_${today()}.csv`,
        });
        a.click();
    };

    return (
        <div className="space-y-4">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transactions</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {transactions.length} total transactions
                        {" · "}{groups.length} stocks
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700
                                       hover:bg-slate-600 text-white text-sm font-medium
                                       rounded-xl border border-slate-600 transition-colors">
                        📥 Export CSV
                    </button>
                    <button onClick={() => setShowAdd(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600
                                       hover:bg-blue-700 text-white text-sm font-semibold
                                       rounded-xl transition-colors">
                        + Add Transaction
                    </button>
                </div>
            </div>

            {/* ── Controls bar ── */}
            <div className="flex items-center gap-3 flex-wrap">

                {/* View mode toggle */}
                <div className="flex bg-slate-800 border border-slate-700/60 rounded-xl p-1 gap-1">
                    {[
                        {id: "stocks", icon: "📦", label: "By Stock"},
                        {id: "calendar", icon: "📅", label: "Calendar"},
                    ].map(m => (
                        <button key={m.id} onClick={() => setViewMode(m.id)}
                                className={
                                    "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs " +
                                    "font-semibold transition-all " +
                                    (viewMode === m.id
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                                        : "text-slate-400 hover:text-white")
                                }>
                            <span>{m.icon}</span>{m.label}
                        </button>
                    ))}
                </div>

                {/* Type filter — only meaningful in stocks view */}
                {viewMode === "stocks" && (
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                        {["ALL", "BUY", "SELL"].map(t => (
                            <button key={t} onClick={() => setFilterType(t)}
                                    className={
                                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors " +
                                        (filterType === t
                                            ? t === "BUY" ? "bg-green-600 text-white"
                                                : t === "SELL" ? "bg-red-600 text-white"
                                                    : "bg-blue-600 text-white"
                                            : "text-slate-400 hover:text-white")
                                    }>
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

            {/* ── Content ── */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse"/>
                    ))}
                </div>
            ) : transactions.length === 0 ? (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60
                                p-16 text-center">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-white font-semibold">No transactions yet</p>
                    <button onClick={() => setShowAdd(true)}
                            className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                                       text-white text-sm font-semibold rounded-xl transition-colors">
                        + Add Your First Transaction
                    </button>
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
                            livePrice={livePrices[group.symbol]}
                            qtyHeld={heldQty[group.symbol] || 0}
                            onQuickAdd={g => setQuickAddStock({
                                id: g.transactions[0]?.stockId,
                                symbol: g.symbol,
                                name: g.name,
                                exchange: "NSE",
                            })}
                        />
                    ))}
                </div>
            ) : (
                <CalendarView
                    transactions={transactions}
                    year={calYear}
                    month={calMonth}
                    onNavigate={(y, m) => {
                        setCalYear(y);
                        setCalMonth(m);
                    }}
                />
            )}

            {/* ── Modals ── */}
            {showAdd && (
                <AddTransactionModal
                    onClose={() => setShowAdd(false)}
                    onSaved={() => { setShowAdd(false); load(); }}
                    onSavedAndMore={() => load()}
                    toast={toast}
                />
            )}

            {/* Quick-add: opened from stock group card — stock is locked */}
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

            <ConfirmDialog
                dialog={dialog}
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setDialog({open: false})}
            />
        </div>
    );
}

// ─── Add Transaction Modal (unchanged) ───────────────────────────────────────
function AddTransactionModal({onClose, onSaved, onSavedAndMore, toast, lockedStock}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [stock, setStock] = useState(null);
    const [livePrice, setLivePrice] = useState(null);
    const [priceLoading, setPriceLoad] = useState(false);
    const [form, setForm] = useState({
        type: "BUY", quantity: "", price: "", date: today(), notes: "",
    });
    const [saving, setSaving] = useState(false);
    const debRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (lockedStock) {
            // Auto-select and fetch price for locked stock
            selectStock(lockedStock);
        } else {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, []);

    const handleSearch = (q) => {
        setQuery(q);
        setStock(null);
        setLivePrice(null);
        clearTimeout(debRef.current);
        if (q.length < 2) {
            setResults([]);
            return;
        }
        debRef.current = setTimeout(async () => {
            try {
                const res = await searchStocks(q);
                setResults(res.data?.content || []);
            } catch {
                setResults([]);
            }
        }, 300);
    };

    const selectStock = async (s) => {
        setStock(s);
        setQuery(s.symbol + " — " + s.name);
        setResults([]);
        setPriceLoad(true);
        try {
            const res = await getStockPrice(s.symbol);
            const p = res?.currentPrice;
            if (p) {
                setLivePrice(p);
                setForm(f => ({...f, price: p.toString()}));
            }
        } catch {
        } finally {
            setPriceLoad(false);
        }
    };

    const handleSubmit = async (keepOpen = false) => {
        if (!stock) {
            toast.error("Select a stock");
            return;
        }
        if (!form.quantity) {
            toast.error("Enter quantity");
            return;
        }
        if (!form.price) {
            toast.error("Enter price");
            return;
        }
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
        } finally {
            setSaving(false);
        }
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
                    <h2 className="text-white font-bold text-lg">Add Transaction</h2>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700
                                       rounded-xl transition-colors">✕
                    </button>
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
                                   className={"w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 " + (lockedStock ? "opacity-70 cursor-not-allowed" : "")}/>
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

                    {/* BUY / SELL toggle */}
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                        {["BUY", "SELL"].map(t => (
                            <button key={t}
                                    onClick={() => setForm(f => ({...f, type: t}))}
                                    className={"px-6 py-2 rounded-lg text-sm font-bold " +
                                    "transition-colors " +
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
                        {[["Quantity *", "quantity", "e.g. 10"],
                            ["Price (₹) *", "price", "e.g. 500"]].map(([l, k, p]) => (
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