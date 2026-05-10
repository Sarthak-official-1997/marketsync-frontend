import { useState, useEffect } from "react";
import { searchMfSchemes, getMfNavHistory, addToMfWatchlist } from "../api/portfolio";
import MfSchemeDetailModal from "../components/MfSchemeDetailModal";
import { useToast } from "../context/ToastContext";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtPct = (v) => {
    if (v == null) return "—";
    const n = parseFloat(v);
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

// Most popular Indian MF schemes by category
const POPULAR_MF = [
    // Large Cap
    { code: "120503", name: "Mirae Asset Large Cap Fund",       house: "Mirae", cat: "Large Cap" },
    { code: "119551", name: "Axis Bluechip Fund",               house: "Axis",  cat: "Large Cap" },
    // Mid Cap
    { code: "118989", name: "HDFC Mid-Cap Opportunities Fund",  house: "HDFC",  cat: "Mid Cap"   },
    { code: "120843", name: "Nippon India Growth Fund",         house: "Nippon",cat: "Mid Cap"   },
    // Small Cap
    { code: "125354", name: "Nippon India Small Cap Fund",      house: "Nippon",cat: "Small Cap" },
    { code: "120828", name: "SBI Small Cap Fund",               house: "SBI",   cat: "Small Cap" },
    // Flexi Cap
    { code: "120716", name: "Parag Parikh Flexi Cap Fund",      house: "PPFAS", cat: "Flexi Cap" },
    { code: "118825", name: "HDFC Flexi Cap Fund",              house: "HDFC",  cat: "Flexi Cap" },
    // ELSS
    { code: "120586", name: "Mirae Asset ELSS Tax Saver Fund",  house: "Mirae", cat: "ELSS"      },
    { code: "119598", name: "Axis Long Term Equity Fund",       house: "Axis",  cat: "ELSS"      },
    // Index
    { code: "120625", name: "UTI Nifty 50 Index Fund",          house: "UTI",   cat: "Index"     },
    { code: "120841", name: "Nippon India Index Fund - Nifty",   house: "Nippon",cat: "Index"     },
];

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
    const [navs,         setNavs]         = useState({});
    const [loading,      setLoading]      = useState(true);
    const [filter,       setFilter]       = useState("All");
    const [query,        setQuery]        = useState("");
    const [results,      setResults]      = useState([]);
    const [searching,    setSearching]    = useState(false);
    const [detailScheme, setDetailScheme] = useState(null);
    const toast = useToast();

    useEffect(() => {
        const fetchNavs = async () => {
            setLoading(true);
            const fetched = {};
            // Fetch in parallel but limit to avoid hammering mfapi.in
            const chunks = [];
            for (let i = 0; i < POPULAR_MF.length; i += 4) {
                chunks.push(POPULAR_MF.slice(i, i + 4));
            }
            for (const chunk of chunks) {
                await Promise.allSettled(
                    chunk.map(async (mf) => {
                        try {
                            const res = await getMfNavHistory(mf.code, "1Y");
                            fetched[mf.code] = res.data;
                        } catch {}
                    })
                );
            }
            setNavs(fetched);
            setLoading(false);
        };
        fetchNavs();
    }, []);

    const handleSearch = async (q) => {
        setQuery(q);
        if (q.length < 2) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await searchMfSchemes(q);
            setResults(res.data.content || []);
        } catch { setResults([]); }
        finally { setSearching(false); }
    };

    const handleAddWatchlist = async (scheme) => {
        try {
            await addToMfWatchlist({ schemeCode: scheme.code || scheme.schemeCode });
            toast.success(scheme.name || scheme.schemeName + " added to watchlist");
        } catch (err) {
            toast.error(err.userMessage || "Failed to add");
        }
    };

    const filtered = filter === "All"
        ? POPULAR_MF
        : POPULAR_MF.filter(m => m.cat === filter);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        Mutual Fund Market
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        AMFI official NAV data · Click any card to view details
                    </p>
                </div>
                {/* Search */}
                <div className="relative w-72">
                    <input
                        type="text"
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search 10,000+ MF schemes..."
                        className="w-full bg-slate-800 border border-slate-700
                                   rounded-xl px-4 py-2.5 text-white text-sm
                                   focus:outline-none focus:border-blue-500 pr-10"
                    />
                    {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-400
                                            border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    {results.length > 0 && query.length >= 2 && (
                        <div className="absolute z-20 top-full mt-1 w-full
                                        bg-slate-800 border border-slate-700
                                        rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                            {results.map(s => (
                                <button
                                    key={s.schemeCode}
                                    onClick={() => {
                                        setDetailScheme(s);
                                        setQuery(""); setResults([]);
                                    }}
                                    className="w-full text-left px-4 py-3
                                               hover:bg-slate-700 border-b
                                               border-slate-700/50 last:border-0
                                               transition-colors"
                                >
                                    <p className="text-white text-sm font-medium">
                                        {s.schemeName}
                                    </p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        {s.fundHouse || "—"}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={
                            "px-3 py-1.5 rounded-xl text-xs font-semibold " +
                            "transition-colors " +
                            (filter === cat
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white " +
                                "border border-slate-700")
                        }
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* MF cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(mf => {
                    const data     = navs[mf.code];
                    const nav      = data?.currentNav;
                    const ret1Y    = data?.returns?.["1Y"];
                    const abs1Y    = ret1Y?.absoluteReturn ?? ret1Y;
                    const ret3Y    = data?.returns?.["3Y"];
                    const cagr3Y   = ret3Y?.annualizedReturn;
                    const isUp1Y   = parseFloat(abs1Y || 0) >= 0;
                    return (
                        <button
                            key={mf.code}
                            onClick={() => setDetailScheme({
                                schemeCode:     mf.code,
                                schemeName:     mf.name,
                                fundHouse:      mf.house,
                                schemeCategory: mf.cat,
                            })}
                            className="bg-slate-800 hover:bg-slate-700 border
                                       border-slate-700 hover:border-slate-600
                                       rounded-2xl p-5 text-left transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0 pr-3">
                                    <p className="text-white font-bold text-sm
                                                  leading-snug group-hover:text-blue-400
                                                  transition-colors truncate">
                                        {mf.name}
                                    </p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        {mf.house}
                                    </p>
                                </div>
                                <span className={
                                    "text-xs font-medium px-2 py-1 rounded-lg " +
                                    "flex-shrink-0 " +
                                    (CAT_COLOR[mf.cat] || "bg-slate-700 text-slate-300")
                                }>
                                    {mf.cat}
                                </span>
                            </div>

                            {loading ? (
                                <div className="space-y-2">
                                    <div className="h-6 w-24 bg-slate-700 rounded animate-pulse" />
                                    <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500">NAV</p>
                                            <p className="text-xl font-bold text-white">
                                                {nav ? fmt(nav) : "—"}
                                            </p>
                                        </div>
                                        {abs1Y != null && (
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">1Y Return</p>
                                                <p className={
                                                    "text-lg font-bold " +
                                                    (isUp1Y ? "text-green-400"
                                                        : "text-red-400")
                                                }>
                                                    {fmtPct(abs1Y)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {cagr3Y != null && (
                                        <p className="text-xs text-slate-500 mt-2">
                                            3Y CAGR:{" "}
                                            <span className={
                                                parseFloat(cagr3Y) >= 0
                                                    ? "text-green-400" : "text-red-400"
                                            }>
                                                {fmtPct(cagr3Y)}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {detailScheme && (
                <MfSchemeDetailModal
                    scheme={detailScheme}
                    onClose={() => setDetailScheme(null)}
                    onTransact={() => setDetailScheme(null)}
                />
            )}
        </div>
    );
}