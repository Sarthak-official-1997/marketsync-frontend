import { useState, useEffect } from "react";
import { getTransactions, createTransaction, deleteTransaction, searchStocks } from "../api/portfolio";
import { SkeletonTable } from "../components/Skeleton";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(val);

const PAGE_SIZE = 15;

export default function TransactionsPage() {
    const [txns, setTxns]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState("");
    const [page, setPage]           = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [showForm, setShowForm]   = useState(false);
    const [filterType, setFilterType] = useState("ALL");
    const [sortBy, setSortBy]       = useState("date");
    const [sortDir, setSortDir]     = useState("desc");
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Form state
    const [form, setForm] = useState({
        stockId: "", type: "BUY", quantity: "", pricePerShare: "",
        transactionDate: new Date().toISOString().split("T")[0],
        notes: "", fees: "0",
    });
    const [stockSearch, setStockSearch]   = useState("");
    const [stockResults, setStockResults] = useState([]);
    const [submitting, setSubmitting]     = useState(false);
    const [formError, setFormError]       = useState("");

    const toast = useToast();

    const loadTxns = (p = 0) => {
        setLoading(true);
        getTransactions(p, PAGE_SIZE)
            .then(res => {
                setTxns(res.data.content || []);
                setTotalPages(res.data.totalPages || 0);
                setPage(p);
            })
            .catch(() => setError("Failed to load transactions"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadTxns(0); }, []);

    const handleStockSearch = async (q) => {
        setStockSearch(q);
        if (q.length < 2) { setStockResults([]); return; }
        try {
            const res = await searchStocks(q);
            setStockResults(res.data.content || []);
        } catch { setStockResults([]); }
    };

    const selectStock = (stock) => {
        setForm({ ...form, stockId: stock.id });
        setStockSearch(`${stock.symbol} — ${stock.name}`);
        setStockResults([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(""); setSubmitting(true);
        try {
            await createTransaction({
                stockId: parseInt(form.stockId),
                type: form.type,
                quantity: parseFloat(form.quantity),
                pricePerShare: parseFloat(form.pricePerShare),
                transactionDate: form.transactionDate,
                notes: form.notes || null,
                fees: parseFloat(form.fees) || 0,
            });
            toast.success("Transaction recorded successfully!");
            setShowForm(false);
            setStockSearch(""); setStockResults([]);
            setForm({
                stockId: "", type: "BUY", quantity: "", pricePerShare: "",
                transactionDate: new Date().toISOString().split("T")[0],
                notes: "", fees: "0",
            });
            loadTxns(0);
        } catch (err) {
            setFormError(err.response?.data?.message || "Failed to create transaction");
        } finally {
            setSubmitting(false); }
    };

    const confirmDelete = async () => {
        try {
            await deleteTransaction(deleteTarget.id);
            toast.success("Transaction deleted. Holdings recomputed.");
            loadTxns(page);
        } catch {
            toast.error("Failed to delete transaction");
        } finally {
            setDeleteTarget(null);
        }
    };

    const exportToCSV = () => {
        if (txns.length === 0) { toast.info("No transactions to export"); return; }
        const headers = ["Date","Stock","Type","Quantity","Price","Total","Fees","Notes"];
        const rows = txns.map(t => [
            t.transactionDate, t.stockSymbol, t.type,
            parseFloat(t.quantity).toFixed(6),
            parseFloat(t.pricePerShare).toFixed(2),
            parseFloat(t.totalAmount).toFixed(2),
            parseFloat(t.fees || 0).toFixed(2),
            t.notes || "",
        ]);
        const csv = [headers, ...rows]
            .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        toast.success("Exported to CSV!");
    };

    const filteredTxns = txns
        .filter(t => filterType === "ALL" || t.type === filterType)
        .sort((a, b) => {
            const key = sortBy === "date" ? "transactionDate"
                : sortBy === "amount" ? "totalAmount" : "stockSymbol";
            const valA = sortBy === "amount" ? parseFloat(a[key]) : a[key];
            const valB = sortBy === "amount" ? parseFloat(b[key]) : b[key];
            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

    if (loading) return <SkeletonTable rows={8} cols={7} />;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Transactions</h1>
                <div className="flex items-center gap-2">
                    <button onClick={exportToCSV}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm
                                       font-medium px-4 py-2 rounded-lg transition-colors">
                        ⬇ Export CSV
                    </button>
                    <button onClick={() => setShowForm(!showForm)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                                       font-medium px-4 py-2 rounded-lg transition-colors">
                        {showForm ? "Cancel" : "+ Add Transaction"}
                    </button>
                </div>
            </div>

            {error && <ErrorMessage message={error} />}

            {/* Add form */}
            {showForm && (
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h2 className="font-semibold text-white mb-4">New Transaction</h2>
                    {formError && <ErrorMessage message={formError} />}
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                        {/* Stock search */}
                        <div className="col-span-2 relative">
                            <label className="block text-xs text-slate-400 mb-1">Stock</label>
                            <input type="text" value={stockSearch}
                                   onChange={e => handleStockSearch(e.target.value)}
                                   placeholder="Search by symbol or name..."
                                   className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                              px-3 py-2 text-white text-sm focus:outline-none
                                              focus:border-blue-500" required />
                            {stockResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-700 border
                                                border-slate-600 rounded-lg shadow-xl max-h-48
                                                overflow-y-auto">
                                    {stockResults.map(s => (
                                        <button key={s.id} type="button" onClick={() => selectStock(s)}
                                                className="w-full text-left px-3 py-2
                                                           hover:bg-slate-600 text-sm">
                                            <span className="font-medium text-white">{s.symbol}</span>
                                            <span className="text-slate-400 ml-2">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                               px-3 py-2 text-white text-sm focus:outline-none">
                                <option value="BUY">BUY</option>
                                <option value="SELL">SELL</option>
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Date</label>
                            <input type="date" value={form.transactionDate}
                                   onChange={e => setForm({ ...form, transactionDate: e.target.value })}
                                   className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                              px-3 py-2 text-white text-sm focus:outline-none
                                              focus:border-blue-500" required />
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                            <input type="number" step="0.000001" min="0.000001"
                                   value={form.quantity}
                                   onChange={e => setForm({ ...form, quantity: e.target.value })}
                                   className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                              px-3 py-2 text-white text-sm focus:outline-none
                                              focus:border-blue-500"
                                   placeholder="10" required />
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Price per Share</label>
                            <input type="number" step="0.01" min="0.01"
                                   value={form.pricePerShare}
                                   onChange={e => setForm({ ...form, pricePerShare: e.target.value })}
                                   className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                              px-3 py-2 text-white text-sm focus:outline-none
                                              focus:border-blue-500"
                                   placeholder="2400.50" required />
                        </div>

                        {/* Fees */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Fees</label>
                            <input type="number" step="0.01" min="0"
                                   value={form.fees}
                                   onChange={e => setForm({ ...form, fees: e.target.value })}
                                   className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                              px-3 py-2 text-white text-sm focus:outline-none
                                              focus:border-blue-500"
                                   placeholder="0" />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Notes</label>
                            <input type="text" value={form.notes}
                                   onChange={e => setForm({ ...form, notes: e.target.value })}
                                   className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                              px-3 py-2 text-white text-sm focus:outline-none
                                              focus:border-blue-500"
                                   placeholder="Optional..." />
                        </div>

                        {/* Total preview */}
                        {form.quantity && form.pricePerShare && (
                            <div className="col-span-2 text-xs text-slate-400 bg-slate-700/50
                                            rounded-lg px-3 py-2">
                                Total: <span className="text-white font-medium">
                                    ₹{(parseFloat(form.quantity) * parseFloat(form.pricePerShare))
                                .toLocaleString("en-IN")}
                                </span>
                            </div>
                        )}

                        <div className="col-span-2">
                            <button type="submit" disabled={submitting || !form.stockId}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                               text-white text-sm font-medium px-6 py-2.5
                                               rounded-lg transition-colors">
                                {submitting ? "Saving..." : "Record Transaction"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter + sort bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                    {["ALL","BUY","SELL"].map(type => (
                        <button key={type} onClick={() => setFilterType(type)}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                    filterType === type
                                        ? type === "BUY"   ? "bg-green-700 text-white"
                                            : type === "SELL"  ? "bg-red-700 text-white"
                                                : "bg-blue-600 text-white"
                                        : "bg-slate-700 text-slate-400 hover:text-white"}`}>
                            {type}
                        </button>
                    ))}
                </div>

                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-xs
                                   rounded-lg px-3 py-1.5 focus:outline-none">
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                    <option value="stock">Sort by Stock</option>
                </select>

                <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                        className="bg-slate-700 border border-slate-600 text-slate-300 text-xs
                                   rounded-lg px-3 py-1.5 hover:text-white transition-colors">
                    {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
                </button>

                <span className="text-slate-500 text-xs ml-auto">
                    {filteredTxns.length} transaction{filteredTxns.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Table */}
            {filteredTxns.length === 0 ? (
                <EmptyState icon="📋" title="No transactions yet"
                            message="Record your first BUY or SELL trade to get started."
                            action="+ Add Transaction"
                            onAction={() => setShowForm(true)} />
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                            <th className="text-left px-4 py-3">Stock</th>
                            <th className="text-left px-4 py-3">Type</th>
                            <th className="text-right px-4 py-3">Qty</th>
                            <th className="text-right px-4 py-3">Price</th>
                            <th className="text-right px-4 py-3">Total</th>
                            <th className="text-left px-4 py-3">Date</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredTxns.map(t => (
                            <tr key={t.id}
                                className="border-b border-slate-700/50
                                               hover:bg-slate-700/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-white">{t.stockSymbol}</p>
                                    <p className="text-xs text-slate-400">{t.stockName}</p>
                                </td>
                                <td className="px-4 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                                            t.type === "BUY"
                                                ? "bg-green-900/50 text-green-400"
                                                : "bg-red-900/50 text-red-400"}`}>
                                            {t.type}
                                        </span>
                                </td>
                                <td className="text-right px-4 py-3 text-white">
                                    {parseFloat(t.quantity).toFixed(2)}
                                </td>
                                <td className="text-right px-4 py-3 text-slate-300">
                                    {fmt(t.pricePerShare)}
                                </td>
                                <td className="text-right px-4 py-3 text-white">
                                    {fmt(t.totalAmount)}
                                </td>
                                <td className="px-4 py-3 text-slate-400">
                                    {t.transactionDate}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => setDeleteTarget(t)}
                                            className="text-slate-500 hover:text-red-400
                                                           transition-colors text-xs">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                    <button onClick={() => loadTxns(page - 1)} disabled={page === 0}
                            className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300
                                       rounded-lg disabled:opacity-40 hover:bg-slate-600
                                       transition-colors">
                        ← Previous
                    </button>
                    <span className="text-slate-400 text-sm">
                        Page {page + 1} of {totalPages}
                    </span>
                    <button onClick={() => loadTxns(page + 1)} disabled={page >= totalPages - 1}
                            className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300
                                       rounded-lg disabled:opacity-40 hover:bg-slate-600
                                       transition-colors">
                        Next →
                    </button>
                </div>
            )}

            {/* Delete modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title="Delete Transaction?"
                message={deleteTarget
                    ? `${deleteTarget.stockSymbol} · ${deleteTarget.type} · ${parseFloat(deleteTarget.quantity).toFixed(2)} shares — This will recompute your holdings.`
                    : ""}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}