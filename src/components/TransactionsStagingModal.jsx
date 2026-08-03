// src/components/TransactionsStagingModal.jsx
// Shown when the creator taps "View Transactions" on a tracked holding.
// Lists the mapped client's REAL transactions for that stock, with inline
// Add/Edit/Delete — none of which touch the real account. Every change
// here is staged (server-side, persists across sessions) until the
// creator reviews everything in the Push confirmation screen and commits.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import {
    getRealTransactions, getStagedEdits, stageEdit, removeStagedEdit,
} from "../api/clientTracker";

function TxnEditForm({ initial, onSet, onCancel }) {
    const [type, setType] = useState(initial.type || "BUY");
    const [qty, setQty] = useState(initial.quantity ?? "");
    const [price, setPrice] = useState(initial.pricePerShare ?? "");
    const [date, setDate] = useState(initial.transactionDate ?? "");
    const [fees, setFees] = useState(initial.fees ?? "0");

    return (
        <div className="bg-slate-900 rounded-lg p-2.5 space-y-2 mt-2">
            <div className="flex gap-1">
                {["BUY", "SELL"].map(t => (
                    <button key={t} onClick={() => setType(t)}
                            className={"flex-1 text-[11px] font-semibold py-1.5 rounded-lg border " +
                            (type === t
                                ? (t === "BUY" ? "bg-green-600/20 border-green-500 text-green-300" : "bg-red-600/20 border-red-500 text-red-300")
                                : "bg-slate-800 border-slate-700 text-slate-400")}>
                        {t}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty"
                       className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price/share"
                       className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                       className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                <input type="number" value={fees} onChange={e => setFees(e.target.value)} placeholder="Fees"
                       className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
            </div>
            <div className="flex gap-2">
                <button onClick={onCancel}
                        className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">
                    Cancel
                </button>
                <button onClick={() => onSet({ type, qty, price, date, fees })}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                    Set
                </button>
            </div>
        </div>
    );
}

export default function TransactionsStagingModal({ trackedClientId, stock, onClose, onStagedChange }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [transactions, setTransactions] = useState([]);
    const [staged, setStaged] = useState([]);   // ALL staged edits for this client (filtered to this stock below)
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // real txn id being edited, or "new"
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([
            getRealTransactions(trackedClientId, stock.stockId || stock.id),
            getStagedEdits(trackedClientId),
        ])
            .then(([txnRes, stagedRes]) => {
                setTransactions(txnRes.data || []);
                setStaged((stagedRes.data || []).filter(s => s.stockId === (stock.stockId || stock.id)));
            })
            .catch(() => toast.error("Couldn't load transactions"))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [trackedClientId, stock.stockId, stock.id]);

    const stagedFor = (txnId) => staged.find(s => s.targetTransactionId === txnId);
    const stagedAdds = staged.filter(s => s.editType === "ADD");

    const notifyParentAndReload = () => {
        load();
        onStagedChange?.();
    };

    const doStage = (payload) => {
        setSaving(true);
        stageEdit(trackedClientId, payload)
            .then(() => { toast.success("Staged"); setEditingId(null); notifyParentAndReload(); })
            .catch(() => toast.error("Couldn't stage this change"))
            .finally(() => setSaving(false));
    };

    const stageEditFor = (txn, form) => {
        if (!form.qty || !form.price || !form.date) { toast.error("Fill in quantity, price, and date"); return; }
        doStage({
            stockId: stock.stockId || stock.id,
            editType: "EDIT",
            targetTransactionId: txn.id,
            transactionType: form.type,
            quantity: parseFloat(form.qty),
            pricePerShare: parseFloat(form.price),
            transactionDate: form.date,
            fees: parseFloat(form.fees || 0),
        });
    };

    const stageAdd = (form) => {
        if (!form.qty || !form.price || !form.date) { toast.error("Fill in quantity, price, and date"); return; }
        doStage({
            stockId: stock.stockId || stock.id,
            editType: "ADD",
            transactionType: form.type,
            quantity: parseFloat(form.qty),
            pricePerShare: parseFloat(form.price),
            transactionDate: form.date,
            fees: parseFloat(form.fees || 0),
        });
    };

    const stageDelete = (txn) => {
        doStage({
            stockId: stock.stockId || stock.id,
            editType: "DELETE",
            targetTransactionId: txn.id,
        });
    };

    const undoStaged = (stagedId) => {
        removeStagedEdit(trackedClientId, stagedId)
            .then(() => { toast.success("Removed from staging"); notifyParentAndReload(); })
            .catch(() => toast.error("Couldn't undo"));
    };

    const fmt = (v) => v == null ? "—" : parseFloat(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

    return createPortal(
        <div className="fixed inset-0 z-[9650] flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9651] bg-slate-900 flex flex-col"
                 style={isMobile ? {
                     width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
                     borderRadius: 0, border: "none",
                     paddingTop: "env(safe-area-inset-top, 0px)",
                     paddingBottom: "env(safe-area-inset-bottom, 0px)",
                     overflowX: "hidden",
                 } : {
                     width: "calc(100vw - 32px)", maxWidth: "460px",
                     height: "600px",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <div>
                        <p className="text-white font-bold text-sm">{stock.symbol}</p>
                        <p className="text-slate-500 text-xs">Real transactions</p>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }} className="px-4 py-4 space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {transactions.length === 0 && stagedAdds.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-8">No transactions yet.</p>
                            )}

                            {/* Real transactions — with staged edit/delete overlaid */}
                            {transactions.map(txn => {
                                const edit = stagedFor(txn.id);
                                const isDeleted = edit?.editType === "DELETE";
                                const isEdited  = edit?.editType === "EDIT";

                                return (
                                    <div key={txn.id}
                                         className={"rounded-xl p-3 border " +
                                         (isDeleted ? "bg-red-900/10 border-red-500/30 opacity-60"
                                             : isEdited ? "bg-amber-900/10 border-amber-500/30"
                                                 : "bg-slate-800/60 border-slate-700/60")}>
                                        <div className="flex items-center justify-between">
                                            <div className={isDeleted ? "line-through text-slate-500" : "text-white"}>
                                                <p className="text-sm font-semibold">
                                                    {(isEdited ? edit.transactionType : txn.type)} · {fmt(isEdited ? edit.quantity : txn.quantity)} sh
                                                    @ ₹{fmt(isEdited ? edit.pricePerShare : txn.pricePerShare)}
                                                </p>
                                                <p className="text-slate-500 text-xs">
                                                    {isEdited ? edit.transactionDate : txn.transactionDate}
                                                </p>
                                            </div>
                                            {edit ? (
                                                <div className="text-right">
                                                    <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " +
                                                    (isDeleted ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300")}>
                                                        {isDeleted ? "Staged: remove" : "Staged: edited"}
                                                    </span>
                                                    <button onClick={() => undoStaged(edit.id)}
                                                            className="block text-[11px] text-slate-400 hover:text-white mt-1 ml-auto">
                                                        Undo
                                                    </button>
                                                </div>
                                            ) : editingId === txn.id ? null : (
                                                <div className="flex gap-2">
                                                    <button onClick={() => setEditingId(txn.id)}
                                                            className="text-xs text-blue-400 hover:text-blue-300 font-semibold">Edit</button>
                                                    <button onClick={() => stageDelete(txn)}
                                                            className="text-xs text-red-400 hover:text-red-300 font-semibold">Delete</button>
                                                </div>
                                            )}
                                        </div>
                                        {editingId === txn.id && (
                                            <TxnEditForm
                                                initial={{ type: txn.type, quantity: txn.quantity, pricePerShare: txn.pricePerShare,
                                                    transactionDate: txn.transactionDate, fees: txn.fees }}
                                                onSet={(form) => stageEditFor(txn, form)}
                                                onCancel={() => setEditingId(null)}
                                            />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Staged NEW transactions (no real counterpart yet) */}
                            {stagedAdds.map(add => (
                                <div key={add.id} className="rounded-xl p-3 border bg-green-900/10 border-green-500/30">
                                    <div className="flex items-center justify-between">
                                        <div className="text-white">
                                            <p className="text-sm font-semibold">
                                                {add.transactionType} · {fmt(add.quantity)} sh @ ₹{fmt(add.pricePerShare)}
                                            </p>
                                            <p className="text-slate-500 text-xs">{add.transactionDate}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                                                Staged: new
                                            </span>
                                            <button onClick={() => undoStaged(add.id)}
                                                    className="block text-[11px] text-slate-400 hover:text-white mt-1 ml-auto">
                                                Undo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add a new transaction */}
                            {editingId === "new" ? (
                                <div className="rounded-xl p-3 border bg-slate-800/60 border-slate-700/60">
                                    <p className="text-xs text-slate-400 mb-1">New transaction</p>
                                    <TxnEditForm initial={{}} onSet={stageAdd} onCancel={() => setEditingId(null)} />
                                </div>
                            ) : (
                                <button onClick={() => setEditingId("new")}
                                        className="w-full py-2 border border-dashed border-slate-700 rounded-xl
                                                   text-xs text-slate-400 hover:border-slate-500 hover:text-white transition-colors">
                                    + Add transaction
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}