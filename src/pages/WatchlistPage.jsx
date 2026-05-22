import { useState, useEffect, useRef } from "react";
import {
    getWatchlist, addToWatchlist, removeFromWatchlist, searchStocks,
    getMfWatchlist, addToMfWatchlist, removeFromMfWatchlist, searchMfSchemes,
} from "../api/portfolio";
import StockTransactionPanel from "../components/StockTransactionPanel";
import StockQuickMenu   from "../components/StockQuickMenu";
import StockDetailModal from "../components/StockDetailModal";
import MfTransactionPanel    from "../components/MfTransactionPanel";
import { useToast } from "../context/ToastContext";
import DayChangeBadge from "../components/DayChangeBadge";
import StockLogo      from "../components/StockLogo";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2,
    }).format(val || 0);

const fmtDate = (d) => {
    if (!d) return "—";
    try { const [y,m,day] = d.toString().split("T")[0].split("-"); return `${day}/${m}/${y}`; }
    catch { return d; }
};

export default function WatchlistPage(props) {
    const [superTab, setSuperTab] = useState(props.defaultTab || "stocks");
    const toast = useToast();
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white">Watchlist</h1>
                <p className="text-xs text-slate-500 mt-1">Click any name to view and add transactions</p>
            </div>
            <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit">
                {[{id:"stocks",label:"📈 Stocks"},{id:"mf",label:"📊 Mutual Funds"}].map(t => (
                    <button key={t.id} onClick={() => setSuperTab(t.id)}
                            className={"px-5 py-2 rounded-lg text-sm font-medium transition-colors " +
                            (superTab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}>
                        {t.label}
                    </button>
                ))}
            </div>
            {superTab === "stocks" && <StocksWatchlist toast={toast} />}
            {superTab === "mf"     && <MfWatchlist     toast={toast} />}
        </div>
    );
}

