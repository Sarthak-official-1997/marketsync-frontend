import { useState, useRef } from "react";
import { searchMfSchemes, addToMfWatchlist } from "../api/portfolio";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";
import { useToast } from "../context/ToastContext";
import { useMfMarket, POPULAR_MF } from "../context/MfMarketContext";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtPct = (v) => {
    if (v == null) return "—";
    const n = parseFloat(v);
    if (isNaN(n)) return "—";
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

// ── Extract a plain number from MfPeriodReturn object ──────────────────────
// DTO shape: { absoluteReturn: 12.5, annualizedReturn: null }
// We prefer annualizedReturn for periods > 1Y, else absoluteReturn
const extractReturn = (periodReturn, preferAnnualized = false) => {
    if (periodReturn == null) return null;
    if (typeof periodReturn === "number") return periodReturn; // defensive
    if (preferAnnualized && periodReturn.annualizedReturn != null)
        return parseFloat(periodReturn.annualizedReturn);
    return periodReturn.absoluteReturn != null
        ? parseFloat(periodReturn.absoluteReturn)
        : null;
};

const CATEGORIES = ["All", "Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "ELSS", "Index"];

const CAT_COLOR = {
    "Large Cap": "bg-blue-900/40 text-blue-300",
    "Mid Cap":   "bg-purple-900/40 text-purple-300",
    "Small Cap": "bg-orange-900/40 text-orange-300",
    "Flexi Cap": "bg-teal-900/40 text-teal-300",
    "ELSS":      "bg-green-900/40 text-green-300",
    "Index":     "bg-slate-700 text-slate-300",
};

export default function MfMarketPage() {
    const { navs, loading, refresh } = useMfMarket();

    const [filter,       setFilter]       = useState("All");
    const [query,        setQuery]        = useState("");
    const [results,      setResults]      = useState([]);
    const [searching,    setSearching]    = useState(false);
    const [detailScheme, setDetailScheme] = useState(null);
    const toast = useToast();
    const debounceRef = useRef(null);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); return; }
        setSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await searchMfSchemes(q);
                setResults(res.data.content || []);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 400);
    };

    const handleAddWatchlist = async (e, scheme) => {
        e.stopPropagation();
        try {
            await addToMfWatchlist({ schemeCode: scheme.schemeCode });
            toast.success((scheme.schemeName) + " added to watchlist");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to add to watchlist");
        }
    };

    const filtered = query.length < 2
        ? POPULAR_MF.filter(mf => filter === "All" || mf.cat === filter)
        : [];

    return (
        <>
            <div className="space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-white">MF Market</h1>
                        <p className="text-xs text-slate-500 mt-1">
                            NAV updated daily after 6 PM IST · AMFI data
                        </p>
                    </div>
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700
                                   hover:bg-slate-600 border border-slate-600
                                   text-slate-300 text-sm rounded-xl transition-colors
                                   disabled:opacity-50">
                        {loading
                            ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block"/>
                            : "↻"
                        } Refresh
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search any scheme — Axis, HDFC, Parag Parikh..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl
                                   px-4 py-3 text-white text-sm focus:outline-none
                                   focus:border-blue-500 placeholder:text-slate-500"
                    />
                    {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                        </div>
                    )}
                    {results.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-slate-800
                                        border border-slate-700 rounded-xl shadow-xl
                                        max-h-72 overflow-y-auto">
                            {results.map(s => (
                                <button
                                    key={s.schemeCode}
                                    onClick={() => {
                                        setDetailScheme({
                                            code: s.schemeCode, schemeCode: s.schemeCode,
                                            name: s.schemeName, schemeName: s.schemeName,
                                            house: s.fundHouse,  fundHouse: s.fundHouse,
                                            cat: s.schemeCategory,
                                        });
                                        setQuery(""); setResults([]);
                                    }}
                                    className="w-full text-left px-4 py-3 border-b
                                               border-slate-700/50 last:border-0
                                               hover:bg-slate-700 transition-colors">
                                    <p className="text-white text-sm font-medium">{s.schemeName}</p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        {s.fundHouse}{s.schemeCategory ? " · " + s.schemeCategory : ""}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Category filter chips */}
                <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setFilter(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold
                                           transition-colors ${
                                    filter === cat
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                                }`}>
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Fund cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(mf => {
                        const data    = navs[mf.code];
                        const isReady = !!data;

                        // ── Correct field names from MfNavHistoryDto ──────────────
                        // DTO: currentNav (BigDecimal), navDate (String),
                        //      returns (Map<String, MfPeriodReturn>)
                        // MfPeriodReturn: { absoluteReturn, annualizedReturn }
                        const nav     = isReady ? parseFloat(data.currentNav || 0) : null;
                        const navDate = isReady ? data.navDate : null;
                        const ret1Y   = isReady ? extractReturn(data.returns?.["1Y"],  true)  : null;
                        const ret6M   = isReady ? extractReturn(data.returns?.["6M"],  false) : null;
                        const ret3M   = isReady ? extractReturn(data.returns?.["3M"],  false) : null;

                        const positive = ret1Y != null ? ret1Y >= 0 : true;
                        const retColor = positive ? "text-green-400" : "text-red-400";
                        const retBg    = positive ? "bg-green-900/20" : "bg-red-900/20";

                        return (
                            <div
                                key={mf.code}
                                onClick={() => setDetailScheme({
                                    schemeCode:      mf.code,
                                    schemeName:      mf.name,
                                    fundHouse:       mf.house,
                                    schemeCategory:  mf.cat,
                                })}
                                className="bg-slate-800 border border-slate-700
                                           rounded-2xl p-4 cursor-pointer
                                           hover:border-slate-500 hover:bg-slate-700/60
                                           transition-all group">

                                {/* Top row */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold text-sm
                                                      leading-snug truncate pr-2
                                                      group-hover:text-blue-300 transition-colors">
                                            {mf.name}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-0.5">{mf.house}</p>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-1
                                                      rounded-lg flex-shrink-0 ${
                                        CAT_COLOR[mf.cat] || "bg-slate-700 text-slate-300"
                                    }`}>
                                        {mf.cat}
                                    </span>
                                </div>

                                {/* NAV row */}
                                {!isReady ? (
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-6 w-20 bg-slate-700 rounded animate-pulse"/>
                                        <div className="h-4 w-16 bg-slate-700 rounded animate-pulse"/>
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-2 mb-3">
                                        <p className="text-white text-xl font-bold">
                                            ₹{nav?.toFixed(2)}
                                        </p>
                                        {ret1Y != null && (
                                            <span className={`text-xs font-semibold px-2 py-0.5
                                                              rounded-lg mb-0.5 ${retColor} ${retBg}`}>
                                                {fmtPct(ret1Y)} 1Y
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Returns row */}
                                {!isReady ? (
                                    <div className="flex gap-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-8 flex-1 bg-slate-700 rounded animate-pulse"/>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        {[
                                            ["3M", ret3M, false],
                                            ["6M", ret6M, false],
                                            ["1Y", ret1Y, true],
                                        ].map(([label, val, annualized]) => {
                                            const pos = val != null ? val >= 0 : true;
                                            return (
                                                <div key={label}
                                                     className="flex-1 bg-slate-700/50 rounded-xl px-2 py-1.5 text-center">
                                                    <p className="text-slate-500 text-[10px]">{label}</p>
                                                    <p className={`text-xs font-bold mt-0.5 ${
                                                        val != null
                                                            ? (pos ? "text-green-400" : "text-red-400")
                                                            : "text-slate-500"
                                                    }`}>
                                                        {val != null ? fmtPct(val) : "—"}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-3 pt-3
                                                border-t border-slate-700/50">
                                    <p className="text-slate-600 text-[10px]">
                                        {navDate ? `NAV: ${navDate}` : "\u00a0"}
                                    </p>
                                    <button
                                        onClick={e => handleAddWatchlist(e, {
                                            schemeCode: mf.code,
                                            schemeName: mf.name
                                        })}
                                        className="text-[10px] text-slate-500 hover:text-yellow-400 transition-colors">
                                        + Watchlist
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {detailScheme && (
                <MfSchemeDetailModal
                    scheme={detailScheme}
                    onClose={() => setDetailScheme(null)}
                    onTransact={() => setDetailScheme(null)}
                />
            )}
        </>
    );
}