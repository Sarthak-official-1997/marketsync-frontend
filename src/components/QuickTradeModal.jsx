import { useState } from "react";
import { createTransaction } from "../api/portfolio";
import { useToast } from "../context/ToastContext";

export default function QuickTradeModal({ holding, defaultType = "BUY", onClose, onDone }) {
    const [type, setType]       = useState(defaultType);
    const [qty, setQty]         = useState("");
    const [price, setPrice]     = useState(
        holding?.currentPrice ? parseFloat(holding.currentPrice).toFixed(2) : ""
    );
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();

    if (!holding) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createTransaction({
                stockId: holding.stock.id,
                type,
                quantity: parseFloat(qty),
                pricePerShare: parseFloat(price),
                transactionDate: new Date().toISOString().split("T")[0],
                fees: 0,
            });
            toast.success(`${type} order recorded for ${holding.stock.symbol}`);
            onDone();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Transaction failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-800 rounded-2xl border border-slate-600
                            shadow-2xl w-full max-w-sm p-6"
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-xl font-bold text-white">{holding.stock.symbol}</h2>
                        <p className="text-slate-400 text-sm">{holding.stock.name}</p>
                    </div>
                    <button onClick={onClose}
                            className="text-slate-400 hover:text-white text-xl">✕</button>
                </div>

                {/* BUY/SELL toggle */}
                <div className="flex rounded-lg overflow-hidden border border-slate-600 mb-5">
                    {["BUY", "SELL"].map(t => (
                        <button key={t} onClick={() => setType(t)}
                                className={`flex-1 py-2 text-sm font-semibold transition-colors
                                            ${type === t
                                    ? t === "BUY"
                                        ? "bg-green-600 text-white"
                                        : "bg-red-600 text-white"
                                    : "bg-slate-700 text-slate-400"}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* Holding info */}
                <div className="bg-slate-700/50 rounded-lg p-3 mb-5 text-sm space-y-1">
                    <div className="flex justify-between text-slate-400">
                        <span>Currently owned</span>
                        <span className="text-white font-medium">
                            {parseFloat(holding.quantity).toFixed(2)} shares
                        </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                        <span>Avg buy price</span>
                        <span className="text-white font-medium">
                            ₹{parseFloat(holding.avgBuyPrice).toFixed(2)}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                        <input type="number" step="0.000001" min="0.000001"
                               value={qty} onChange={e => setQty(e.target.value)}
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2 text-white text-sm focus:outline-none
                                          focus:border-blue-500"
                               placeholder="10" required />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Price per share</label>
                        <input type="number" step="0.01" min="0.01"
                               value={price} onChange={e => setPrice(e.target.value)}
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2 text-white text-sm focus:outline-none
                                          focus:border-blue-500"
                               required />
                    </div>
                    {qty && price && (
                        <div className="text-xs text-slate-400 bg-slate-700/50 rounded-lg px-3 py-2">
                            Total: <span className="text-white font-medium">
                                ₹{(parseFloat(qty) * parseFloat(price)).toLocaleString("en-IN")}
                            </span>
                        </div>
                    )}
                    <button type="submit" disabled={submitting}
                            className={`w-full text-white text-sm font-semibold py-2.5
                                        rounded-lg transition-colors disabled:opacity-50
                                        ${type === "BUY"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-red-600 hover:bg-red-700"}`}>
                        {submitting ? "Processing..." : `${type} ${holding.stock.symbol}`}
                    </button>
                </form>
            </div>
        </div>
    );
}