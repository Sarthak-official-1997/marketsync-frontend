// src/pages/NeedsDecisionPage.jsx
// Creator's queue of open SL-touch and target-hit alerts, computed
// on-demand (not push — see ThreadService.checkTradeSetupAlerts) each
// time this page loads. This is the actual decision-making UI for the
// gating workflow: an SL touch sits here, invisible to the client, until
// you explicitly choose Hold/Exit/Keep watching; a target hit is already
// visible to the client too, but you can still proactively tell them
// what to do about it.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { getTradeSetupAlerts, decideOnAlert } from "../api/thread";

function fmtAgo(iso) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function SlAlertCard({ alert, onDecide }) {
    const [busy, setBusy] = useState(null); // which decision is in flight, or null
    const [note, setNote] = useState("");
    const [showNote, setShowNote] = useState(false);

    const act = (decision, notify) => {
        setBusy(decision);
        onDecide(alert.id, decision, notify, note || null).finally(() => setBusy(null));
    };

    return (
        <div className="bg-slate-800 border border-red-700/40 rounded-2xl p-3.5 mb-3
                        bg-gradient-to-b from-red-900/10">
            <div className="flex items-center justify-between mb-2.5">
                <div>
                    <p className="text-white font-bold text-sm">{alert.stockSymbol}</p>
                    <p className="text-slate-500 text-[10.5px]">Sent to {alert.clientDisplayName}</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-red-900/25 text-red-400">
                    SL touched
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="bg-slate-900/60 rounded-lg text-center py-1.5">
                    <p className="text-[8px] text-slate-500 uppercase">Stop-loss</p>
                    <p className="text-xs font-bold text-white">₹{alert.levelPrice}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg text-center py-1.5">
                    <p className="text-[8px] text-slate-500 uppercase">Price now</p>
                    <p className="text-xs font-bold text-red-400">₹{alert.currentPrice}</p>
                </div>
            </div>
            <p className="text-[10.5px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 mb-2.5">
                ⓘ Touched {fmtAgo(alert.detectedAt)}. {alert.clientDisplayName} hasn't been told anything yet —
                it can still rebound before you decide.
            </p>

            {showNote && (
                <textarea value={note} onChange={e => setNote(e.target.value)}
                          placeholder="Optional custom message instead of the default…"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2
                                     text-white text-xs mb-2 min-h-[50px]" />
            )}
            <button onClick={() => setShowNote(s => !s)} className="text-[10px] text-slate-500 mb-2 underline">
                {showNote ? "Use default message instead" : "Write a custom message"}
            </button>

            <div className="flex flex-col gap-1.5">
                <button onClick={() => act("EXIT", true)} disabled={busy}
                        className="py-2 rounded-lg text-[11.5px] font-bold bg-red-900/25 text-red-400
                                   border border-red-700/40 disabled:opacity-50">
                    {busy === "EXIT" ? "…" : `Tell ${alert.clientDisplayName}: Exit now`}
                </button>
                <button onClick={() => act("HOLD", true)} disabled={busy}
                        className="py-2 rounded-lg text-[11.5px] font-bold bg-amber-900/25 text-amber-400
                                   border border-amber-700/40 disabled:opacity-50">
                    {busy === "HOLD" ? "…" : `Tell ${alert.clientDisplayName}: Hold, watching it`}
                </button>
                <button onClick={() => act("WATCHING", false)} disabled={busy}
                        className="py-2 rounded-lg text-[11.5px] font-bold bg-slate-700 text-slate-300 disabled:opacity-50">
                    {busy === "WATCHING" ? "…" : "Keep watching — don't notify yet"}
                </button>
            </div>
        </div>
    );
}

