// src/components/PushReviewModal.jsx
// The Push confirmation screen — shows exactly what's staged, grouped by
// stock, before anything becomes real. ✕ closes WITHOUT discarding
// anything (staged changes persist, come back anytime to keep editing).
// "Post" commits everything for real. "Cancel" also just closes — the only
// way staged changes are ever discarded is by explicitly undoing them in
// the transaction list itself.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { getPushReview, executePush } from "../api/clientTracker";

const EDIT_TYPE_LABEL = { ADD: "New", EDIT: "Edited", DELETE: "Remove" };
const EDIT_TYPE_COLOR = {
    ADD: "text-green-300 bg-green-500/20",
    EDIT: "text-amber-300 bg-amber-500/20",
    DELETE: "text-red-300 bg-red-500/20",
};

export default function PushReviewModal({ trackedClientId, onClose, onPushed }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [review, setReview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pushing, setPushing] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        getPushReview(trackedClientId)
            .then(res => setReview(res.data))
            .catch(() => toast.error("Couldn't load staged changes"))
            .finally(() => setLoading(false));
    }, [trackedClientId]);

    const post = () => {
        setPushing(true);
        executePush(trackedClientId)
            .then(res => {
                setResult(res.data);
                if (res.data.failed === 0) onPushed?.();
            })
            .catch(() => toast.error("Push failed — please try again"))
            .finally(() => setPushing(false));
    };

    const fmt = (v) => v == null ? "—" : parseFloat(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

    return createPortal(
        <div className="fixed inset-0 z-[9700] flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9701] bg-slate-900 flex flex-col"
                 style={isMobile ? {
                     width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
                     borderRadius: 0, border: "none",
                     paddingTop: "env(safe-area-inset-top, 0px)",
                     paddingBottom: "env(safe-area-inset-bottom, 0px)",
                     overflowX: "hidden",
                 } : {
                     width: "calc(100vw - 32px)", maxWidth: "460px",
                     height: "560px",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <div>
                        <p className="text-white font-bold text-sm">Push — review changes</p>
                        <p className="text-slate-500 text-xs">Nothing is real yet. Review before posting.</p>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }} className="px-4 py-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : result ? (
                        <div className="space-y-3">
                            <div className="text-center py-4">
                                <p className="text-3xl mb-2">{result.failed === 0 ? "✅" : "⚠️"}</p>
                                <p className="text-white font-bold">
                                    {result.applied} applied{result.failed > 0 ? `, ${result.failed} failed` : ""}
                                </p>
                            </div>
                            {result.results.filter(r => !r.success).map(r => (
                                <div key={r.stagedEditId} className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                                    <p className="text-red-300 text-xs font-semibold">{r.symbol} — {r.editType}</p>
                                    <p className="text-red-400/80 text-[11px]">{r.error}</p>
                                </div>
                            ))}
                            {result.failed > 0 && (
                                <p className="text-slate-500 text-xs">
                                    Failed changes stay staged — fix them in the transaction list and push again.
                                </p>
                            )}
                        </div>
                    ) : !review || review.changedStocks.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-8">
                            No staged changes — nothing to push.
                        </p>
                    ) : (
                        review.changedStocks.map(sc => (
                            <div key={sc.stockId} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                                <p className="text-white font-bold text-sm mb-2">{sc.symbol}</p>
                                <div className="space-y-1.5">
                                    {sc.edits.map(e => (
                                        <div key={e.id} className="flex items-center justify-between">
                                            <p className="text-xs text-slate-300">
                                                {e.editType === "DELETE"
                                                    ? `Remove transaction from ${e.transactionDate || "—"}`
                                                    : `${e.transactionType} · ${fmt(e.quantity)} sh @ ₹${fmt(e.pricePerShare)} · ${e.transactionDate}`}
                                            </p>
                                            <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 " + EDIT_TYPE_COLOR[e.editType]}>
                                                {EDIT_TYPE_LABEL[e.editType]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/60 flex gap-2">
                    {result ? (
                        <button onClick={onClose}
                                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white
                                           text-sm font-semibold rounded-xl transition-colors">
                            Done
                        </button>
                    ) : (
                        <>
                            <button onClick={onClose}
                                    className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white
                                               text-sm font-semibold rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button onClick={post} disabled={pushing || !review || review.changedStocks.length === 0}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                               text-white text-sm font-semibold rounded-xl transition-colors">
                                {pushing ? "Posting…" : "Post"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}