function StocksWatchlist({ toast }) {
    const [watchlist,    setWatchlist]   = useState(null);
    const [loading,      setLoading]     = useState(true);
    const [searchOpen,   setSearchOpen]  = useState(false);
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [activeStock,  setActiveStock] = useState(null);
    const [quickMenuStock, setQuickMenuStock] = useState(null);
    const [chartStock,     setChartStock]     = useState(null);
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);

    const load = () => {
        getWatchlist().then(res => setWatchlist(res.data)).catch(() => toast.error("Failed to load watchlist")).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
        else { setQuery(""); setResults([]); }
    }, [searchOpen]);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try { const res = await searchStocks(q); setResults(res.data.content || []); }
            catch { setResults([]); }
        }, 300);
    };

    const handleAdd = async (stock) => {
        setSearchOpen(false);
        try { await addToWatchlist({ stockId: stock.id }); toast.success(stock.symbol + " added to watchlist"); load(); }
        catch (err) { toast.error(err.userMessage || "Failed to add stock"); }
    };

    const handleRemove = async (item) => {
        try { await removeFromWatchlist(item.id); toast.success(item.stock.symbol + " removed"); load(); }
        catch { toast.error("Failed to remove"); }
    };

    const items = watchlist?.items || [];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{items.length} stock{items.length !== 1 ? "s" : ""} watched</p>
                <button onClick={() => setSearchOpen(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    <span className="text-lg leading-none">+</span> Add Stock
                </button>
            </div>

            {searchOpen && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <div className="relative">
                        <input ref={inputRef} type="text" value={query} onChange={e => handleSearch(e.target.value)}
                               placeholder="Search symbol or company name..."
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 pr-10" />
                        <button onClick={() => setSearchOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">✕</button>
                    </div>
                    {results.length > 0 && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                            {results.map(s => (
                                <button key={s.id} type="button" onClick={() => handleAdd(s)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold text-white text-sm">{s.symbol}</span>
                                        <span className="text-slate-400 text-xs ml-2">{s.name}</span>
                                    </div>
                                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">{s.exchange}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && results.length === 0 && (
                        <p className="text-slate-400 text-sm text-center py-3">No results for "{query}"</p>
                    )}
                </div>
            )}

            {loading ? (
                <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : items.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <p className="text-4xl mb-3">👁</p>
                    <p className="text-white font-semibold">No stocks watched yet</p>
                    <p className="text-slate-400 text-sm mt-1 mb-4">Click + Add Stock to start watching</p>
                    <button onClick={() => setSearchOpen(true)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                        + Add Stock
                    </button>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                            <th className="text-left px-5 py-3">Stock</th>
                            <th className="text-right px-5 py-3">Price</th>
                            <th className="text-right px-5 py-3">Change</th>
                            <th className="text-left px-5 py-3">Exchange</th>
                            <th className="text-left px-5 py-3">Added On</th>
                            <th className="text-right px-5 py-3">Since Added</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map(item => {
                            const chg = parseFloat(item.currentPrice?.changePercent || 0);
                            const color = chg >= 0 ? "text-green-400" : "text-red-400";
                            return (
                                <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                    <td className="px-5 py-3">
                                        <button onClick={() => setQuickMenuStock(item.stock)}
                                                className="text-left group flex items-center gap-2.5">
                                            <StockLogo symbol={item.stock.symbol} name={item.stock.name} size={34} />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white group-hover:text-blue-400
                                                                  transition-colors text-sm">{item.stock.symbol}</p>
                                                    {item.quantityHeld > 0 && (
                                                        <span className="text-xs bg-blue-900/30 text-blue-400
                                                                         border border-blue-500/20 px-1.5 py-0.5
                                                                         rounded-lg font-medium">
                                                            {parseFloat(item.quantityHeld).toFixed(2)} held
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 truncate max-w-[160px]">
                                                    {item.stock.name}
                                                </p>
                                            </div>
                                        </button>
                                    </td>
                                    <td className="text-right px-5 py-3 text-white font-semibold">
                                        {item.currentPrice ? fmt(item.currentPrice.currentPrice) : "—"}
                                    </td>
                                    <td className="text-right px-5 py-3">
                                        <DayChangeBadge
                                            change={item.currentPrice?.change}
                                            changePercent={item.currentPrice?.changePercent}
                                            showPrice={true}
                                        />
                                    </td>
                                    <td className="px-5 py-3 text-slate-400 text-xs">{item.stock.exchange}</td>
                                    <td className="px-5 py-3 text-slate-500 text-xs">
                                        {item.addedAt ? fmtDate(item.addedAt.split("T")[0]) : "—"}
                                    </td>
                                    {/* Gain since watchlisted */}
                                    <td className="px-5 py-3 text-right">
                                        {item.gainPctSinceAdded != null ? (
                                            <div>
                                                <p className={"text-xs font-bold " +
                                                (parseFloat(item.gainPctSinceAdded) >= 0 ? "text-green-400" : "text-red-400")}>
                                                    {parseFloat(item.gainPctSinceAdded) >= 0 ? "+" : ""}
                                                    {parseFloat(item.gainPctSinceAdded).toFixed(2)}%
                                                </p>
                                                <p className="text-slate-600 text-xs">if bought</p>
                                            </div>
                                        ) : (
                                            <span className="text-slate-700 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button onClick={() => handleRemove(item)}
                                                className="text-slate-500 hover:text-red-400 transition-colors text-xs hover:underline">
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {quickMenuStock && (
                <StockQuickMenu
                    stock={quickMenuStock}
                    onClose={() => setQuickMenuStock(null)}
                    onViewChart={() => setChartStock(quickMenuStock)}
                    onTransact={() => setActiveStock(quickMenuStock)}
                />
            )}
            {chartStock && (
                <StockDetailModal
                    stock={chartStock}
                    onClose={() => setChartStock(null)}
                />
            )}
            {activeStock && (
                <StockTransactionPanel stock={activeStock}
                                       onClose={() => setActiveStock(null)}
                                       onChanged={() => {}} />
            )}
        </div>
    );
}

function MfWatchlist({ toast }) {
    const [items,        setItems]       = useState([]);
    const [loading,      setLoading]     = useState(true);
    const [searchOpen,   setSearchOpen]  = useState(false);
    const [query,        setQuery]       = useState("");
    const [results,      setResults]     = useState([]);
    const [activeMf,     setActiveMf]    = useState(null);
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);

    const load = () => {
        getMfWatchlist().then(res => setItems(res.data || [])).catch(() => toast.error("Failed to load MF watchlist")).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
        else { setQuery(""); setResults([]); }
    }, [searchOpen]);

    const handleSearch = (q) => {
        setQuery(q);
        clearTimeout(debounceRef.current);
        if (q.length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            try { const res = await searchMfSchemes(q); setResults(res.data.content || []); }
            catch { setResults([]); }
        }, 300);
    };

    const handleAdd = async (scheme) => {
        setSearchOpen(false);
        try { await addToMfWatchlist({ schemeCode: scheme.schemeCode }); toast.success(scheme.schemeName + " added to watchlist"); load(); }
        catch (err) { toast.error(err.userMessage || "Already in watchlist"); }
    };

    const handleRemove = async (item) => {
        try { await removeFromMfWatchlist(item.id); toast.success("Removed from MF watchlist"); load(); }
        catch { toast.error("Failed to remove"); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{items.length} scheme{items.length !== 1 ? "s" : ""} watched</p>
                <button onClick={() => setSearchOpen(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    <span className="text-lg leading-none">+</span> Add Fund
                </button>
            </div>

            {searchOpen && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <div className="relative">
                        <input ref={inputRef} type="text" value={query} onChange={e => handleSearch(e.target.value)}
                               placeholder="Search fund name e.g. HDFC Mid Cap, Mirae..."
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 pr-10" />
                        <button onClick={() => setSearchOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">✕</button>
                    </div>
                    {results.length > 0 && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                            {results.map(s => (
                                <button key={s.schemeCode} type="button" onClick={() => handleAdd(s)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors">
                                    <p className="font-medium text-white text-sm">{s.schemeName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-slate-400 text-xs">{s.fundHouse || "—"}</span>
                                        {s.nav && <span className="text-slate-500 text-xs">NAV ₹{s.nav}</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && results.length === 0 && (
                        <p className="text-slate-400 text-sm text-center py-3">No results for "{query}"</p>
                    )}
                </div>
            )}

            {loading ? (
                <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : items.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-white font-semibold">No MF schemes watched yet</p>
                    <p className="text-slate-400 text-sm mt-1 mb-4">Click + Add Fund to start watching</p>
                    <button onClick={() => setSearchOpen(true)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                        + Add Fund
                    </button>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                            <th className="text-left px-5 py-3">Scheme</th>
                            <th className="text-left px-5 py-3">Category</th>
                            <th className="text-right px-5 py-3">Latest NAV</th>
                            <th className="text-right px-5 py-3">NAV Date</th>
                            <th className="text-left px-5 py-3">Added On</th>
                            <th className="text-right px-5 py-3">Since Added</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map(item => (
                            <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                <td className="px-5 py-3">
                                    <button onClick={() => setActiveMf({ schemeCode: item.schemeCode, schemeName: item.schemeName, fundHouse: item.fundHouse, nav: item.nav })}
                                            className="text-left group">
                                        <p className="font-semibold text-white group-hover:text-blue-400 transition-colors text-xs max-w-xs truncate" title={item.schemeName}>{item.schemeName}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{item.fundHouse || "—"}</p>
                                    </button>
                                </td>
                                <td className="px-5 py-3 text-slate-400 text-xs">{item.schemeCategory || "—"}</td>
                                <td className="text-right px-5 py-3 text-white font-semibold">{item.nav ? "₹" + item.nav : "—"}</td>
                                <td className="text-right px-5 py-3 text-slate-400 text-xs">{fmtDate(item.navDate)}</td>
                                <td className="px-5 py-3 text-slate-500 text-xs">
                                    {item.addedAt ? fmtDate(item.addedAt.toString().split("T")[0]) : "—"}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button onClick={() => handleRemove(item)}
                                            className="text-slate-500 hover:text-red-400 transition-colors text-xs hover:underline">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeMf && (
                <MfTransactionPanel scheme={activeMf}
                                    onClose={() => setActiveMf(null)}
                                    onChanged={() => {}} />
            )}
        </div>
    );
}