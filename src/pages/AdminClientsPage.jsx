import { useState, useEffect, useMemo, useRef } from "react";
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

// ── Editable health thresholds ────────────────────────────────────────────
// Health is derived on the FRONTEND from each client's unrealized P&L %, using
// the cutoffs below. They're creator-editable and saved per-device. This
// intentionally overrides any healthLevel the backend sends, so the rules are
// yours to set with no backend change. Read as "P&L % at or below X".
const DEFAULT_THRESHOLDS = { warning: 0, alert: -5, critical: -10 };
const THRESHOLDS_KEY = "folyo_client_health_thresholds";

function loadThresholds() {
    try {
        const raw = localStorage.getItem(THRESHOLDS_KEY);
        if (raw) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_THRESHOLDS };
}

function computeHealth(plPct, t) {
    if (plPct == null || isNaN(plPct)) return "HEALTHY";
    if (plPct <= t.critical) return "CRITICAL";
    if (plPct <= t.alert)    return "ALERT";
    if (plPct <= t.warning)  return "WARNING";
    return "HEALTHY";
}

function initials(c) {
    const s = (c.fullName || c.username || "?").trim();
    const parts = s.split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function useIsMobile() {
    const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
    useEffect(() => {
        const on = () => setM(window.innerWidth < 768);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, []);
    return m;
}

// Stable, module-level so it never remounts mid-typing (that was closing the
// keyboard). Values are kept as local strings while editing and only saved on
// blur / stepper, so typing a lone "-" never triggers a parse-and-rerender.
const RULE_ROWS = [
    { key: "warning",  label: "Warning at or below",  color: "text-amber-400" },
    { key: "alert",    label: "Alert at or below",    color: "text-red-400"   },
    { key: "critical", label: "Critical at or below", color: "text-red-500"   },
];

function RulesPanel({ thresholds, counts, onSave, onReset }) {
    const [draft, setDraft] = useState({
        warning:  String(thresholds.warning),
        alert:    String(thresholds.alert),
        critical: String(thresholds.critical),
    });
    const [applied, setApplied] = useState(false);
    const flashRef = useRef(null);

    // Brief "Applied" confirmation whenever a value actually lands.
    const flash = () => {
        setApplied(true);
        clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setApplied(false), 1300);
    };
    useEffect(() => () => clearTimeout(flashRef.current), []);

    const push = (key, n) => { onSave(key, n); flash(); };

    // Apply as you type: if the current text is a valid number, push it straight
    // to thresholds so the list reclassifies live. Partial input ("", "-", "-.")
    // stays in the local draft and isn't committed, so negative entry still works.
    const change = (key, raw) => {
        setDraft(d => ({ ...d, [key]: raw }));
        const n = parseFloat(raw);
        if (raw.trim() !== "" && !isNaN(n) && isFinite(n)) push(key, n);
    };
    const commit = (key) => {
        const n = parseFloat(draft[key]);
        const val = isNaN(n) ? 0 : n;
        setDraft(d => ({ ...d, [key]: String(val) }));
        push(key, val);
    };
    const step = (key, delta) => {
        const base = parseFloat(draft[key]);
        const n = (isNaN(base) ? (Number(thresholds[key]) || 0) : base) + delta;
        setDraft(d => ({ ...d, [key]: String(n) }));
        push(key, n);
    };
    const reset = () => {
        onReset();
        setDraft({
            warning:  String(DEFAULT_THRESHOLDS.warning),
            alert:    String(DEFAULT_THRESHOLDS.alert),
            critical: String(DEFAULT_THRESHOLDS.critical),
        });
        flash();
    };

    const c = counts || {};

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">Health rules</p>
                    <span className={"text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                    "bg-green-900/30 text-green-400 transition-opacity duration-300 " +
                    (applied ? "opacity-100" : "opacity-0")}>
                        ✓ Applied
                    </span>
                </div>
                <button onClick={reset}
                        className="text-xs text-slate-400 hover:text-white">Reset</button>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
                Based on each client's unrealized P&amp;L %. Saved on this device.
            </p>

            {/* Live tally — updates the instant a rule changes */}
            <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold
                            bg-slate-900/50 rounded-lg px-3 py-2">
                <span className="text-green-400">{c.HEALTHY || 0} Healthy</span>
                <span className="text-amber-400">{c.WARNING || 0} Warning</span>
                <span className="text-red-400">{c.ALERT || 0} Alert</span>
                <span className="text-red-500">{c.CRITICAL || 0} Critical</span>
            </div>

            {RULE_ROWS.map(row => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                    <span className={"text-xs font-semibold " + row.color}>{row.label}</span>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => step(row.key, -1)}
                                aria-label="decrease"
                                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700
                                           text-white text-lg leading-none flex items-center
                                           justify-center active:bg-slate-700">−</button>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={draft[row.key]}
                            onChange={e => change(row.key, e.target.value)}
                            onBlur={() => commit(row.key)}
                            className="w-14 bg-slate-900 border border-slate-700 text-white
                                       text-sm rounded-lg px-2 py-1.5 text-center
                                       focus:outline-none focus:border-blue-500"
                        />
                        <button type="button" onClick={() => step(row.key, +1)}
                                aria-label="increase"
                                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700
                                           text-white text-lg leading-none flex items-center
                                           justify-center active:bg-slate-700">+</button>
                        <span className="text-slate-500 text-sm">%</span>
                    </div>
                </div>
            ))}
            <p className="text-[11px] text-slate-600 leading-snug">
                Use −/+ to go negative, or type a value. Anything above the warning cutoff is
                Healthy. These rules apply here only — they don't change server-side data.
            </p>
        </div>
    );
}

