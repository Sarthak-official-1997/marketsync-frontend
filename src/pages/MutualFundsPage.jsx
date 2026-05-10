import { useState, useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";

import {
    getMfHoldings,
    getMfPortfolioSummary,
    getMfTransactions,
    addMfTransaction,
    deleteMfTransaction,
    searchMfSchemes,
    getMfScheme,
    getMfNavOnDate,
} from "../api/portfolio";




// ====================================================================

// ====================================================================
const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(val || 0);

const fmtUnits = (val) => parseFloat(val || 0).toFixed(4);

const fmtPercent = (val) => {
    const n = parseFloat(val || 0);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

// ====================================================================
// MAIN PAGE
// ====================================================================

export default function MutualFundsPage() {
    const [activeTab, setActiveTab]           = useState("holdings");
    const [preselectedScheme, setPreselected] = useState(null);
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
            <div>
                <h1 className="text-2xl font-bold text-white">Mutual Funds</h1>
                <p className="text-xs text-slate-500 mt-1">
                    NAV updated daily after 6 PM IST via AMFI
                </p>
            </div>

            <MfSummaryBar />

            <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={
                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors " +
                            (activeTab === tab.id
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 hover:text-white")
                        }
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div>
                {activeTab === "holdings" && (
                    <MfHoldingsTab toast={toast} />
                )}
                {activeTab === "transact" && (
                    <MfTransactTab
                        toast={toast}
                        preselectedScheme={preselectedScheme}
                        onSuccess={() => {
                            setPreselected(null);
                            setActiveTab("holdings");
                        }}
                    />
                )}
                {activeTab === "transactions" && (
                    <MfHistoryTab toast={toast} />
                )}
                {activeTab === "search" && (
                    <MfSearchTab onTransact={handleTransactFromSearch} />
                )}
            </div>
        </div>
    );
}

// ====================================================================
// SUMMARY BAR
// ====================================================================

function MfSummaryBar() {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        getMfPortfolioSummary()
            .then((res) => setSummary(res.data))
            .catch((err) => toast.error(err.userMessage || "Failed to load"))
    }, []);

    if (!summary || summary.schemeCount === 0) return null;

    const pl    = parseFloat(summary.unrealizedPnl || 0);
    const plPct = parseFloat(summary.unrealizedPnlPercent || 0);
    const isPos = pl >= 0;
    const color = isPos ? "text-green-400" : "text-red-400";

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
                ["Schemes Held",   summary.schemeCount,        "text-white", false],
                ["Invested",       fmt(summary.totalInvested),  "text-white", false],
                ["Current Value",  fmt(summary.currentValue),   "text-white", false],
                ["Unrealized P&L", fmt(summary.unrealizedPnl),  color,        true ],
            ].map(([label, value, cls, showPct]) => (
                <div
                    key={label}
                    className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={"text-lg font-bold mt-1 " + cls}>{value}</p>
                    {showPct && (
                        <p className={"text-xs font-medium mt-0.5 " + color}>
                            {fmtPercent(plPct)}
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
    const [loading, setLoading]   = useState(true);

    const load = () => {
        setLoading(true);
        getMfHoldings()
            .then((res) => setHoldings(res.data))
            .catch((err) => toast.error(err.userMessage || "Failed to load MF holdings"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (holdings.length === 0) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-white font-semibold">No MF holdings yet</p>
                <p className="text-slate-400 text-sm mt-1">
                    Go to Transact tab to record your first investment
                </p>
            </div>
        );
    }

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
                    const isPos = pl >= 0;
                    const color = isPos ? "text-green-400" : "text-red-400";

                    return (
                        <tr
                            key={h.id}
                            className="border-b border-slate-700/50
                                           hover:bg-slate-700/30 transition-colors"
                        >
                            <td className="px-4 py-3 max-w-xs">
                                <p className="font-semibold text-white truncate"
                                   title={h.schemeName}>
                                    {h.schemeName}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                    {h.fundHouse}
                                    {h.schemeCategory ? " · " + h.schemeCategory : ""}
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    NAV as of {h.navDate || "—"}
                                </p>
                            </td>
                            <td className="text-right px-4 py-3 text-white">
                                {fmtUnits(h.units)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-300">
                                {fmt(h.avgCostNav)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-300">
                                {fmt(h.currentNav)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-300">
                                {fmt(h.totalInvested)}
                            </td>
                            <td className="text-right px-4 py-3 text-white font-medium">
                                {fmt(h.currentValue)}
                            </td>
                            <td className={"text-right px-4 py-3 font-medium " + color}>
                                {fmt(h.unrealizedPnl)}
                            </td>
                            <td className={"text-right px-4 py-3 font-medium " + color}>
                                {fmtPercent(plPct)}
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
}

// ====================================================================
// TRANSACT TAB
// ====================================================================

function MfTransactTab({ toast, onSuccess, preselectedScheme }) {
    const [schemeQuery, setSchemeQuery]       = useState("");
    const [schemeResults, setSchemeResults]   = useState([]);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [form, setForm] = useState({
        transactionType:  "PURCHASE",
        transactionDate:  new Date().toISOString().split("T")[0],
        nav:              "",
        amount:           "",
        units:            "",
        notes:            "",
    });
    const [navLoading, setNavLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const debounceRef = useRef(null);

    const txTypes = [
        { value: "PURCHASE",              label: "Purchase (Lump Sum)"   },
        { value: "SIP",                   label: "SIP (Monthly)"         },
        { value: "REDEMPTION",            label: "Redemption (Sell)"     },
        { value: "SWITCH_IN",             label: "Switch In"             },
        { value: "SWITCH_OUT",            label: "Switch Out"            },
        { value: "DIVIDEND_REINVESTMENT", label: "Dividend Reinvestment" },
    ];

    // Pre-fill when coming from Search tab
    useEffect(() => {
        if (preselectedScheme) {
            setSelectedScheme(preselectedScheme);
            setSchemeQuery(preselectedScheme.schemeName);
            if (preselectedScheme.nav) {
                setForm((f) => ({ ...f, nav: preselectedScheme.nav.toString() }));
            }
        }
    }, [preselectedScheme]);

    // When date changes, auto-fetch NAV for that date
    useEffect(() => {
        if (!selectedScheme || !form.transactionDate) return;
        fetchNavForDate(selectedScheme.schemeCode, form.transactionDate);
    }, [form.transactionDate, selectedScheme?.schemeCode]);

    const fetchNavForDate = async (schemeCode, date) => {
        setNavLoading(true);
        try {
            const res = await getMfNavOnDate(schemeCode, date);
            const nav = res.data.nav.toString();
            setForm((f) => {
                const newForm = { ...f, nav };
                // Recalculate units if amount already entered
                if (f.amount && parseFloat(f.amount) > 0 && parseFloat(nav) > 0) {
                    newForm.units = (parseFloat(f.amount) / parseFloat(nav)).toFixed(4);
                }
                return newForm;
            });
        } catch {
            // If date lookup fails, clear NAV and let user enter manually
            setForm((f) => ({ ...f, nav: "" }));
        } finally {
            setNavLoading(false);
        }
    };

    // When amount changes, auto-calculate units
    const handleAmountChange = (value) => {
        setForm((f) => {
            const nav   = parseFloat(f.nav);
            const amount = parseFloat(value);
            const units = nav > 0 && amount > 0
                ? (amount / nav).toFixed(4)
                : f.units;
            return { ...f, amount: value, units };
        });
    };

    // When units change manually, auto-calculate amount
    const handleUnitsChange = (value) => {
        setForm((f) => {
            const nav   = parseFloat(f.nav);
            const units = parseFloat(value);
            const amount = nav > 0 && units > 0
                ? (units * nav).toFixed(2)
                : f.amount;
            return { ...f, units: value, amount };
        });
    };

    // When NAV changes, recalculate units from amount
    const handleNavChange = (value) => {
        setForm((f) => {
            const nav    = parseFloat(value);
            const amount = parseFloat(f.amount);
            const units  = nav > 0 && amount > 0
                ? (amount / nav).toFixed(4)
                : f.units;
            return { ...f, nav: value, units };
        });
    };

    const handleSchemeSearch = (q) => {
        setSchemeQuery(q);
        setSelectedScheme(null);
        setForm((f) => ({ ...f, nav: "", amount: "", units: "" }));
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setSchemeResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await searchMfSchemes(q);
                setSchemeResults(res.data.content || []);
            } catch {
                setSchemeResults([]);
            }
        }, 300);
    };

    const handleSchemeSelect = (scheme) => {
        setSelectedScheme(scheme);
        setSchemeQuery(scheme.schemeName);
        setSchemeResults([]);
        setForm((f) => ({ ...f, nav: "", amount: "", units: "" }));
        // Trigger NAV fetch for current date
        fetchNavForDate(scheme.schemeCode, form.transactionDate);
    };

    const handleSubmit = async () => {
        if (!selectedScheme)     { toast.error("Please select a scheme");  return; }
        if (!form.nav)           { toast.error("NAV is required");         return; }
        if (!form.amount && !form.units) {
            toast.error("Enter either amount or units");
            return;
        }

        const nav    = parseFloat(form.nav);
        const amount = form.amount
            ? parseFloat(form.amount)
            : parseFloat(form.units) * nav;
        const units  = form.units
            ? parseFloat(form.units)
            : amount / nav;

        if (units <= 0 || nav <= 0) {
            toast.error("Invalid units or NAV value");
            return;
        }

        setSubmitting(true);
        try {
            await addMfTransaction({
                schemeCode:       selectedScheme.schemeCode,
                transactionType:  form.transactionType,
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

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-2xl space-y-5">
            <h2 className="text-white font-semibold text-lg">Record MF Transaction</h2>

            {/* Scheme search */}
            <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                    Scheme *
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={schemeQuery}
                        onChange={(e) => handleSchemeSearch(e.target.value)}
                        placeholder="Search scheme name e.g. HDFC Mid Cap"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-3 py-2.5 text-white text-sm focus:outline-none
                                   focus:border-blue-500"
                    />
                    {schemeResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700
                                        border border-slate-600 rounded-xl shadow-xl
                                        max-h-56 overflow-y-auto">
                            {schemeResults.map((s) => (
                                <button
                                    key={s.schemeCode}
                                    type="button"
                                    onClick={() => handleSchemeSelect(s)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-600
                                               border-b border-slate-600/50 last:border-0"
                                >
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

            {/* Transaction type */}
            <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                    Transaction Type *
                </label>
                <select
                    value={form.transactionType}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, transactionType: e.target.value }))
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg
                               px-3 py-2.5 text-white text-sm focus:outline-none
                               focus:border-blue-500"
                >
                    {txTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* Date — primary field, triggers NAV fetch */}
            <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                    Transaction Date *
                </label>
                <input
                    type="date"
                    value={form.transactionDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, transactionDate: e.target.value }))
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg
                               px-3 py-2.5 text-white text-sm focus:outline-none
                               focus:border-blue-500"
                />
                {selectedScheme && (
                    <p className="text-xs text-slate-500 mt-1">
                        NAV will be auto-fetched for this date
                    </p>
                )}
            </div>

            {/* NAV — auto-filled, editable */}
            <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                    NAV on Transaction Date *
                </label>
                <div className="relative">
                    <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={form.nav}
                        onChange={(e) => handleNavChange(e.target.value)}
                        placeholder={navLoading ? "Fetching NAV..." : "e.g. 123.45"}
                        disabled={navLoading}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-3 py-2.5 text-white text-sm focus:outline-none
                                   focus:border-blue-500 disabled:opacity-60"
                    />
                    {navLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-400
                                            border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Auto-fetched from AMFI · You can edit if needed
                </p>
            </div>

            {/* Amount + Units — linked, either can drive the other */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                        Amount (₹)
                    </label>
                    <input
                        type="number"
                        step="1"
                        min="1"
                        value={form.amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-3 py-2.5 text-white text-sm focus:outline-none
                                   focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Enter amount → units auto-calculated
                    </p>
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                        Units
                    </label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={form.units}
                        onChange={(e) => handleUnitsChange(e.target.value)}
                        placeholder="e.g. 40.5678"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-3 py-2.5 text-white text-sm focus:outline-none
                                   focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Or enter units → amount auto-calculated
                    </p>
                </div>
            </div>

            {/* Summary preview */}
            {form.nav && (form.amount || form.units) && (
                <div className="bg-slate-700/50 rounded-lg px-4 py-3 space-y-1.5">
                    {[
                        ["NAV",    "₹" + parseFloat(form.nav).toFixed(4)],
                        ["Units",  form.units ? parseFloat(form.units).toFixed(4) : "—"],
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
                <input
                    type="text"
                    value={form.notes}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="e.g. Monthly SIP — May 2026"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg
                               px-3 py-2.5 text-white text-sm focus:outline-none
                               focus:border-blue-500"
                />
            </div>

            <button
                onClick={handleSubmit}
                disabled={submitting || navLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                           text-white font-semibold py-3 rounded-xl transition-colors"
            >
                {submitting ? "Recording..." : "Record Transaction"}
            </button>
        </div>
    );
}

// ====================================================================
// HISTORY TAB
// ====================================================================

function MfHistoryTab({ toast }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [page, setPage]                 = useState(0);
    const [totalPages, setTotalPages]     = useState(0);

    const load = (p = 0) => {
        setLoading(true);
        getMfTransactions(p)
            .then((res) => {
                setTransactions(res.data.content || []);
                setTotalPages(res.data.totalPages || 0);
                setPage(p);
            })
            .catch((err) => toast.error(err.userMessage || "Failed to load transactions"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction? Holdings will be recalculated."))
            return;
        try {
            await deleteMfTransaction(id);
            toast.success("Transaction deleted");
            load(page);
        } catch {
            toast.error("Failed to delete transaction");
        }
    };

    const txTypeColor = (type) => {
        if (["PURCHASE", "SIP", "SWITCH_IN", "DIVIDEND_REINVESTMENT"].includes(type)) {
            return "text-green-400 bg-green-900/20";
        }
        return "text-red-400 bg-red-900/20";
    };

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <p className="text-4xl mb-3">🕐</p>
                <p className="text-white font-semibold">No transactions yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                        <th className="text-left px-4 py-3">Scheme</th>
                        <th className="text-left px-4 py-3">Type</th>
                        <th className="text-right px-4 py-3">Units</th>
                        <th className="text-right px-4 py-3">NAV</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-right px-4 py-3">Date</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {transactions.map((tx) => (
                        <tr
                            key={tx.id}
                            className="border-b border-slate-700/50
                                           hover:bg-slate-700/30 transition-colors"
                        >
                            <td className="px-4 py-3 max-w-xs">
                                <p className="text-white text-xs font-medium truncate"
                                   title={tx.schemeName}>
                                    {tx.schemeName}
                                </p>
                                <p className="text-slate-500 text-xs">{tx.fundHouse}</p>
                            </td>
                            <td className="px-4 py-3">
                                    <span className={
                                        "text-xs px-2 py-1 rounded font-medium " +
                                        txTypeColor(tx.transactionType)
                                    }>
                                        {tx.transactionType.replace("_", " ")}
                                    </span>
                            </td>
                            <td className="text-right px-4 py-3 text-white">
                                {fmtUnits(tx.units)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-300">
                                {fmt(tx.navAtTransaction)}
                            </td>
                            <td className="text-right px-4 py-3 text-white font-medium">
                                {fmt(tx.amount)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-400">
                                {tx.transactionDate}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    onClick={() => handleDelete(tx.id)}
                                    className="text-slate-500 hover:text-red-400
                                                   transition-colors text-xs"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => load(page - 1)}
                        disabled={page === 0}
                        className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg
                                   text-sm disabled:opacity-40 hover:bg-slate-600"
                    >
                        ← Prev
                    </button>
                    <span className="text-slate-400 text-sm">
                        Page {page + 1} of {totalPages}
                    </span>
                    <button
                        onClick={() => load(page + 1)}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg
                                   text-sm disabled:opacity-40 hover:bg-slate-600"
                    >
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
    const [query, setQuery]                 = useState("");
    const [results, setResults]             = useState([]);
    const [loading, setLoading]             = useState(false);
    const [searched, setSearched]           = useState(false);
    const [detailScheme, setDetailScheme]   = useState(null);
    const debounceRef = useRef(null);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); setSearched(false); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            setSearched(true);
            try {
                const res = await searchMfSchemes(q);
                setResults(res.data.content || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 400);
    };

    return (
        <>
            <div className="space-y-4">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search by scheme name or fund house..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                   px-4 py-3 text-white focus:outline-none
                                   focus:border-blue-500"
                        autoFocus
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        Searching across 10,000+ AMFI registered schemes ·
                        Click any scheme to view NAV chart and returns
                    </p>
                </div>

                {loading && (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i}
                                 className="h-16 bg-slate-800 rounded-xl animate-pulse" />
                        ))}
                    </div>
                )}

                {!loading && searched && results.length === 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700
                                    p-8 text-center">
                        <p className="text-slate-400">No schemes found for "{query}"</p>
                    </div>
                )}

                {!loading && results.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700
                                    overflow-hidden">
                        {results.map(s => (
                            <button
                                key={s.schemeCode}
                                onClick={() => setDetailScheme(s)}
                                className="w-full text-left px-4 py-3 border-b
                                           border-slate-700/50 last:border-0
                                           hover:bg-slate-700 transition-colors group"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white text-sm font-medium
                                                      group-hover:text-blue-400
                                                      transition-colors">
                                            {s.schemeName}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            {s.fundHouse || "—"}
                                            {s.schemeCategory
                                                ? " · " + s.schemeCategory
                                                : ""}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        {s.nav ? (
                                            <>
                                                <p className="text-white text-sm font-medium">
                                                    ₹{s.nav}
                                                </p>
                                                <p className="text-slate-500 text-xs">
                                                    {s.navDate || ""}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-slate-500 text-xs">
                                                Click for details
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail modal */}
            {detailScheme && (
                <MfSchemeDetailModal
                    scheme={detailScheme}
                    onClose={() => setDetailScheme(null)}
                    onTransact={(s) => {
                        setDetailScheme(null);
                        onTransact(s);
                    }}
                />
            )}
        </>
    );
}