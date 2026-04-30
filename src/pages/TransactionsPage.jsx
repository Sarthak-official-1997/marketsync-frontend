import { useState, useEffect } from "react";
import { getTransactions, createTransaction, deleteTransaction } from "../api/portfolio";
import { searchStocks } from "../api/portfolio";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 2 }).format(val);

export default function TransactionsPage() {
    const [txns, setTxns]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState("");
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [form, setForm] = useState({
        stockId: "", type: "BUY", quantity: "",
        pricePerShare: "", transactionDate: new Date().toISOString().split("T")[0],
        notes: "", fees: "0"
    });
    const [stockSearch, setStockSearch] = useState("");
    const [stockResults, setStockResults] = useState([]);
    const [selectedStock, setSelectedStock] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const loadTxns = () => {
        setLoading(true);
        getTransactions()
            .then(res => setTxns(res.data.content || []))
            .catch(() => setError("Failed to load transactions"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadTxns(); }, []);

    const handleStockSearch = async (q) => {
        setStockSearch(q);
        if (q.length < 2) { setStockResults([]); return; }
        try {
            const res = await searchStocks(q);
            setStockResults(res.data.content || []);
        } catch {
            setStockResults([]);
        }
    };

    const selectStock = (stock) => {
        setSelectedStock(stock);
        setForm({ ...form, stockId: stock.id });
        setStockSearch(stock.symbol + " — " + stock.name);
        setStockResults([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        setSubmitting(true);
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
            setShowForm(false);
            setSelectedStock(null);
            setStockSearch("");
            setForm({ stockId: "", type: "BUY", quantity: "",
                pricePerShare: "", fees: "0", notes: "",
                transactionDate: new Date().toISOString().split("T")[0] });
            loadTxns();
        } catch (err) {
            setFormError(err.response?.data?.message || "Failed to create transaction");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction? Holdings will be recomputed.")) return;
        try {
            await deleteTransaction(id);
            loadTxns();
        } catch {
            alert("Failed to delete transaction");
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Transactions</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                               font-medium px-4 py-2 rounded-lg transition-colors"
                >
                    {showForm ? "Cancel" : "+ Add Transaction"}
                </button>
            </div>

            {error && <ErrorMessage message={error} />}

            {/* Add Transaction Form */}
            {showForm && (
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h2 className="font-semibold text-white mb-4">New Transaction</h2>
                    {formError && <ErrorMessage message={formError} />}

                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                        {/* Stock Search */}
                        <div className="col-span-2 relative">
                            <label className="block text-xs text-slate-400 mb-1">
                                Stock
                            </label>
                            <input
                                type="text"
                                value={stockSearch}
                                onChange={e => handleStockSearch(e.target.value)}
                                placeholder="Search by symbol or name..."
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                                required
                            />
                            {stockResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-700
                                                border border-slate-600 rounded-lg
                                                shadow-xl max-h-48 overflow-y-auto">
                                    {stockResults.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => selectStock(s)}
                                            className="w-full text-left px-3 py-2
                                                       hover:bg-slate-600 text-sm"
                                        >
                                            <span className="font-medium text-white">
                                                {s.symbol}
                                            </span>
                                            <span className="text-slate-400 ml-2">
                                                {s.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                            >
                                <option value="BUY">BUY</option>
                                <option value="SELL">SELL</option>
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Date</label>
                            <input
                                type="date"
                                value={form.transactionDate}
                                onChange={e => setForm({ ...form, transactionDate: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                                required
                            />
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                            <input
                                type="number" step="0.000001" min="0.000001"
                                value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                                placeholder="10"
                                required
                            />
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                Price per Share
                            </label>
                            <input
                                type="number" step="0.01" min="0.01"
                                value={form.pricePerShare}
                                onChange={e => setForm({ ...form, pricePerShare: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                                placeholder="2400.50"
                                required
                            />
                        </div>

                        {/* Fees */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                Brokerage Fees
                            </label>
                            <input
                                type="number" step="0.01" min="0"
                                value={form.fees}
                                onChange={e => setForm({ ...form, fees: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                                placeholder="0"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                Notes (optional)
                            </label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                                placeholder="First buy..."
                            />
                        </div>

                        <div className="col-span-2">
                            <button
                                type="submit"
                                disabled={submitting || !form.stockId}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                           text-white text-sm font-medium px-6 py-2.5
                                           rounded-lg transition-colors"
                            >
                                {submitting ? "Saving..." : "Record Transaction"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Transaction List */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {txns.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        No transactions yet.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400
                                           text-xs uppercase">
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
                        {txns.map(t => (
                            <tr key={t.id}
                                className="border-b border-slate-700/50
                                               hover:bg-slate-700/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-white">
                                        {t.stockSymbol}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {t.stockName}
                                    </p>
                                </td>
                                <td className="px-4 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                                            t.type === "BUY"
                                                ? "bg-green-900/50 text-green-400"
                                                : "bg-red-900/50 text-red-400"
                                        }`}>
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
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => handleDelete(t.id)}
                                        className="text-slate-500 hover:text-red-400
                                                       transition-colors text-xs"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}