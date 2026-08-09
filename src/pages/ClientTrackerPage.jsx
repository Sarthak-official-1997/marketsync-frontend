// src/pages/ClientTrackerPage.jsx
// Creator-only. Lists everyone being tracked — for mapped clients, this now
// shows the SAME real portfolio performance (value, day change, P&L, MF
// holdings) the separate Clients admin page shows, so checking "how are my
// clients actually doing" no longer means leaving this page. Unmapped
// entries ("untracked" — no real account attached yet) keep the simpler
// card, since there's no live performance to report on for them.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { usePrivacy } from "../context/PrivacyContext";
import { listTrackedClients, createTrackedClient } from "../api/clientTracker";

const fmtCrore = (v) => {
    if (v == null) return "—";
    const n = parseFloat(v);
    if (Math.abs(n) >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(2) + "Cr";
    if (Math.abs(n) >= 100_000)    return "₹" + (n / 100_000).toFixed(2) + "L";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

export default function ClientTrackerPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const { hidden: valuesHidden } = usePrivacy();

    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const load = () => {
        setLoading(true);
        listTrackedClients()
            .then(res => setClients(res.data || []))
            .catch(() => toast.error("Couldn't load tracked clients"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const create = () => {
        if (!newName.trim()) { toast.error("Enter a name"); return; }
        setCreating(true);
        createTrackedClient(newName.trim())
            .then(res => {
                toast.success("Tracked client created");
                setShowNew(false);
                setNewName("");
                navigate(`/creator/client-tracker/${res.data.id}`);
            })
            .catch(() => toast.error("Couldn't create tracked client"))
            .finally(() => setCreating(false));
    };

    // Summarize a client's sync status across all their holdings.
    const syncSummary = (client) => {
        if (!client.mappedUserId) return { label: "Untracked — no account", color: "text-slate-500" };
        const holdings = client.holdings || [];
        if (holdings.length === 0) return { label: "No holdings yet", color: "text-slate-500" };
        const outOfSync = holdings.filter(h => h.inSync === false).length;
        if (outOfSync === 0) return { label: "In sync", color: "text-green-400" };
        return { label: `${outOfSync} out of sync`, color: "text-amber-400" };
    };

    const mapped = clients.filter(c => c.mappedUserId);
    const totalAum = mapped.reduce((s, c) => s + parseFloat(c.realPortfolioValue || 0), 0);
    const totalDayChange = mapped
        .filter(c => c.realDayChangeAmount != null)
        .reduce((s, c) => s + parseFloat(c.realDayChangeAmount || 0), 0);
    const anyDayChangeData = mapped.some(c => c.realDayChangeAmount != null);

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">📋 Client Tracker</h1>
                    <p className="text-slate-500 text-xs mt-0.5">
                        Everyone you're tracking — real performance for mapped clients, reference-only for the rest.
                    </p>
                </div>
                <button onClick={() => setShowNew(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                                   text-sm font-semibold rounded-xl transition-colors flex-shrink-0">
                    + New
                </button>
            </div>

            {/* At-a-glance across every MAPPED client — the "how's everyone
                doing" summary that used to only exist on the separate
                Clients page. */}
            {mapped.length > 0 && (
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="flex divide-x divide-slate-700/60">
                        <div className="flex-1 px-4 py-3">
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Tracked (mapped)</p>
                            <p className="text-lg font-bold text-white mt-0.5">{mapped.length}</p>
                        </div>
                        <div className="flex-1 px-4 py-3">
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Total AUM</p>
                            <p className="text-lg font-bold text-white mt-0.5">
                                {valuesHidden ? "••••••" : fmtCrore(totalAum)}
                            </p>
                        </div>
                        {anyDayChangeData && (
                            <div className="flex-1 px-4 py-3">
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Today</p>
                                <p className={"text-lg font-bold mt-0.5 " + (totalDayChange >= 0 ? "text-green-400" : "text-red-400")}>
                                    {valuesHidden ? "••••" : (totalDayChange >= 0 ? "+" : "") + fmtCrore(totalDayChange)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showNew && (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                    <input
                        autoFocus
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && create()}
                        placeholder="Client's name (e.g. Rahul)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5
                                   text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                        <button onClick={() => { setShowNew(false); setNewName(""); }}
                                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white
                                           text-sm font-semibold rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button onClick={create} disabled={creating}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                           text-white text-sm font-semibold rounded-xl transition-colors">
                            {creating ? "Creating…" : "Create"}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : clients.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="text-slate-400 text-sm">No tracked clients yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {clients.map(c => {
                        const sync = syncSummary(c);
                        const isMapped = !!c.mappedUserId;
                        const pl = parseFloat(c.realUnrealizedPL || 0);
                        const plPct = parseFloat(c.realUnrealizedPLPercent || 0);
                        const plUp = pl >= 0;
                        const dayChange = c.realDayChangeAmount != null ? parseFloat(c.realDayChangeAmount) : null;
                        const dayChangePct = c.realDayChangePercent != null ? parseFloat(c.realDayChangePercent) : null;
                        const dayUp = dayChange >= 0;

                        return (
                            <button key={c.id}
                                    onClick={() => navigate(`/creator/client-tracker/${c.id}`)}
                                    className="w-full px-4 py-3 bg-slate-800/60 hover:bg-slate-800
                                               border border-slate-700/60 rounded-2xl transition-colors text-left">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-white font-semibold text-sm">{c.displayName}</p>
                                            <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded uppercase " +
                                                (isMapped ? "bg-green-900/30 text-green-400" : "bg-slate-700 text-slate-400")}>
                                                {isMapped ? "Tracked" : "Untracked"}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs mt-0.5">
                                            {c.mappedUsername ? `@${c.mappedUsername}` : "No real account mapped yet"}
                                            {" · "}{(c.holdings || []).length} holding{(c.holdings || []).length === 1 ? "" : "s"}
                                            {isMapped && c.realMfHoldingCount != null && parseInt(c.realMfHoldingCount) > 0 &&
                                                ` · ${c.realMfHoldingCount} MF`}
                                        </p>
                                    </div>
                                    <span className={"text-xs font-semibold flex-shrink-0 " + sync.color}>{sync.label}</span>
                                </div>

                                {/* Real performance — only for mapped clients with
                                    an actual portfolio value to show. */}
                                {isMapped && c.realPortfolioValue != null && (
                                    <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-700/40">
                                        <div>
                                            <p className="text-[10px] text-slate-500">Value</p>
                                            <p className="text-sm font-bold text-white">
                                                {valuesHidden ? "••••••" : fmtCrore(c.realPortfolioValue)}
                                            </p>
                                        </div>
                                        {c.realUnrealizedPL != null && (
                                            <div>
                                                <p className="text-[10px] text-slate-500">P&amp;L</p>
                                                <p className={"text-sm font-bold " + (plUp ? "text-green-400" : "text-red-400")}>
                                                    {valuesHidden ? "••••" : (plUp ? "+" : "") + plPct.toFixed(1) + "%"}
                                                </p>
                                            </div>
                                        )}
                                        {dayChange != null && (
                                            <div>
                                                <p className="text-[10px] text-slate-500">Today</p>
                                                <p className={"text-sm font-bold " + (dayUp ? "text-green-400" : "text-red-400")}>
                                                    {valuesHidden ? "••••" : (dayUp ? "+" : "") + dayChangePct.toFixed(2) + "%"}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}