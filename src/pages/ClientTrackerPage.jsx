// src/pages/ClientTrackerPage.jsx
// Creator-only. Lists everyone being tracked, with a quick "still in sync?"
// indicator per client (derived from their holdings' inSync flags), and a
// button to add a new tracked client. Tapping a client opens their full
// holdings detail (TrackedClientDetailPage).

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { listTrackedClients, createTrackedClient } from "../api/clientTracker";

export default function ClientTrackerPage() {
    const navigate = useNavigate();
    const toast = useToast();

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
        if (!client.mappedUserId) return { label: "Not mapped", color: "text-slate-500" };
        const holdings = client.holdings || [];
        if (holdings.length === 0) return { label: "No holdings yet", color: "text-slate-500" };
        const outOfSync = holdings.filter(h => h.inSync === false).length;
        if (outOfSync === 0) return { label: "In sync", color: "text-green-400" };
        return { label: `${outOfSync} out of sync`, color: "text-amber-400" };
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">📋 Client Tracker</h1>
                    <p className="text-slate-500 text-xs mt-0.5">
                        Your own reference copies — replaces the old Google Finance workflow.
                    </p>
                </div>
                <button onClick={() => setShowNew(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                                   text-sm font-semibold rounded-xl transition-colors flex-shrink-0">
                    + New
                </button>
            </div>

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
                        return (
                            <button key={c.id}
                                    onClick={() => navigate(`/creator/client-tracker/${c.id}`)}
                                    className="w-full flex items-center justify-between px-4 py-3
                                               bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60
                                               rounded-2xl transition-colors text-left">
                                <div className="min-w-0">
                                    <p className="text-white font-semibold text-sm">{c.displayName}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        {c.mappedUsername ? `Mapped to @${c.mappedUsername}` : "Not mapped to a real account"}
                                        {" · "}{(c.holdings || []).length} holding{(c.holdings || []).length === 1 ? "" : "s"}
                                    </p>
                                </div>
                                <span className={"text-xs font-semibold flex-shrink-0 " + sync.color}>{sync.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}