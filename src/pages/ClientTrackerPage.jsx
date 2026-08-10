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
import { listTrackedClients, createTrackedClient, getCrossClientExposure } from "../api/clientTracker";
import { getPortfolioSummary, getMfPortfolioSummary } from "../api/portfolio";
import { useAuth } from "../context/AuthContext";
import { getOwnPortfolioScope, setOwnPortfolioScope, OWN_SCOPE_EVENT } from "../utils/ownPortfolioScopePrefs";

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
    const { user } = useAuth();

    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    // Search + sort — not needed at 4 clients, but this list grows past one
    // screen fast once reference-only (unmapped) entries pile up, so it's
    // cheap to add now rather than retrofit later.
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("value"); // "value" | "today" | "name" | "pl"

    // Your OWN portfolio, shown as the first row in this same list — not a
    // tracked client, your real holdings. For now "my portfolio" simply
    // means every stock+MF holding you have, since there's only ever one
    // holdings set per account today. Deliberately isolated behind this one
    // fetch rather than assumed inline, so when the multi-holdings feature
    // lands (letting you mark WHICH holdings set is "main"), only this one
    // spot needs to change — swap these two calls for whatever the
    // multi-holdings API ends up being, nothing else on this page needs to
    // know the difference.
    const [ownSummary, setOwnSummary] = useState(null);
    const [ownScope, setOwnScopeState] = useState(() => getOwnPortfolioScope());

    const loadOwnSummary = (scope) => {
        Promise.allSettled([getPortfolioSummary(), getMfPortfolioSummary()])
            .then(([s, m]) => {
                const includeStocks = scope !== "MF";
                const includeMf     = scope !== "STOCKS";
                const stockVal = includeStocks && s.status === "fulfilled" ? parseFloat(s.value.data?.currentValue || 0) : 0;
                const stockDayPL = includeStocks && s.status === "fulfilled" ? parseFloat(s.value.data?.dayPL || 0) : 0;
                const mfVal = includeMf && m.status === "fulfilled" ? parseFloat(m.value.data?.currentValue || 0) : 0;
                const mfDayChange = includeMf && m.status === "fulfilled" && m.value.data?.dayChangeAmount != null
                    ? parseFloat(m.value.data.dayChangeAmount) : 0;
                const totalVal = stockVal + mfVal;
                const totalDayChange = stockDayPL + mfDayChange;
                const yesterdayVal = totalVal - totalDayChange;
                setOwnSummary({
                    value: totalVal,
                    dayChangeAmount: totalDayChange,
                    dayChangePercent: yesterdayVal > 0 ? (totalDayChange / yesterdayVal) * 100 : 0,
                });
            })
            .catch(() => setOwnSummary(null));
    };

    useEffect(() => {
        loadOwnSummary(ownScope);
        const onChange = (e) => { setOwnScopeState(e.detail); loadOwnSummary(e.detail); };
        window.addEventListener(OWN_SCOPE_EVENT, onChange);
        return () => window.removeEventListener(OWN_SCOPE_EVENT, onChange);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const load = () => {
        setLoading(true);
        listTrackedClients()
            .then(res => setClients(res.data || []))
            .catch(() => toast.error("Couldn't load tracked clients"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    // Cross-client exposure — which single stock you're most exposed to
    // across every mapped client's real account, combined. Separate fetch,
    // separate loading state, since it's a genuinely different question
    // than the per-client list above and shouldn't block that list from
    // rendering if it's slow or fails.
    const [exposure, setExposure] = useState([]);
    const [exposureLoading, setExposureLoading] = useState(true);
    useEffect(() => {
        getCrossClientExposure()
            .then(res => setExposure(res.data || []))
            .catch(() => setExposure([]))
            .finally(() => setExposureLoading(false));
    }, []);

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

    // Summarize a client's sync status across all their holdings — pill
    // styling matches the status badge used on the detail page's Sync &
    // Actions tab, so the two screens read as the same visual language.
    const syncSummary = (client) => {
        if (!client.mappedUserId) {
            return { label: "Untracked", dot: "bg-slate-500", classes: "bg-slate-800 text-slate-400 border-slate-700" };
        }
        const holdings = client.holdings || [];
        if (holdings.length === 0) {
            return { label: "No holdings", dot: "bg-slate-500", classes: "bg-slate-800 text-slate-400 border-slate-700" };
        }
        const outOfSync = holdings.filter(h => h.inSync === false).length;
        if (outOfSync === 0) {
            return { label: "In sync", dot: "bg-green-400", classes: "bg-green-900/20 text-green-400 border-green-700/40" };
        }
        return {
            label: `${outOfSync} pending`,
            dot: "bg-amber-400",
            classes: "bg-amber-900/20 text-amber-400 border-amber-700/40",
        };
    };

    const mapped = clients.filter(c => c.mappedUserId);
    const totalAum = mapped.reduce((s, c) => s + parseFloat(c.realPortfolioValue || 0), 0);
    const totalDayChange = mapped
        .filter(c => c.realDayChangeAmount != null)
        .reduce((s, c) => s + parseFloat(c.realDayChangeAmount || 0), 0);
    const anyDayChangeData = mapped.some(c => c.realDayChangeAmount != null);

    // Filter by name/handle, then sort — client-side, since the full list is
    // already fetched in one call and won't be large enough yet to need
    // server-side paging.
    const visibleClients = clients
        .filter(c => {
            if (!search.trim()) return true;
            const q = search.trim().toLowerCase();
            return (c.displayName || "").toLowerCase().includes(q) ||
                (c.mappedUsername || "").toLowerCase().includes(q);
        })
        .slice()
        .sort((a, b) => {
            if (sortBy === "name") {
                return (a.displayName || "").localeCompare(b.displayName || "");
            }
            if (sortBy === "today") {
                const ta = a.realDayChangePercent != null ? parseFloat(a.realDayChangePercent) : -Infinity;
                const tb = b.realDayChangePercent != null ? parseFloat(b.realDayChangePercent) : -Infinity;
                return tb - ta;
            }
            if (sortBy === "pl") {
                const pa = a.realUnrealizedPLPercent != null ? parseFloat(a.realUnrealizedPLPercent) : -Infinity;
                const pb = b.realUnrealizedPLPercent != null ? parseFloat(b.realUnrealizedPLPercent) : -Infinity;
                return pb - pa;
            }
            // default: value, high to low
            const va = a.realPortfolioValue != null ? parseFloat(a.realPortfolioValue) : -Infinity;
            const vb = b.realPortfolioValue != null ? parseFloat(b.realPortfolioValue) : -Infinity;
            return vb - va;
        });

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

            {/* Cross-client exposure — which single stock you're most
                exposed to across every mapped client's REAL account,
                combined. Only shows once there's more than one mapped
                client, since "cross-client" is meaningless with just one. */}
            {mapped.length > 1 && !exposureLoading && exposure.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                    <p className="text-white font-bold text-sm mb-0.5">Cross-client exposure</p>
                    <p className="text-slate-500 text-[11px] mb-3">
                        Same stock held across multiple clients — your real concentration risk, invisible from any single client's page
                    </p>
                    <div className="space-y-2">
                        {exposure.slice(0, 5).map(e => {
                            const pct = parseFloat(e.percentOfTotalAum || 0);
                            const level = pct >= 15 ? "high" : pct >= 8 ? "med" : "low";
                            const levelClasses = level === "high"
                                ? "bg-red-900/20 text-red-400 border-red-700/40"
                                : level === "med"
                                    ? "bg-amber-900/20 text-amber-400 border-amber-700/40"
                                    : "bg-green-900/20 text-green-400 border-green-700/40";
                            return (
                                <div key={e.symbol} className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-white text-xs font-bold">{e.symbol}</p>
                                            <span className="text-slate-600 text-[10px]">
                                                {e.clientCount} client{e.clientCount === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-[10px] truncate max-w-[220px]">{e.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-slate-300 text-xs font-semibold">
                                            {valuesHidden ? "••••" : fmtCrore(e.combinedValue)}
                                        </span>
                                        <span className={"text-[10px] font-bold px-2 py-1 rounded-full border " + levelClasses}>
                                            {valuesHidden ? "••" : pct.toFixed(1) + "%"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {exposure[0] && parseFloat(exposure[0].percentOfTotalAum || 0) >= 15 && (
                        <p className="text-red-400 text-[10.5px] mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-2">
                            ⚠ {exposure[0].symbol} alone is {parseFloat(exposure[0].percentOfTotalAum).toFixed(0)}% of everything you manage, across {exposure[0].clientCount} client{exposure[0].clientCount === 1 ? "" : "s"}.
                        </p>
                    )}
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

            {/* Your own portfolio — first row, always, regardless of how
                many (if any) tracked clients you have. Not a tracked
                client card, deliberately styled distinctly (accent border)
                so it reads as "this one's you," not just another entry. */}
            {ownSummary && (
                // Links to the existing Combined Portfolio page for now — a
                // dedicated chart-style detail view (matching the tracked-
                // client one) for your own portfolio specifically is real,
                // separate work, not built in this pass.
                <div onClick={() => navigate("/portfolio")}
                     className="px-4 py-3 bg-slate-800/60 hover:bg-slate-800 border border-purple-500/40
                                rounded-2xl mb-2 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <p className="text-white font-semibold text-sm">
                                {user?.fullName || user?.username || "You"}
                            </p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-purple-900/40 text-purple-300">
                                Your Portfolio
                            </span>
                        </div>
                        {/* stopPropagation — the whole card navigates to
                            /portfolio on tap, these buttons shouldn't. */}
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {[["STOCKS", "Stocks"], ["MF", "MF"], ["COMBINED", "Both"]].map(([val, label]) => (
                                <button key={val}
                                        onClick={() => setOwnPortfolioScope(val)} // the event listener above handles state + reload
                                        className={"text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors " +
                                            (ownScope === val
                                                ? "bg-purple-600/20 border-purple-500 text-purple-300"
                                                : "bg-slate-900 border-slate-700 text-slate-500")}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-700/40">
                        <div>
                            <p className="text-[10px] text-slate-500">Value</p>
                            <p className="text-sm font-bold text-white">
                                {valuesHidden ? "••••••" : fmtCrore(ownSummary.value)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500">Today</p>
                            <p className={"text-sm font-bold " + (ownSummary.dayChangePercent >= 0 ? "text-green-400" : "text-red-400")}>
                                {valuesHidden ? "••••" : (ownSummary.dayChangePercent >= 0 ? "+" : "") + ownSummary.dayChangePercent.toFixed(2) + "%"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {clients.length > 0 && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 bg-slate-800/60 border border-slate-700/60
                                     rounded-xl px-3 py-2">
                        <span className="text-slate-500 text-sm flex-shrink-0">🔍</span>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search clients…"
                            className="w-full min-w-0 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none"
                        />
                    </div>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="flex-shrink-0 max-w-[120px] bg-slate-800/60 border border-slate-700/60 rounded-xl
                                   px-2.5 py-2 text-white text-xs font-medium focus:outline-none focus:border-blue-500
                                   truncate">
                        <option value="value">Value ↓</option>
                        <option value="today">Today</option>
                        <option value="pl">P&amp;L %</option>
                        <option value="name">Name A–Z</option>
                    </select>
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
            ) : visibleClients.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-slate-500 text-sm">No clients match "{search}"</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleClients.map(c => {
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
                                    <span className={"inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 " +
                                        "rounded-full border flex-shrink-0 whitespace-nowrap " + sync.classes}>
                                        <span className={"w-1.5 h-1.5 rounded-full " + sync.dot} />
                                        {sync.label}
                                    </span>
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