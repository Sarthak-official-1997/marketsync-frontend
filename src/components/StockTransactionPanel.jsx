import { useState, useEffect } from "react";
import {
    getTransactions, addTransaction, deleteTransaction,
    getStockPrice, getHoldings,
} from "../api/portfolio";
import { useToast } from "../context/ToastContext";

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

const today = () => new Date().toISOString().split("T")[0];

// -- Beautiful confirm dialog ------------------------------------------
function ConfirmDialog({ dialog, onConfirm, onCancel }) {
    if (!dialog.open) return null;
    return (
        <div className="fixed inset-0 z-[420] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                 onClick={onCancel} />
            <div className="relative z-10 bg-slate-800 border border-slate-700
                            rounded-2xl shadow-2xl p-6 w-full max-w-sm"
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-900/40 rounded-xl flex
                                    items-center justify-center flex-shrink-0">
                        <span className="text-red-400 text-lg">🗑</span>
                    </div>
                    <div>
                        <p className="text-white font-semibold">
                            {dialog.title || "Confirm Delete"}
                        </p>
                        <p className="text-slate-400 text-sm mt-0.5">
                            {dialog.message}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onCancel}
                            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600
                                   text-white text-sm font-medium rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700
                                   text-white text-sm font-bold rounded-xl transition-colors">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ====================================================================
export default function StockTransactionPanel({ stock, onClose, onChanged, onDeleted, defaultType }) {
// ====================================================================

    const [transactions, setTx]       = useState([]);
    const [loading,      setLoad]     = useState(true);
    const [quote,        setQuote]    = useState(null);
    const [showForm,     setShowForm] = useState(false);
    const [dialog, setDialog]         = useState({ open: false });
    const toast = useToast();

    const emptyForm = { type: defaultType || "BUY", quantity: "", price: "", date: today(), notes: "" };
    const [heldQty, setHeldQty] = useState(null); // user's current holding
    const [form,   setForm]   = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        if (!stock) return;
        setLoad(true);
        try {
            const res = await getTransactions(0, 200);
            const all = res.data?.content || res.data || [];
            const filtered = all.filter(t => t.stockSymbol === stock.symbol);
            filtered.sort((a, b) =>
                (b.transactionDate || "").localeCompare(a.transactionDate || "")
            );
            setTx(filtered);
        } catch { toast.error("Failed to load transactions"); }
        finally { setLoad(false); }
    };

    const loadQuote = async () => {
        try {
            const res = await getStockPrice(stock.symbol);
            setQuote(res.data);
            // Pre-fill price in form with current market price
            if (res.data?.currentPrice) {
                setForm(f => ({ ...f, price: res.data.currentPrice.toString() }));
            }
        } catch {}
    };

    useEffect(() => {
        if (!stock) return;
        setTx([]); setQuote(null); setHeldQty(null);
        setShowForm(!!defaultType); // auto-open form when defaultType supplied
        setForm({ type: defaultType || "BUY", quantity: "", price: "", date: today(), notes: "" });
        load();
        loadQuote();
        // Fetch current holding quantity
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
    const pl    = parseFloat(quote?.changePercent || 0);
    const plClr = pl >= 0 ? "text-green-400" : "text-red-400";

    const totalBought = transactions
        .filter(t => t.type === "BUY")
        .reduce((s, t) => s + parseFloat(t.totalAmount || 0), 0);

    const totalSold = transactions
        .filter(t => t.type === "SELL")
        .reduce((s, t) => s + parseFloat(t.totalAmount || 0), 0);

    const handleSubmit = async (keepOpen = false) => {
        if (!form.quantity || !form.price) {
            toast.error("Please enter quantity and price"); return;
        }
        setSaving(true);
        try {
            await addTransaction({
                stockId:         stock.id,
                type:            form.type,
                quantity:        parseFloat(form.quantity),
                pricePerShare:   parseFloat(form.price),
                transactionDate: form.date,
                notes:           form.notes || null,
            });
            toast.success(`${form.type} ${form.quantity} × ${stock.symbol} recorded`);
            setForm({ ...emptyForm, type: form.type,
                price: quote?.currentPrice?.toString() || "" });
            if (!keepOpen) setShowForm(false);
            load();
            if (onChanged) onChanged();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save");
        } finally { setSaving(false); }
    };

    // Ask for confirmation (no window.confirm)
    const askDelete = (tx) => {
        setDialog({
            open: true,
            title: "Delete Transaction",
            message: `Delete ${tx.type} of ${parseFloat(tx.quantity || 0).toLocaleString("en-IN")} shares @ ${fmt(tx.pricePerShare)}?`,
            tx,
        });
    };

    const handleDeleteConfirmed = async () => {
        const tx = dialog.tx;
        setDialog({ open: false });
        try {
            await deleteTransaction(tx.id);
            if (onDeleted) onDeleted(tx);
            toast.success("Transaction deleted");
            load();
            if (onChanged) onChanged();
        } catch { toast.error("Failed to delete"); }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm"
                 onClick={onClose} />

            {/* Drawer */}
            <div className="fixed right-0 top-0 bottom-0 z-[410] w-full max-w-xl
                            bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
                 onClick={e => e.stopPropagation()}>

                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 border border-blue-500/40
                                        rounded-xl px-3 py-2">
                            <p className="text-base font-bold text-white leading-none">
                                {stock.symbol}
                            </p>
                            <p className="text-xs text-blue-400 mt-0.5">{stock.exchange}</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold">{stock.name}</p>
                            {quote ? (
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-bold">
                                        {fmt(quote.currentPrice)}
                                    </p>
                                    <span className={"text-xs " + plClr}>
                                        {pl >= 0 ? "▲" : "▼"} {Math.abs(pl).toFixed(2)}%
                                    </span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Loading price...</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700
                                   rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* SUMMARY STRIP */}
                {transactions.length > 0 && (
                    <div className="grid grid-cols-3 gap-px bg-slate-800/40
                                    border-b border-slate-700/60 flex-shrink-0">
                        {[
                            ["Transactions", transactions.length,  "text-white"],
                            ["Total Bought", fmt(totalBought),     "text-blue-400"],
                            ["Total Sold",   fmt(totalSold),       "text-orange-400"],
                        ].map(([label, value, cls]) => (
                            <div key={label} className="bg-slate-900 px-4 py-3">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className={"text-sm font-bold mt-0.5 " + cls}>{value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ADD FORM */}
                <div className="flex-shrink-0 border-b border-slate-700/60">
                    {!showForm ? (
                        <div className="px-6 py-3">
                            <button onClick={() => setShowForm(true)}
                                    className="w-full flex items-center justify-center gap-2
                                           py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                           font-semibold text-sm rounded-xl transition-colors">
                                <span className="text-lg leading-none">+</span>
                                Add Transaction
                            </button>
                        </div>
                    ) : (
                        <div className="px-6 py-4 bg-slate-800/60 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-white">
                                    New Transaction — {stock.symbol}
                                </p>
                                <button onClick={() => { setShowForm(false); setForm(emptyForm); }}
                                        className="text-slate-500 hover:text-slate-300 text-xs">
                                    Cancel
                                </button>
                            </div>

                            {/* BUY / SELL */}
                            <div className="flex gap-1 bg-slate-700 p-1 rounded-xl w-fit">
                                {["BUY","SELL"].map(t => (
                                    <button key={t}
                                            onClick={() => setForm(f => ({ ...f, type: t }))}
                                            className={
                                                "px-5 py-1.5 rounded-lg text-sm font-bold transition-colors " +
                                                (form.type === t
                                                    ? t === "BUY" ? "bg-green-600 text-white"
                                                        : "bg-red-600 text-white"
                                                    : "text-slate-400 hover:text-white")
                                            }>
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {/* Qty + Price + Date */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Quantity *
                                    </label>
                                    <input type="number" min="1" step="1"
                                           value={form.quantity}
                                           onChange={e => setForm(f => ({
                                               ...f, quantity: Math.max(1, parseInt(e.target.value) || "")
                                           }))}
                                           placeholder="e.g. 10"
                                           className="w-full bg-slate-700 border border-slate-600
                                                   rounded-lg px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500" />
                                    {/* Holding hint for SELL */}
                                    {form.type === "SELL" && heldQty > 0 && (
                                        <p className="text-xs text-blue-400 mt-1.5 font-medium">
                                            📦 You currently hold {heldQty.toFixed(2)} shares
                                        </p>
                                    )}
                                    {form.type === "SELL" && heldQty === 0 && (
                                        <p className="text-xs text-amber-400 mt-1.5">
                                            ⚠ You don't hold any {stock.symbol}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Price (₹) *
                                        {quote?.currentPrice && (
                                            <button type="button"
                                                    onClick={() => setForm(f => ({
                                                        ...f, price: quote.currentPrice.toString()
                                                    }))}
                                                    className="ml-1 text-blue-400 hover:text-blue-300
                                                           underline font-normal text-xs">
                                                use live
                                            </button>
                                        )}
                                    </label>
                                    <input type="number" min="0.01" step="0.01"
                                           value={form.price}
                                           onChange={e => setForm(f => ({
                                               ...f, price: e.target.value
                                           }))}
                                           placeholder={
                                               quote?.currentPrice
                                                   ? quote.currentPrice.toFixed(2)
                                                   : "e.g. 500"
                                           }
                                           className="w-full bg-slate-700 border border-slate-600
                                                   rounded-lg px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Date *
                                    </label>
                                    <input type="date" value={form.date} max={today()}
                                           onChange={e => setForm(f => ({
                                               ...f, date: e.target.value
                                           }))}
                                           className="w-full bg-slate-700 border border-slate-600
                                                   rounded-lg px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>

                            {/* Notes */}
                            <input type="text" value={form.notes}
                                   onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                   placeholder="Notes (optional)"
                                   className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500" />

                            {/* Total preview */}
                            {form.quantity && form.price && (
                                <div className="flex items-center justify-between
                                                bg-slate-700/50 rounded-lg px-3 py-2">
                                    <span className="text-slate-400 text-sm">Total</span>
                                    <span className="text-white font-bold">
                                        {fmt(parseFloat(form.quantity) * parseFloat(form.price))}
                                    </span>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-2">
                                <button onClick={() => handleSubmit(false)} disabled={saving}
                                        className={
                                            "flex-1 py-2.5 rounded-xl text-white font-bold text-sm " +
                                            "transition-colors disabled:opacity-50 " +
                                            (form.type === "BUY"
                                                ? "bg-green-600 hover:bg-green-700"
                                                : "bg-red-600 hover:bg-red-700")
                                        }>
                                    {saving ? "Saving..." : `Save ${form.type}`}
                                </button>
                                <button onClick={() => handleSubmit(true)} disabled={saving}
                                        className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500
                                               text-white text-sm font-semibold rounded-xl
                                               transition-colors disabled:opacity-50">
                                    Save & Add Another
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* TRANSACTIONS LIST */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="space-y-2 p-6">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center
                                        h-full gap-3 text-center px-8">
                            <p className="text-4xl">📋</p>
                            <p className="text-white font-semibold">No transactions yet</p>
                            <p className="text-slate-400 text-sm">
                                Click "+ Add Transaction" to record your first BUY or SELL
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="px-6 py-3 border-b border-slate-700/40">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                                    {transactions.length} Transaction{transactions.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            {transactions.map(tx => {
                                const isBuy = tx.type === "BUY";
                                const qty   = parseFloat(tx.quantity || 0);
                                const price = parseFloat(tx.pricePerShare || 0);
                                const total = parseFloat(tx.totalAmount || 0);

                                return (
                                    <div key={tx.id}
                                         className="flex items-center justify-between px-6 py-4
                                                   border-b border-slate-700/30 hover:bg-slate-800/40
                                                   transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <span className={
                                                "text-xs font-bold px-3 py-1.5 rounded-lg min-w-[48px] text-center " +
                                                (isBuy
                                                    ? "bg-green-900/40 text-green-400"
                                                    : "bg-red-900/40 text-red-400")
                                            }>
                                                {tx.type}
                                            </span>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-white font-semibold text-sm">
                                                        {qty.toLocaleString("en-IN")} shares
                                                    </p>
                                                    <span className="text-slate-500 text-xs">@</span>
                                                    <p className="text-slate-300 text-sm">{fmt(price)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-slate-500 text-xs">
                                                        {fmtDate(tx.transactionDate)}
                                                    </p>
                                                    {tx.notes && (
                                                        <p className="text-slate-600 text-xs italic
                                                                      truncate max-w-[160px]">
                                                            {tx.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <p className={
                                                "font-bold text-sm " +
                                                (isBuy ? "text-white" : "text-orange-300")
                                            }>
                                                {fmt(total)}
                                            </p>
                                            <button onClick={() => askDelete(tx)}
                                                    className="opacity-0 group-hover:opacity-100
                                                           text-slate-500 hover:text-red-400
                                                           transition-all text-xs hover:underline">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-slate-700/40 flex-shrink-0 bg-slate-900">
                    <p className="text-xs text-slate-600 text-center">
                        ESC to close · Changes update holdings automatically
                    </p>
                </div>
            </div>

            {/* Custom confirm dialog */}
            <ConfirmDialog
                dialog={dialog}
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setDialog({ open: false })}
            />
        </>
    );
}