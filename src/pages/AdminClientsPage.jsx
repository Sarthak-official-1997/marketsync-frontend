import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminClients } from "../api/admin";

const fmt = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
        maximumFractionDigits: 2 }).format(v || 0);

const fmtCrore = (v) => {
    const n = parseFloat(v || 0);
    if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n/1e5).toFixed(2)}L`;
    return `₹${n.toFixed(0)}`;
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const [y, m, day] = d.toString().split("T")[0].split("-");
        return `${day}/${m}/${y}`;
    } catch { return "—"; }
};

const HEALTH = {
    HEALTHY:  { dot: "bg-green-500",  badge: "bg-green-900/30 text-green-400",  label: "Healthy"  },
    WARNING:  { dot: "bg-amber-500",  badge: "bg-amber-900/30 text-amber-400",  label: "Warning"  },
    ALERT:    { dot: "bg-red-500",    badge: "bg-red-900/30 text-red-400",      label: "Alert"    },
    CRITICAL: { dot: "bg-red-600 animate-pulse", badge: "bg-red-900/40 text-red-400", label: "Critical" },
};

export default function AdminClientsPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search,  setSearch]  = useState("");
    const [sortBy,  setSortBy]  = useState("portfolio");  // portfolio|pl|name|health
    const [sortDir, setSortDir] = useState("desc");
    const [filterH, setFilterH] = useState("ALL");        // health filter
    const navigate  = useNavigate();
    const { isCreator } = useAuth();

    useEffect(() => {
        getAdminClients()
            .then(setClients)
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let rows = [...clients];

        // Text search
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(c =>
                (c.fullName || "").toLowerCase().includes(q) ||
                c.username.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q));
        }

        // Health filter
        if (filterH !== "ALL") rows = rows.filter(c => c.healthLevel === filterH);

        // Sort
        rows.sort((a, b) => {
            let va, vb;
            switch (sortBy) {
                case "portfolio":
                    va = parseFloat(a.portfolioValue || 0);
                    vb = parseFloat(b.portfolioValue || 0);
                    break;
                case "pl":
                    va = parseFloat(a.unrealizedPLPercent || 0);
                    vb = parseFloat(b.unrealizedPLPercent || 0);
                    break;
                case "name":
                    va = (a.fullName || a.username || "").toLowerCase();
                    vb = (b.fullName || b.username || "").toLowerCase();
                    return sortDir === "asc"
                        ? va.localeCompare(vb) : vb.localeCompare(va);
                case "joined":
                    va = a.joinedAt || "";
                    vb = b.joinedAt || "";
                    return sortDir === "asc"
                        ? va.localeCompare(vb) : vb.localeCompare(va);
                default: va = 0; vb = 0;
            }
            return sortDir === "asc" ? va - vb : vb - va;
        });

        return rows;
    }, [clients, search, sortBy, sortDir, filterH]);

    const toggle = (col) => {
        if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
        else { setSortBy(col); setSortDir("desc"); }
    };

    const SortBtn = ({ col, label }) => (
        <button onClick={() => toggle(col)}
                className={"text-left text-xs uppercase font-semibold tracking-wide " +
                "transition-colors " +
                (sortBy === col ? "text-blue-400" : "text-slate-400 hover:text-white")}>
            {label} {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : ""}
        </button>
    );

    // Summary stats
    const totalAum     = clients.reduce((s, c) => s + parseFloat(c.portfolioValue || 0), 0);
    const healthCounts = clients.reduce((acc, c) => {
        acc[c.healthLevel] = (acc[c.healthLevel] || 0) + 1; return acc;
    }, {});

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">All Clients</h1>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border
                                         border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {clients.length} clients · Platform AUM {fmtCrore(totalAum)}
                    </p>
                </div>
                <button onClick={() => navigate("/admin")}
                        className="text-sm text-slate-400 hover:text-white hover:underline">
                    ← Dashboard
                </button>
            </div>

            {/* Health summary chips */}
            <div className="flex items-center gap-2 flex-wrap">
                {["ALL", "HEALTHY", "WARNING", "ALERT", "CRITICAL"].map(h => {
                    const count = h === "ALL" ? clients.length : (healthCounts[h] || 0);
                    const hc    = HEALTH[h] || { badge: "bg-slate-700 text-slate-300" };
                    return (
                        <button key={h} onClick={() => setFilterH(h)}
                                className={[
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl",
                                    "text-xs font-semibold transition-all border",
                                    filterH === h
                                        ? (h === "ALL"
                                            ? "bg-blue-600 text-white border-blue-500"
                                            : hc.badge + " border-current/40")
                                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white",
                                ].join(" ")}>
                            {h !== "ALL" && (
                                <div className={"w-1.5 h-1.5 rounded-full " +
                                (filterH === h ? HEALTH[h]?.dot : "bg-slate-500")} />
                            )}
                            {h === "ALL" ? "All" : HEALTH[h]?.label} ({count})
                        </button>
                    );
                })}

                {/* Search */}
                <div className="ml-auto">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name, email…"
                        className="w-52 bg-slate-800 border border-slate-700 text-slate-300
                                   text-xs rounded-xl px-3 py-2 focus:outline-none
                                   focus:border-blue-500 placeholder:text-slate-600"
                    />
                </div>

                <p className="text-xs text-slate-600">{filtered.length} shown</p>
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-2">
                    {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60
                                p-12 text-center">
                    <p className="text-4xl mb-2">👥</p>
                    <p className="text-white font-semibold">No clients found</p>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60
                                overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 bg-slate-900/30">
                            <th className="text-left px-5 py-3">
                                <SortBtn col="name" label="Client" />
                            </th>
                            <th className="text-right px-4 py-3">
                                <SortBtn col="portfolio" label="Portfolio" />
                            </th>
                            <th className="text-right px-4 py-3 hidden md:table-cell">
                                <span className="text-xs text-slate-400 uppercase font-semibold">
                                    Invested
                                </span>
                            </th>
                            <th className="text-right px-4 py-3">
                                <SortBtn col="pl" label="P&L %" />
                            </th>
                            <th className="text-center px-4 py-3 hidden lg:table-cell">
                                <span className="text-xs text-slate-400 uppercase font-semibold">
                                    Holdings
                                </span>
                            </th>
                            <th className="text-left px-4 py-3 hidden md:table-cell">
                                <SortBtn col="joined" label="Joined" />
                            </th>
                            <th className="text-left px-4 py-3">
                                <span className="text-xs text-slate-400 uppercase font-semibold">
                                    Health
                                </span>
                            </th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map(c => {
                            const plPct = parseFloat(c.unrealizedPLPercent || 0);
                            const isPos = plPct >= 0;
                            const hc    = HEALTH[c.healthLevel] || HEALTH.HEALTHY;
                            return (
                                <tr key={c.id}
                                    className="border-b border-slate-700/40 last:border-0
                                               hover:bg-slate-700/30 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/admin/clients/${c.id}`)}>

                                    <td className="px-5 py-3.5">
                                        <p className="text-white font-semibold text-sm">
                                            {c.fullName || c.username}
                                        </p>
                                        <p className="text-slate-500 text-xs">{c.email}</p>
                                    </td>

                                    <td className="text-right px-4 py-3.5">
                                        <p className="text-white font-bold text-sm">
                                            {fmtCrore(c.portfolioValue)}
                                        </p>
                                        <p className="text-slate-600 text-xs">
                                            {fmt(c.portfolioValue)}
                                        </p>
                                    </td>

                                    <td className="text-right px-4 py-3.5 hidden md:table-cell">
                                        <p className="text-slate-300 text-sm">
                                            {fmtCrore(c.totalInvested)}
                                        </p>
                                    </td>

                                    <td className="text-right px-4 py-3.5">
                                        <span className={"text-sm font-bold " +
                                        (c.unrealizedPLPercent == null
                                            ? "text-slate-600"
                                            : isPos ? "text-green-400" : "text-red-400")}>
                                            {c.unrealizedPLPercent == null
                                                ? "—"
                                                : `${isPos?"+":""}${plPct.toFixed(2)}%`}
                                        </span>
                                    </td>

                                    <td className="text-center px-4 py-3.5 hidden lg:table-cell">
                                        <span className="text-slate-300 text-xs">
                                            {c.stockHoldingCount} stocks
                                        </span>
                                        {c.mfHoldingCount > 0 && (
                                            <span className="text-slate-500 text-xs block">
                                                {c.mfHoldingCount} MF
                                            </span>
                                        )}
                                    </td>

                                    <td className="px-4 py-3.5 hidden md:table-cell">
                                        <p className="text-slate-400 text-xs">
                                            {fmtDate(c.joinedAt)}
                                        </p>
                                        <p className="text-slate-600 text-xs">
                                            Last: {fmtDate(c.lastTransactionDate) || "Never"}
                                        </p>
                                    </td>

                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className={"w-2 h-2 rounded-full " + hc.dot} />
                                            <div>
                                                <span className={"text-xs font-semibold px-2 py-0.5 " +
                                                "rounded-full " + hc.badge}>
                                                    {hc.label}
                                                </span>
                                                <p className="text-slate-600 text-xs mt-0.5 max-w-[120px]">
                                                    {c.healthNote}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-col gap-1 items-end">
                                            <span className="text-xs text-blue-400 hover:text-blue-300">
                                                View →
                                            </span>
                                            {isCreator && (
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        navigate(`/admin/clients/${c.id}/view`);
                                                    }}
                                                    className="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap">
                                                    👁 View As
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}