function TargetAlertCard({ alert, onDecide }) {
    const [busy, setBusy] = useState(null);

    const act = (decision, notify) => {
        setBusy(decision);
        onDecide(alert.id, decision, notify, null).finally(() => setBusy(null));
    };

    const label = alert.targetSortOrder != null ? `Target ${alert.targetSortOrder + 1}` : "Target";

    return (
        <div className="bg-slate-800 border border-green-700/40 rounded-2xl p-3.5 mb-3
                        bg-gradient-to-b from-green-900/10">
            <div className="flex items-center justify-between mb-2.5">
                <div>
                    <p className="text-white font-bold text-sm">{alert.stockSymbol}</p>
                    <p className="text-slate-500 text-[10.5px]">Sent to {alert.clientDisplayName}</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-green-900/25 text-green-400">
                    🎯 {label} hit
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="bg-slate-900/60 rounded-lg text-center py-1.5">
                    <p className="text-[8px] text-slate-500 uppercase">{label}</p>
                    <p className="text-xs font-bold text-white">₹{alert.levelPrice}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg text-center py-1.5">
                    <p className="text-[8px] text-slate-500 uppercase">Price now</p>
                    <p className="text-xs font-bold text-green-400">₹{alert.currentPrice}</p>
                </div>
            </div>
            <p className="text-[10px] text-slate-500 mb-2.5">
                {alert.clientDisplayName} already sees this hit their target — this decides what you tell them to do about it.
            </p>
            <div className="flex flex-col gap-1.5">
                <button onClick={() => act("HOLD_FOR_NEXT", true)} disabled={busy}
                        className="py-2 rounded-lg text-[11.5px] font-bold bg-blue-900/25 text-blue-400
                                   border border-blue-700/40 disabled:opacity-50 text-left px-3">
                    {busy === "HOLD_FOR_NEXT" ? "…" : "Tell clients: Hold for the next target"}
                </button>
                <button onClick={() => act("BOOK_PARTIAL", true)} disabled={busy}
                        className="py-2 rounded-lg text-[11.5px] font-bold bg-amber-900/25 text-amber-400
                                   border border-amber-700/40 disabled:opacity-50 text-left px-3">
                    {busy === "BOOK_PARTIAL" ? "…" : "Tell clients: Book partial, hold the rest"}
                </button>
                <button onClick={() => act("BOOK_FULL", true)} disabled={busy}
                        className="py-2 rounded-lg text-[11.5px] font-bold bg-green-900/25 text-green-400
                                   border border-green-700/40 disabled:opacity-50 text-left px-3">
                    {busy === "BOOK_FULL" ? "…" : "Tell clients: Book out completely"}
                </button>
            </div>
        </div>
    );
}

export default function NeedsDecisionPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [alerts, setAlerts] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        getTradeSetupAlerts()
            .then(res => setAlerts(res.data || []))
            .catch(() => toast.error("Couldn't load alerts"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDecide = (alertId, decision, notify, customMessage) =>
        decideOnAlert(alertId, decision, notify, customMessage)
            .then(() => {
                toast.success(notify ? "Client notified" : "Noted — still watching");
                setAlerts(prev => prev.filter(a => a.id !== alertId));
            })
            .catch(() => toast.error("Couldn't save that decision"));

    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>;
    }

    const slAlerts = (alerts || []).filter(a => a.type === "SL_TOUCH");
    const targetAlerts = (alerts || []).filter(a => a.type === "TARGET_HIT");

    return (
        <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-slate-400 text-xl">←</button>
                    <p className="text-white font-bold text-base">Needs Your Decision</p>
                </div>
                <button onClick={load} className="text-[11px] text-purple-400 font-semibold">Refresh</button>
            </div>

            <div className="px-4 py-4">
                {(!alerts || alerts.length === 0) && (
                    <p className="text-center text-slate-600 text-xs mt-10">
                        Nothing needs a decision right now.
                    </p>
                )}

                {slAlerts.length > 0 && (
                    <>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                            Stop-loss touched — not yet shared
                        </p>
                        {slAlerts.map(a => <SlAlertCard key={a.id} alert={a} onDecide={handleDecide} />)}
                    </>
                )}

                {targetAlerts.length > 0 && (
                    <>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 mt-4">
                            Targets hit — decide what to tell clients
                        </p>
                        {targetAlerts.map(a => <TargetAlertCard key={a.id} alert={a} onDecide={handleDecide} />)}
                    </>
                )}
            </div>
        </div>
    );
}