export default function AdminClientsPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search,  setSearch]  = useState("");
    const [sortBy,  setSortBy]  = useState("portfolio");  // portfolio|pl|name|health
    const [sortDir, setSortDir] = useState("desc");
    const [filterH, setFilterH] = useState("ALL");        // health filter
    const [thresholds, setThresholds] = useState(loadThresholds);
    const [showRules, setShowRules]   = useState(false);
    const navigate  = useNavigate();
    const { isCreator } = useAuth();
    const isMobile  = useIsMobile();

    useEffect(() => {
        getAdminClients()
            .then(setClients)
            .finally(() => setLoading(false));
    }, []);

    const saveThreshold = (key, val) => {
        setThresholds(prev => {
            const next = { ...prev, [key]: (val === "" || val == null) ? 0 : parseFloat(val) };
            try { localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };
    const resetThresholds = () => {
        setThresholds({ ...DEFAULT_THRESHOLDS });
        try { localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(DEFAULT_THRESHOLDS)); } catch { /* ignore */ }
    };

    // Attach a frontend-computed health level to every client.
    const withHealth = useMemo(() =>
        clients.map(c => ({
            ...c,
            _health: computeHealth(parseFloat(c.unrealizedPLPercent), thresholds),
        })), [clients, thresholds]);

    const filtered = useMemo(() => {
        let rows = [...withHealth];

        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(c =>
                (c.fullName || "").toLowerCase().includes(q) ||
                c.username.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q));
        }

        if (filterH !== "ALL") rows = rows.filter(c => c._health === filterH);

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
    }, [withHealth, search, sortBy, sortDir, filterH]);

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

    const totalAum     = clients.reduce((s, c) => s + parseFloat(c.portfolioValue || 0), 0);
    const healthCounts = withHealth.reduce((acc, c) => {
        acc[c._health] = (acc[c._health] || 0) + 1; return acc;
    }, {});

    // ── Mobile card (Direction A) ────────────────────────────────────────
    const ClientCard = ({ c }) => {
        const plPct = parseFloat(c.unrealizedPLPercent || 0);
        const hasPl = c.unrealizedPLPercent != null;
        const isPos = plPct >= 0;
        const hc    = HEALTH[c._health] || HEALTH.HEALTHY;
        return (
            <div onClick={() => navigate(`/admin/clients/${c.id}`)}
                 className="flex items-center gap-3 px-3.5 py-3 border-b border-slate-800/60
                            active:bg-slate-800/40">
                <div className="w-9 h-9 rounded-full flex items-center justify-center
                                text-xs font-bold flex-shrink-0 bg-slate-700 text-slate-200">
                    {initials(c)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-white truncate">
                            {c.fullName || c.username}
                        </span>
                        {c.role === "ADMIN" && (
                            <span className="flex-shrink-0 text-[8px] font-bold px-[5px] py-[1px]
                                             rounded bg-amber-500/20 text-amber-400">ADMIN</span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{c.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold text-white tabular-nums">
                        {fmtCrore(c.portfolioValue)}
                    </p>
                    <p className={"text-[11px] font-semibold tabular-nums " +
                    (!hasPl ? "text-slate-600" : isPos ? "text-green-400" : "text-red-400")}>
                        {!hasPl ? "—" : `${isPos ? "+" : ""}${plPct.toFixed(2)}%`}
                    </p>
                </div>
                <span className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + hc.dot}
                      aria-label={hc.label} />
            </div>
        );
    };

    return (
        <div className="space-y-4 md:space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl md:text-2xl font-bold text-white">Clients</h1>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border
                                         border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {clients.length} clients · AUM {fmtCrore(totalAum)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowRules(v => !v)}
                            className="text-xs text-slate-300 bg-slate-800 border border-slate-700
                                       px-3 py-1.5 rounded-xl hover:text-white">
                        ⚙ Health rules
                    </button>
                    {!isMobile && (
                        <button onClick={() => navigate("/admin")}
                                className="text-sm text-slate-400 hover:text-white hover:underline">
                            ← Dashboard
                        </button>
                    )}
                </div>
            </div>

            {showRules && (
                <RulesPanel thresholds={thresholds} counts={healthCounts}
                            onSave={saveThreshold} onReset={resetThresholds} />
            )}

            {/* Search — full width on mobile, above chips */}
            {isMobile && (
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, email…"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300
                               text-sm rounded-xl px-3.5 py-2.5 focus:outline-none
                               focus:border-blue-500 placeholder:text-slate-600"
                />
            )}

            {/* Health filter chips */}
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

                {/* Search — desktop only, right-aligned */}
                {!isMobile && (
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
                )}
                <p className="text-xs text-slate-600">{filtered.length} shown</p>
            </div>

            {/* List */}
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
            ) : isMobile ? (
                /* Direction A — card list */
                <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden">
                    {filtered.map(c => <ClientCard key={c.id} c={c} />)}
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
                            const hc    = HEALTH[c._health] || HEALTH.HEALTHY;
                            return (
                                <tr key={c.id}
                                    className="border-b border-slate-700/40 last:border-0
                                               hover:bg-slate-700/30 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/admin/clients/${c.id}`)}>

                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-semibold text-sm">
                                                {c.fullName || c.username}
                                            </p>
                                            {c.role === "ADMIN" && (
                                                <span className="text-xs px-1.5 py-0.5 bg-amber-500/20
                             text-amber-400 border border-amber-500/30
                             rounded font-bold">
                ADMIN
            </span>
                                            )}
                                        </div>
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