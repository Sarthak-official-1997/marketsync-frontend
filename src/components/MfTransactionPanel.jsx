import { useState, useEffect } from "react";
import {
    getMfTransactions, addMfTransaction, deleteMfTransaction,
} from "../api/portfolio";
import { useToast } from "../context/ToastContext";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtUnits = (v) => parseFloat(v || 0).toFixed(4);

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        return `${day}/${m}/${y}`;
    } catch { return d; }
};

const today = () => new Date().toISOString().split("T")[0];

const TX_TYPES = [
    { value: "PURCHASE",              label: "Purchase" },
    { value: "SIP",                   label: "SIP"      },
    { value: "REDEMPTION",            label: "Redeem"   },
    { value: "SWITCH_IN",             label: "Switch In"},
    { value: "SWITCH_OUT",            label: "Switch Out"},
    { value: "DIVIDEND_REINVESTMENT", label: "Dividend" },
];

const isBuyType = (t) =>
    ["PURCHASE", "SIP", "SWITCH_IN", "DIVIDEND_REINVESTMENT"].includes(t);

// ====================================================================
export default function MfTransactionPanel({ scheme, onClose, onChanged }) {
// scheme = { schemeCode, schemeName, fundHouse, nav }
// ====================================================================

    const [transactions, setTx]   = useState([]);
    const [loading,      setLoad] = useState(true);
    const [showForm,     setShowForm] = useState(false);
    const toast = useToast();

    const emptyForm = {
        type: "PURCHASE", units: "", nav: scheme?.nav?.toString() || "",
        date: today(), notes: "",
    };
    const [form, setForm]   = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        if (!scheme) return;
        setLoad(true);
        try {
            const res = await getMfTransactions(0, 200);
            const all = res.data?.content || res.data || [];
            const filtered = all.filter(
                t => t.schemeCode === scheme.schemeCode
                    || t.scheme?.schemeCode === scheme.schemeCode
            );
            filtered.sort((a, b) => {
                const da = a.transactionDate || "";
                const db = b.transactionDate || "";
                return db.localeCompare(da);
            });
            setTx(filtered);
        } catch { toast.error("Failed to load MF transactions"); }
        finally { setLoad(false); }
    };

    useEffect(() => {
        if (!scheme) return;
        setTx([]); setShowForm(false);
        setForm({ ...emptyForm, nav: scheme?.nav?.toString() || "" });
        load();
    }, [scheme?.schemeCode]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    if (!scheme) return null;

    const totalInvested = transactions
        .filter(t => isBuyType(t.transactionType || t.type))
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

    const totalRedeemed = transactions
        .filter(t => !isBuyType(t.transactionType || t.type))
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

    const handleSubmit = async (keepOpen = false) => {
        if (!form.units || !form.nav) {
            toast.error("Please enter units and NAV"); return;
        }
        setSaving(true);
        try {
            await addMfTransaction({
                schemeCode:       scheme.schemeCode,
                transactionType:  form.type,
                units:            parseFloat(form.units),
                navAtTransaction: parseFloat(form.nav),
                transactionDate:  form.date,
                notes:            form.notes || null,
            });
            toast.success(`${form.type} recorded — ${form.units} units`);
            setForm({ ...emptyForm, nav: scheme?.nav?.toString() || "",
                type: form.type });
            if (!keepOpen) setShowForm(false);
            load();
            if (onChanged) onChanged();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save");
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction? Holdings will update.")) return;
        try {
            await deleteMfTransaction(id);
            toast.success("Transaction deleted");
            load();
            if (onChanged) onChanged();
        } catch { toast.error("Failed to delete"); }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl
                           bg-slate-900 border-l border-slate-700 shadow-2xl
                           flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="flex items-start justify-between
                                px-6 py-4 border-b border-slate-700 flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-4">
                        <p className="text-white font-bold text-base leading-tight truncate">
                            {scheme.schemeName}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-slate-400 text-xs">
                                {scheme.fundHouse}
                            </span>
                            {scheme.nav && (
                                <span className="text-blue-400 text-xs font-semibold">
                                    NAV ₹{scheme.nav}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white
                                   hover:bg-slate-700 rounded-xl transition-colors
                                   flex-shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* SUMMARY */}
                {transactions.length > 0 && (
                    <div className="grid grid-cols-3 gap-px bg-slate-800/40
                                    border-b border-slate-700/60 flex-shrink-0">
                        {[
                            ["Transactions", transactions.length, "text-white"],
                            ["Invested",     fmt(totalInvested),  "text-blue-400"],
                            ["Redeemed",     fmt(totalRedeemed),  "text-orange-400"],
                        ].map(([l, v, cls]) => (
                            <div key={l} className="bg-slate-900 px-4 py-3">
                                <p className="text-xs text-slate-500">{l}</p>
                                <p className={"text-sm font-bold mt-0.5 " + cls}>{v}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ADD FORM */}
                <div className="flex-shrink-0 border-b border-slate-700/60">
                    {!showForm ? (
                        <div className="px-6 py-3">
                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full flex items-center justify-center gap-2
                                           py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                           font-semibold text-sm rounded-xl transition-colors"
                            >
                                <span className="text-lg leading-none">+</span>
                                Add Transaction
                            </button>
                        </div>
                    ) : (
                        <div className="px-6 py-4 bg-slate-800/60 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-white">
                                    New Transaction
                                </p>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="text-slate-500 hover:text-slate-300 text-xs"
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* Type selector */}
                            <select
                                value={form.type}
                                onChange={e => setForm(f => ({
                                    ...f, type: e.target.value
                                }))}
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                            >
                                {TX_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>

                            {/* Units + NAV + Date */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Units *
                                    </label>
                                    <input
                                        type="number" min="0.0001" step="0.0001"
                                        value={form.units}
                                        onChange={e => setForm(f => ({
                                            ...f, units: e.target.value
                                        }))}
                                        placeholder="e.g. 10.5"
                                        className="w-full bg-slate-700 border border-slate-600
                                                   rounded-lg px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        NAV (₹) *
                                    </label>
                                    <input
                                        type="number" min="0.01" step="0.01"
                                        value={form.nav}
                                        onChange={e => setForm(f => ({
                                            ...f, nav: e.target.value
                                        }))}
                                        placeholder={scheme.nav || "e.g. 123"}
                                        className="w-full bg-slate-700 border border-slate-600
                                                   rounded-lg px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        max={today()}
                                        onChange={e => setForm(f => ({
                                            ...f, date: e.target.value
                                        }))}
                                        className="w-full bg-slate-700 border border-slate-600
                                                   rounded-lg px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <input
                                type="text"
                                value={form.notes}
                                onChange={e => setForm(f => ({
                                    ...f, notes: e.target.value
                                }))}
                                placeholder="Notes (optional)"
                                className="w-full bg-slate-700 border border-slate-600
                                           rounded-lg px-3 py-2 text-white text-sm
                                           focus:outline-none focus:border-blue-500"
                            />

                            {form.units && form.nav && (
                                <div className="flex items-center justify-between
                                                bg-slate-700/50 rounded-lg px-3 py-2">
                                    <span className="text-slate-400 text-sm">Amount</span>
                                    <span className="text-white font-bold">
                                        {fmt(parseFloat(form.units) * parseFloat(form.nav))}
                                    </span>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700
                                               text-white text-sm font-bold rounded-xl
                                               transition-colors disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                                <button
                                    onClick={() => handleSubmit(true)}
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500
                                               text-white text-sm font-semibold rounded-xl
                                               transition-colors disabled:opacity-50"
                                >
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
                                <div key={i}
                                     className="h-16 bg-slate-800 rounded-xl animate-pulse"/>
                            ))}
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center
                                        h-full gap-3 text-center px-8">
                            <p className="text-4xl">📊</p>
                            <p className="text-white font-semibold">No transactions yet</p>
                            <p className="text-slate-400 text-sm">
                                Click "+ Add Transaction" above to record
                                your first transaction for this fund
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="px-6 py-3 border-b border-slate-700/40">
                                <p className="text-xs text-slate-500 uppercase
                                              tracking-wider font-semibold">
                                    {transactions.length} Transaction
                                    {transactions.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            {transactions.map(tx => {
                                const type  = tx.transactionType || tx.type;
                                const units = parseFloat(tx.units || 0);
                                const nav   = parseFloat(tx.navAtTransaction || 0);
                                const amt   = parseFloat(tx.amount || (units * nav) || 0);
                                const isBuy = isBuyType(type);

                                return (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between
                                                   px-6 py-4 border-b border-slate-700/30
                                                   hover:bg-slate-800/40 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className={
                                                "text-xs font-bold px-2.5 py-1.5 rounded-lg " +
                                                (isBuy
                                                    ? "bg-green-900/40 text-green-400"
                                                    : "bg-red-900/40 text-red-400")
                                            }>
                                                {type.replace("_", " ")}
                                            </span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-white font-semibold text-sm">
                                                        {fmtUnits(units)} units
                                                    </p>
                                                    <span className="text-slate-500 text-xs">@</span>
                                                    <p className="text-slate-300 text-sm">
                                                        ₹{nav.toFixed(4)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-slate-500 text-xs">
                                                        {fmtDate(tx.transactionDate)}
                                                    </p>
                                                    {tx.notes && (
                                                        <p className="text-slate-600 text-xs
                                                                      italic truncate max-w-[140px]">
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
                                                {fmt(amt)}
                                            </p>
                                            <button
                                                onClick={() => handleDelete(tx.id)}
                                                className="opacity-0 group-hover:opacity-100
                                                           text-slate-500 hover:text-red-400
                                                           transition-all text-xs hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-slate-700/40
                                flex-shrink-0 bg-slate-900">
                    <p className="text-xs text-slate-600 text-center">
                        ESC to close · Changes update MF holdings automatically
                    </p>
                </div>
            </div>
        </>
    );
}