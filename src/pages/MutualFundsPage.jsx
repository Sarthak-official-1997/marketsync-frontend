import { useState, useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";
import AiMfImportModal from "../components/AiMfImportModal";

import {
    getMfHoldings, getMfPortfolioSummary, getMfTransactions,
    addMfTransaction, deleteMfTransaction, searchMfSchemes,
    getMfNavOnDate,
} from "../api/portfolio";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtUnits  = (val) => parseFloat(val || 0).toFixed(4);
const fmtPct    = (val) => {
    const n = parseFloat(val || 0);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

const isBuyType = (t) =>
    ["PURCHASE", "SIP", "SWITCH_IN", "DIVIDEND_REINVESTMENT"].includes(t);

// -- Transaction type config --------------------------------------------------─
const TX_TYPE_CARDS = [
    { value: "PURCHASE",              label: "Purchase",   icon: "💰",
        desc: "Lump sum investment",    color: "green"  },
    { value: "SIP",                   label: "SIP",        icon: "📅",
        desc: "Systematic plan",        color: "blue"   },
    { value: "REDEMPTION",            label: "Redeem",     icon: "📤",
        desc: "Sell / withdraw units",  color: "red"    },
    { value: "SWITCH_IN",             label: "Switch In",  icon: "↗",
        desc: "Receive from switch",    color: "teal"   },
    { value: "SWITCH_OUT",            label: "Switch Out", icon: "↙",
        desc: "Send to another fund",   color: "amber"  },
    { value: "DIVIDEND_REINVESTMENT", label: "Dividend",   icon: "💸",
        desc: "Reinvested dividend",    color: "purple" },
];

const TYPE_COLOR = {
    green:  { card: "border-green-500/40 bg-green-900/20 text-green-300",
        active: "border-green-500 bg-green-900/40 text-green-200 shadow-[0_0_12px_rgba(34,197,94,0.2)]" },
    blue:   { card: "border-blue-500/40 bg-blue-900/20 text-blue-300",
        active: "border-blue-500 bg-blue-900/40 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]" },
    red:    { card: "border-red-500/40 bg-red-900/20 text-red-300",
        active: "border-red-500 bg-red-900/40 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.2)]" },
    teal:   { card: "border-teal-500/40 bg-teal-900/20 text-teal-300",
        active: "border-teal-500 bg-teal-900/40 text-teal-200 shadow-[0_0_12px_rgba(20,184,166,0.2)]" },
    amber:  { card: "border-amber-500/40 bg-amber-900/20 text-amber-300",
        active: "border-amber-500 bg-amber-900/40 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]" },
    purple: { card: "border-purple-500/40 bg-purple-900/20 text-purple-300",
        active: "border-purple-500 bg-purple-900/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.2)]" },
};

const FILTER_CHIPS = [
    { label: "All",      value: "ALL"      },
    { label: "Purchase", value: "PURCHASE" },
    { label: "SIP",      value: "SIP"      },
    { label: "Redeem",   value: "REDEMPTION" },
    { label: "Switch",   value: "SWITCH"   },
    { label: "Dividend", value: "DIVIDEND_REINVESTMENT" },
];

// ====================================================================
// MAIN PAGE
// ====================================================================
export default function MutualFundsPage() {
    const [activeTab,        setActiveTab]        = useState("holdings");
    const [preselectedScheme,setPreselected]       = useState(null);
    const [showAiImport,     setShowAiImport]      = useState(false);
    const toast = useToast();

    const handleTransactFromSearch = (scheme) => {
        setPreselected(scheme);
        setActiveTab("transact");
    };

    const tabs = [
        { id: "holdings",     label: "Holdings",     icon: "💼" },
        { id: "transact",     label: "Transact",     icon: "📝" },
        { id: "transactions", label: "History",      icon: "🕐" },
        { id: "search",       label: "Search Funds", icon: "🔍" },
    ];

    return (
        <div className="space-y-4">

            {/* -- Page header with action buttons -- */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Mutual Funds</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        NAV updated daily after 6 PM IST via AMFI
                    </p>
                </div>
                {/* Idea 1: Page-level action buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAiImport(true)}
                        className="flex items-center gap-2 px-4 py-2.5
                                   bg-purple-600/20 hover:bg-purple-600/40
                                   border border-purple-500/30 hover:border-purple-500/60
                                   text-purple-300 text-sm font-semibold rounded-xl
                                   transition-all shadow-[0_0_12px_rgba(168,85,247,0.1)]
                                   hover:shadow-[0_0_16px_rgba(168,85,247,0.2)]">
                        ✨ AI Import
                    </button>
                    <button
                        onClick={() => setActiveTab("transact")}
                        className="flex items-center gap-2 px-4 py-2.5
                                   bg-blue-600 hover:bg-blue-700
                                   text-white text-sm font-semibold rounded-xl
                                   transition-colors">
                        + Add Transaction
                    </button>
                </div>
            </div>

            <MfSummaryBar />

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors " +
                                (activeTab === tab.id
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:text-white")
                            }>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div>
                {activeTab === "holdings"     && <MfHoldingsTab toast={toast} />}
                {activeTab === "transact"     && (
                    <MfTransactTab
                        toast={toast}
                        preselectedScheme={preselectedScheme}
                        onSuccess={() => { setPreselected(null); setActiveTab("holdings"); }}
                    />
                )}
                {activeTab === "transactions" && <MfHistoryTab toast={toast} />}
                {activeTab === "search"       && (
                    <MfSearchTab onTransact={handleTransactFromSearch} />
                )}
            </div>

            {showAiImport && (
                <AiMfImportModal
                    onClose={() => setShowAiImport(false)}
                    onImported={() => {
                        setShowAiImport(false);
                        setActiveTab("holdings");
                    }}
                />
            )}
        </div>
    );
}

// ====================================================================
// SUMMARY BAR
// ====================================================================
function MfSummaryBar() {
    const [summary, setSummary] = useState(null);
    const toast = useToast();

    useEffect(() => {
        getMfPortfolioSummary()
            .then((res) => setSummary(res.data))
            .catch(() => {});
    }, []);

    if (!summary || summary.schemeCount === 0) return null;

    const pl    = parseFloat(summary.unrealizedPnl || 0);
    const plPct = parseFloat(summary.unrealizedPnlPercent || 0);
    const isPos = pl >= 0;
    const color = isPos ? "text-green-400" : "text-red-400";

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
                ["Schemes Held",   summary.schemeCount,       "text-white", false],
                ["Invested",       fmt(summary.totalInvested), "text-white", false],
                ["Current Value",  fmt(summary.currentValue),  "text-white", false],
                ["Unrealized P&L", fmt(summary.unrealizedPnl), color,        true ],
            ].map(([label, value, cls, showPct]) => (
                <div key={label}
                     className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={"text-lg font-bold mt-1 " + cls}>{value}</p>
                    {showPct && (
                        <p className={"text-xs font-medium mt-0.5 " + color}>
                            {fmtPct(plPct)}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

// ====================================================================
// HOLDINGS TAB
// ====================================================================
function MfHoldingsTab({ toast }) {
    const [holdings, setHoldings] = useState([]);
    const [loading,  setLoading]  = useState(true);

    useEffect(() => {
        getMfHoldings()
            .then((res) => setHoldings(res.data))
            .catch(() => toast.error("Failed to load MF holdings"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="space-y-2">
            {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse"/>
            ))}
        </div>
    );

    if (holdings.length === 0) return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-white font-semibold">No MF holdings yet</p>
            <p className="text-slate-400 text-sm mt-1">
                Use AI Import or the Transact tab to record your first investment
            </p>
        </div>
    );

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Scheme</th>
                    <th className="text-right px-4 py-3">Units</th>
                    <th className="text-right px-4 py-3">Avg NAV</th>
                    <th className="text-right px-4 py-3">Current NAV</th>
                    <th className="text-right px-4 py-3">Invested</th>
                    <th className="text-right px-4 py-3">Value</th>
                    <th className="text-right px-4 py-3">P&amp;L</th>
                    <th className="text-right px-4 py-3">P&amp;L %</th>
                </tr>
                </thead>
                <tbody>
                {holdings.map((h) => {
                    const pl    = parseFloat(h.unrealizedPnl || 0);
                    const plPct = parseFloat(h.unrealizedPnlPercent || 0);
                    const color = pl >= 0 ? "text-green-400" : "text-red-400";
                    return (
                        <tr key={h.id}
                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 max-w-xs">
                                <p className="font-semibold text-white truncate" title={h.schemeName}>
                                    {h.schemeName}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                    {h.fundHouse}{h.schemeCategory ? " · " + h.schemeCategory : ""}
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    NAV as of {h.navDate || "—"}
                                </p>
                            </td>
                            <td className="text-right px-4 py-3 text-white">{fmtUnits(h.units)}</td>
                            <td className="text-right px-4 py-3 text-slate-300">{fmt(h.avgCostNav)}</td>
                            <td className="text-right px-4 py-3 text-slate-300">{fmt(h.currentNav)}</td>
                            <td className="text-right px-4 py-3 text-slate-300">{fmt(h.totalInvested)}</td>
                            <td className="text-right px-4 py-3 text-white font-medium">{fmt(h.currentValue)}</td>
                            <td className={"text-right px-4 py-3 font-medium " + color}>{fmt(h.unrealizedPnl)}</td>
                            <td className={"text-right px-4 py-3 font-medium " + color}>{fmtPct(plPct)}</td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
}

// ====================================================================
// TRANSACT TAB — Idea 3: type cards + scheme context
// ====================================================================
function MfTransactTab({ toast, onSuccess, preselectedScheme }) {
    const [selectedType,    setSelectedType]    = useState("PURCHASE");
    const [schemeQuery,     setSchemeQuery]      = useState("");
    const [schemeResults,   setSchemeResults]    = useState([]);
    const [selectedScheme,  setSelectedScheme]   = useState(null);
    const [form, setForm] = useState({
        transactionDate: new Date().toISOString().split("T")[0],
        nav: "", amount: "", units: "", notes: "",
    });
    const [navLoading,  setNavLoading]  = useState(false);
    const [submitting,  setSubmitting]  = useState(false);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (preselectedScheme) {
            setSelectedScheme(preselectedScheme);
            setSchemeQuery(preselectedScheme.schemeName);
            if (preselectedScheme.nav)
                setForm(f => ({ ...f, nav: preselectedScheme.nav.toString() }));
        }
    }, [preselectedScheme]);

    useEffect(() => {
        if (!selectedScheme || !form.transactionDate) return;
        fetchNavForDate(selectedScheme.schemeCode, form.transactionDate);
    }, [form.transactionDate, selectedScheme?.schemeCode]);

    const fetchNavForDate = async (schemeCode, date) => {
        setNavLoading(true);
        try {
            const res = await getMfNavOnDate(schemeCode, date);
            const nav = res.data.nav.toString();
            setForm(f => {
                const newForm = { ...f, nav };
                if (f.amount && parseFloat(f.amount) > 0 && parseFloat(nav) > 0)
                    newForm.units = (parseFloat(f.amount) / parseFloat(nav)).toFixed(4);
                return newForm;
            });
        } catch {
            setForm(f => ({ ...f, nav: "" }));
        } finally {
            setNavLoading(false);
        }
    };

    const handleAmountChange = (value) =>
        setForm(f => {
            const nav = parseFloat(f.nav), amount = parseFloat(value);
            return { ...f, amount: value,
                units: nav > 0 && amount > 0 ? (amount / nav).toFixed(4) : f.units };
        });

    const handleUnitsChange = (value) =>
        setForm(f => {
            const nav = parseFloat(f.nav), units = parseFloat(value);
            return { ...f, units: value,
                amount: nav > 0 && units > 0 ? (units * nav).toFixed(2) : f.amount };
        });

    const handleNavChange = (value) =>
        setForm(f => {
            const nav = parseFloat(value), amount = parseFloat(f.amount);
            return { ...f, nav: value,
                units: nav > 0 && amount > 0 ? (amount / nav).toFixed(4) : f.units };
        });

    const handleSchemeSearch = (q) => {
        setSchemeQuery(q);
        setSelectedScheme(null);
        setForm(f => ({ ...f, nav: "", amount: "", units: "" }));
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setSchemeResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await searchMfSchemes(q);
                setSchemeResults(res.data.content || []);
            } catch { setSchemeResults([]); }
        }, 300);
    };

    const handleSchemeSelect = (scheme) => {
        setSelectedScheme(scheme);
        setSchemeQuery(scheme.schemeName);
        setSchemeResults([]);
        setForm(f => ({ ...f, nav: "", amount: "", units: "" }));
        fetchNavForDate(scheme.schemeCode, form.transactionDate);
    };

    const handleSubmit = async () => {
        if (!selectedScheme)           { toast.error("Please select a scheme"); return; }
        if (!form.nav)                 { toast.error("NAV is required"); return; }
        if (!form.amount && !form.units) { toast.error("Enter either amount or units"); return; }

        const nav    = parseFloat(form.nav);
        const amount = form.amount ? parseFloat(form.amount) : parseFloat(form.units) * nav;
        const units  = form.units  ? parseFloat(form.units)  : amount / nav;

        if (units <= 0 || nav <= 0) { toast.error("Invalid units or NAV value"); return; }

        setSubmitting(true);
        try {
            await addMfTransaction({
                schemeCode:       selectedScheme.schemeCode,
                transactionType:  selectedType,
                units:            parseFloat(units.toFixed(6)),
                navAtTransaction: nav,
                transactionDate:  form.transactionDate,
                notes:            form.notes || null,
            });
            toast.success("Transaction recorded successfully");
            onSuccess();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to record transaction");
        } finally {
            setSubmitting(false);
        }
    };

    const selectedCard = TX_TYPE_CARDS.find(c => c.value === selectedType);

    return (
        <div className="max-w-2xl space-y-5">

            {/* Idea 3: Transaction type cards */}
            <div>
                <p className="text-xs text-slate-400 font-medium mb-3">
                    Transaction Type *
                </p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {TX_TYPE_CARDS.map(card => {
                        const colors = TYPE_COLOR[card.color];
                        const isActive = selectedType === card.value;
                        return (
                            <button
                                key={card.value}
                                onClick={() => setSelectedType(card.value)}
                                className={`flex flex-col items-center gap-1.5 px-2 py-3
                                           border rounded-xl transition-all text-center ${
                                    isActive ? colors.active : colors.card +
                                        " hover:opacity-80"
                                }`}
                            >
                                <span className="text-xl leading-none">{card.icon}</span>
                                <span className="text-xs font-bold leading-tight">
                                    {card.label}
                                </span>
                                <span className="text-[10px] opacity-70 leading-tight hidden md:block">
                                    {card.desc}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                    <span>{selectedCard?.icon}</span>
                    Record {selectedCard?.label}
                </h2>

                {/* Scheme search */}
                <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                        Scheme *
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={schemeQuery}
                            onChange={e => handleSchemeSearch(e.target.value)}
                            placeholder="Search scheme name e.g. HDFC Mid Cap"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                       px-3 py-2.5 text-white text-sm focus:outline-none
                                       focus:border-blue-500"
                        />
                        {schemeResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-slate-700
                                            border border-slate-600 rounded-xl shadow-xl
                                            max-h-56 overflow-y-auto">
                                {schemeResults.map(s => (
                                    <button key={s.schemeCode} type="button"
                                            onClick={() => handleSchemeSelect(s)}
                                            className="w-full text-left px-4 py-3
                                                       hover:bg-slate-600 border-b
                                                       border-slate-600/50 last:border-0">
                                        <p className="text-white text-sm font-medium">
                                            {s.schemeName}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            {s.fundHouse}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedScheme && (
                        <p className="text-xs text-green-400 mt-1">
                            ✓ {selectedScheme.schemeCode} — {selectedScheme.schemeName}
                        </p>
                    )}
                </div>

                {/* Date */}
                <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                        Transaction Date *
                    </label>
                    <input type="date"
                           value={form.transactionDate}
                           max={new Date().toISOString().split("T")[0]}
                           onChange={e => setForm(f => ({ ...f, transactionDate: e.target.value }))}
                           className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                      px-3 py-2.5 text-white text-sm focus:outline-none
                                      focus:border-blue-500"
                    />
                </div>

                {/* NAV */}
                <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                        NAV on Date *
                    </label>
                    <div className="relative">
                        <input type="number" step="0.0001" min="0.0001"
                               value={form.nav}
                               onChange={e => handleNavChange(e.target.value)}
                               placeholder={navLoading ? "Fetching NAV…" : "e.g. 123.45"}
                               disabled={navLoading}
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2.5 text-white text-sm focus:outline-none
                                          focus:border-blue-500 disabled:opacity-60"
                        />
                        {navLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-400
                                                border-t-transparent rounded-full animate-spin"/>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Auto-fetched from AMFI · You can edit if needed
                    </p>
                </div>

                {/* Amount + Units */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1.5">
                            Amount (₹)
                        </label>
                        <input type="number" step="1" min="1"
                               value={form.amount}
                               onChange={e => handleAmountChange(e.target.value)}
                               placeholder="e.g. 5000"
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2.5 text-white text-sm focus:outline-none
                                          focus:border-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Enter amount → units calculated
                        </p>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1.5">
                            Units
                        </label>
                        <input type="number" step="0.0001" min="0.0001"
                               value={form.units}
                               onChange={e => handleUnitsChange(e.target.value)}
                               placeholder="e.g. 40.5678"
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2.5 text-white text-sm focus:outline-none
                                          focus:border-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Or enter units → amount calculated
                        </p>
                    </div>
                </div>

                {/* Summary preview */}
                {form.nav && (form.amount || form.units) && (
                    <div className="bg-slate-700/50 rounded-lg px-4 py-3 space-y-1.5">
                        {[
                            ["NAV",    "₹" + parseFloat(form.nav).toFixed(4)],
                            ["Units",  form.units  ? parseFloat(form.units).toFixed(4)  : "—"],
                            ["Amount", form.amount ? "₹" + parseFloat(form.amount).toFixed(2) : "—"],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between text-sm">
                                <span className="text-slate-400">{label}</span>
                                <span className="text-white font-medium">{value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Notes */}
                <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                        Notes (optional)
                    </label>
                    <input type="text"
                           value={form.notes}
                           onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                           placeholder="e.g. Monthly SIP — May 2026"
                           className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                      px-3 py-2.5 text-white text-sm focus:outline-none
                                      focus:border-blue-500"
                    />
                </div>

                <button onClick={handleSubmit} disabled={submitting || navLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                   text-white font-semibold py-3 rounded-xl transition-colors">
                    {submitting ? "Recording..." : `Record ${selectedCard?.label}`}
                </button>
            </div>
        </div>
    );
}

// ====================================================================
// HISTORY TAB — Idea 2: filters + group by scheme + summary
// ====================================================================
function MfHistoryTab({ toast }) {
    const [transactions, setTransactions] = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [page,         setPage]         = useState(0);
    const [totalPages,   setTotalPages]   = useState(0);
    const [filter,       setFilter]       = useState("ALL");
    const [expanded,     setExpanded]     = useState({}); // schemeKey → bool

    const load = (p = 0) => {
        setLoading(true);
        getMfTransactions(p)
            .then(res => {
                setTransactions(res.data.content || []);
                setTotalPages(res.data.totalPages || 0);
                setPage(p);
            })
            .catch(() => toast.error("Failed to load transactions"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction? Holdings will be recalculated.")) return;
        try {
            await deleteMfTransaction(id);
            toast.success("Transaction deleted");
            load(page);
        } catch { toast.error("Failed to delete transaction"); }
    };

    // Filter transactions
    const filtered = transactions.filter(tx => {
        if (filter === "ALL")    return true;
        if (filter === "SWITCH") return tx.transactionType.startsWith("SWITCH");
        return tx.transactionType === filter;
    });

    // Summary stats
    const totalInvested  = transactions
        .filter(t => isBuyType(t.transactionType))
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalRedeemed  = transactions
        .filter(t => !isBuyType(t.transactionType))
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const thisMonthTotal = transactions
        .filter(t => {
            const d = new Date(t.transactionDate || "");
            const n = new Date();
            return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
        })
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

    // Group by scheme
    const grouped = {};
    filtered.forEach(tx => {
        const key = tx.schemeName || "Unknown";
        if (!grouped[key]) grouped[key] = { schemeName: key, fundHouse: tx.fundHouse, txns: [] };
        grouped[key].txns.push(tx);
    });

    const txTypeColor = (type) =>
        isBuyType(type) ? "text-green-400 bg-green-900/20" : "text-red-400 bg-red-900/20";

    if (loading) return (
        <div className="space-y-2">
            {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse"/>
            ))}
        </div>
    );

    return (
        <div className="space-y-4">

            {/* Summary stats */}
            {transactions.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        ["Total Invested", fmt(totalInvested),  "text-blue-400",  "bg-blue-900/20 border-blue-500/20"  ],
                        ["Total Redeemed", fmt(totalRedeemed),  "text-amber-400", "bg-amber-900/20 border-amber-500/20"],
                        ["This Month",     fmt(thisMonthTotal), "text-green-400", "bg-green-900/20 border-green-500/20"],
                    ].map(([label, value, cls, bg]) => (
                        <div key={label} className={`${bg} border rounded-xl px-4 py-3`}>
                            <p className="text-slate-500 text-xs">{label}</p>
                            <p className={`${cls} font-bold text-base mt-0.5`}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
                {FILTER_CHIPS.map(chip => (
                    <button key={chip.value} onClick={() => setFilter(chip.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold
                                       transition-colors ${
                                filter === chip.value
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                            }`}>
                        {chip.label}
                        {chip.value !== "ALL" && (
                            <span className="ml-1 opacity-60">
                                ({transactions.filter(t =>
                                chip.value === "SWITCH"
                                    ? t.transactionType.startsWith("SWITCH")
                                    : t.transactionType === chip.value
                            ).length})
                            </span>
                        )}
                    </button>
                ))}
                <span className="ml-auto text-slate-500 text-xs">
                    {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <p className="text-4xl mb-3">🕐</p>
                    <p className="text-white font-semibold">No transactions yet</p>
                    <p className="text-slate-400 text-sm mt-1">
                        Use AI Import or the Transact tab to record your first transaction
                    </p>
                </div>
            )}

            {/* Grouped by scheme */}
            {Object.entries(grouped).map(([key, group]) => {
                const isOpen     = expanded[key] !== false; // default open
                const groupBuys  = group.txns.filter(t => isBuyType(t.transactionType));
                const groupSells = group.txns.filter(t => !isBuyType(t.transactionType));
                const lastDate   = group.txns
                    .map(t => t.transactionDate || "")
                    .sort().reverse()[0];

                return (
                    <div key={key}
                         className="bg-slate-800 rounded-xl border border-slate-700/60 overflow-hidden">
                        {/* Group header */}
                        <button
                            onClick={() => setExpanded(prev => ({ ...prev, [key]: !isOpen }))}
                            className="w-full flex items-center justify-between
                                       px-5 py-4 hover:bg-slate-700/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border
                                                border-blue-500/30 flex items-center justify-center
                                                text-blue-300 text-xs font-bold flex-shrink-0">
                                    {(group.schemeName[0] || "?").toUpperCase()}
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="text-white font-semibold text-sm truncate">
                                        {group.schemeName}
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        {group.fundHouse || "—"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                {groupBuys.length > 0 && (
                                    <div className="text-right">
                                        <p className="text-green-400 text-xs font-bold">
                                            {groupBuys.length} BUY
                                        </p>
                                        <p className="text-slate-500 text-[10px]">
                                            {fmt(groupBuys.reduce((s,t) => s + parseFloat(t.amount||0), 0))}
                                        </p>
                                    </div>
                                )}
                                {groupSells.length > 0 && (
                                    <div className="text-right">
                                        <p className="text-red-400 text-xs font-bold">
                                            {groupSells.length} SELL
                                        </p>
                                        <p className="text-slate-500 text-[10px]">
                                            {fmt(groupSells.reduce((s,t) => s + parseFloat(t.amount||0), 0))}
                                        </p>
                                    </div>
                                )}
                                <div className="text-right hidden md:block">
                                    <p className="text-slate-400 text-xs">Last</p>
                                    <p className="text-slate-300 text-xs font-semibold">
                                        {lastDate || "—"}
                                    </p>
                                </div>
                                <span className={`text-slate-500 text-xs transition-transform ${
                                    isOpen ? "rotate-180" : ""
                                }`}>▼</span>
                            </div>
                        </button>

                        {/* Transactions list */}
                        {isOpen && (
                            <div className="border-t border-slate-700/40">
                                {group.txns.map(tx => {
                                    const isBuy = isBuyType(tx.transactionType);
                                    return (
                                        <div key={tx.id}
                                             className="flex items-center justify-between
                                                        px-5 py-3 border-b border-slate-700/30
                                                        last:border-0 hover:bg-slate-700/20
                                                        transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <span className={
                                                    "text-xs font-bold px-2 py-1 rounded-lg " +
                                                    txTypeColor(tx.transactionType)
                                                }>
                                                    {tx.transactionType.replace(/_/g, " ")}
                                                </span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-white text-sm font-semibold">
                                                            {fmtUnits(tx.units)} units
                                                        </p>
                                                        <span className="text-slate-500 text-xs">@</span>
                                                        <p className="text-slate-300 text-sm">
                                                            ₹{parseFloat(tx.navAtTransaction||0).toFixed(4)}
                                                        </p>
                                                    </div>
                                                    <p className="text-slate-500 text-xs">
                                                        {tx.transactionDate || "—"}
                                                        {tx.notes && (
                                                            <span className="italic ml-2 text-slate-600">
                                                                · {tx.notes}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                <p className={
                                                    "font-bold text-sm " +
                                                    (isBuy ? "text-white" : "text-amber-300")
                                                }>
                                                    {fmt(tx.amount)}
                                                </p>
                                                <button
                                                    onClick={() => handleDelete(tx.id)}
                                                    className="opacity-0 group-hover:opacity-100
                                                               text-slate-500 hover:text-red-400
                                                               transition-all text-xs">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => load(page - 1)} disabled={page === 0}
                            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg
                                       text-sm disabled:opacity-40 hover:bg-slate-600">
                        ← Prev
                    </button>
                    <span className="text-slate-400 text-sm">
                        Page {page + 1} of {totalPages}
                    </span>
                    <button onClick={() => load(page + 1)} disabled={page >= totalPages - 1}
                            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg
                                       text-sm disabled:opacity-40 hover:bg-slate-600">
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

// ====================================================================
// SEARCH TAB
// ====================================================================
function MfSearchTab({ onTransact }) {
    const [query,        setQuery]        = useState("");
    const [results,      setResults]      = useState([]);
    const [loading,      setLoading]      = useState(false);
    const [searched,     setSearched]     = useState(false);
    const [detailScheme, setDetailScheme] = useState(null);
    const debounceRef = useRef(null);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); setSearched(false); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true); setSearched(true);
            try {
                const res = await searchMfSchemes(q);
                setResults(res.data.content || []);
            } catch { setResults([]); }
            finally { setLoading(false); }
        }, 400);
    };

    return (
        <>
            <div className="space-y-4">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                    <input type="text" value={query}
                           onChange={e => handleSearch(e.target.value)}
                           placeholder="Search by scheme name or fund house..."
                           className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                      px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                           autoFocus />
                    <p className="text-xs text-slate-500 mt-2">
                        Searching across 10,000+ AMFI registered schemes ·
                        Click any scheme to view NAV chart and returns
                    </p>
                </div>

                {loading && (
                    <div className="space-y-2">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse"/>
                        ))}
                    </div>
                )}

                {!loading && searched && results.length === 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                        <p className="text-slate-400">No schemes found for "{query}"</p>
                    </div>
                )}

                {!loading && results.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        {results.map(s => (
                            <button key={s.schemeCode} onClick={() => setDetailScheme(s)}
                                    className="w-full text-left px-4 py-3 border-b border-slate-700/50
                                               last:border-0 hover:bg-slate-700 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white text-sm font-medium
                                                      group-hover:text-blue-400 transition-colors">
                                            {s.schemeName}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            {s.fundHouse || "—"}
                                            {s.schemeCategory ? " · " + s.schemeCategory : ""}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        {s.nav ? (
                                            <>
                                                <p className="text-white text-sm font-medium">₹{s.nav}</p>
                                                <p className="text-slate-500 text-xs">{s.navDate || ""}</p>
                                            </>
                                        ) : (
                                            <p className="text-slate-500 text-xs">Click for details</p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {detailScheme && (
                <MfSchemeDetailModal
                    scheme={detailScheme}
                    onClose={() => setDetailScheme(null)}
                    onTransact={s => { setDetailScheme(null); onTransact(s); }}
                />
            )}
        </>
    );
}