import { useState, useEffect } from "react";
import { getHoldings, getMfHoldings } from "../api/portfolio";
import { SkeletonTable } from "../components/Skeleton";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import QuickTradeModal from "../components/QuickTradeModal";
import StockDetailModal from "../components/StockDetailModal";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(val || 0);

const fmtUnits = (val) => parseFloat(val || 0).toFixed(4);

// ====================================================================
// MAIN PAGE
// ====================================================================

export default function HoldingsPage() {
    const [holdings, setHoldings]         = useState([]);
    const [mfHoldings, setMfHoldings]     = useState([]);
    const [loading, setLoading]           = useState(true);
    const [refreshing, setRefreshing]     = useState(false);
    const [error, setError]               = useState("");
    const [view, setView]                 = useState("stocks");
    const [tradeHolding, setTradeHolding] = useState(null);
    const [tradeType, setTradeType]       = useState("BUY");
    const [chartStock, setChartStock]     = useState(null);
    const toast    = useToast();
    const navigate = useNavigate();

    const loadHoldings = (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        Promise.all([getHoldings(), getMfHoldings()])
            .then(([stockRes, mfRes]) => {
                setHoldings(stockRes.data);
                setMfHoldings(mfRes.data);
            })
            .catch((err) => toast.error(err.userMessage || "Failed to load holdings"))
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => { loadHoldings(); }, []);

    const handleRefresh = () => {
        loadHoldings(true);
        toast.info("Holdings refreshed");
    };

    const openTrade = (h, type) => {
        setTradeHolding(h);
        setTradeType(type);
    };

    if (loading) return <SkeletonTable rows={5} cols={8} />;
    if (error)   return <ErrorMessage message={error} />;

    const views = [
        { id: "stocks",   label: "📈 Stocks"   },
        { id: "mf",       label: "📊 MF"        },
        { id: "combined", label: "⊞ Combined"  },
    ];

    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Holdings</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        💡 Click any stock symbol to open the TradingView chart
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                        {views.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setView(v.id)}
                                className={
                                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " +
                                    (view === v.id
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-white")
                                }
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                    {/* Refresh */}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="text-slate-400 hover:text-white transition-colors p-2
                                   rounded-lg hover:bg-slate-700 disabled:opacity-40"
                        title="Refresh holdings"
                    >
                        <span className={refreshing ? "animate-spin inline-block" : ""}>
                            🔄
                        </span>
                    </button>
                </div>
            </div>

            {/* Views */}
            {view === "stocks" && (
                <StockHoldingsTable
                    holdings={holdings}
                    onChartStock={setChartStock}
                    onTrade={openTrade}
                    onNavigate={() => navigate("/transactions")}
                />
            )}

            {view === "mf" && (
                <MfHoldingsTable mfHoldings={mfHoldings} />
            )}

            {view === "combined" && (
                <CombinedHoldingsTable
                    holdings={holdings}
                    mfHoldings={mfHoldings}
                    onChartStock={setChartStock}
                    onTrade={openTrade}
                />
            )}

            {/* Modals */}
            <QuickTradeModal
                holding={tradeHolding}
                defaultType={tradeType}
                onClose={() => setTradeHolding(null)}
                onDone={() => loadHoldings(true)}
            />

            <StockDetailModal
                stock={chartStock}
                onClose={() => setChartStock(null)}
            />
        </div>
    );
}

// ====================================================================
// STOCKS HOLDINGS TABLE
// ====================================================================

function StockHoldingsTable({ holdings, onChartStock, onTrade, onNavigate }) {
    if (holdings.length === 0) {
        return (
            <EmptyState
                icon="💼"
                title="No stock holdings yet"
                message="Record your first BUY transaction to start tracking."
                action="+ Record a Transaction"
                onAction={onNavigate}
            />
        );
    }

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Stock</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Avg Buy</th>
                    <th className="text-right px-4 py-3">Current</th>
                    <th className="text-right px-4 py-3">Value</th>
                    <th className="text-right px-4 py-3">P&amp;L</th>
                    <th className="text-right px-4 py-3">P&amp;L %</th>
                    <th className="px-4 py-3"></th>
                </tr>
                </thead>
                <tbody>
                {holdings.map(h => {
                    const pl    = parseFloat(h.unrealizedPL || 0);
                    const plPct = parseFloat(h.unrealizedPLPercent || 0);
                    const isPos = pl >= 0;
                    const color = isPos ? "text-green-400" : "text-red-400";

                    return (
                        <tr
                            key={h.id}
                            className="border-b border-slate-700/50
                                           hover:bg-slate-700/30 transition-colors"
                        >
                            <td className="px-4 py-3">
                                <button
                                    onClick={() => onChartStock(h.stock)}
                                    className="text-left group"
                                >
                                    <p className="font-semibold text-white
                                                      group-hover:text-blue-400 transition-colors">
                                        {h.stock.symbol}
                                    </p>
                                    <p className="text-xs text-slate-400">{h.stock.name}</p>
                                </button>
                            </td>
                            <td className="text-right px-4 py-3 text-white">
                                {parseFloat(h.quantity).toFixed(2)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-300">
                                {fmt(h.averageBuyPrice)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-300">
                                {fmt(h.currentPrice)}
                            </td>
                            <td className="text-right px-4 py-3 text-white">
                                {fmt(h.currentValue)}
                            </td>
                            <td className={"text-right px-4 py-3 font-medium " + color}>
                                {fmt(h.unrealizedPL)}
                            </td>
                            <td className={"text-right px-4 py-3 font-medium " + color}>
                                {isPos ? "+" : ""}{plPct.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex gap-1.5 justify-end">
                                    <button
                                        onClick={() => onTrade(h, "BUY")}
                                        className="text-xs px-2.5 py-1 bg-green-800/50
                                                       text-green-400 hover:bg-green-700/50
                                                       rounded transition-colors font-medium"
                                    >
                                        BUY
                                    </button>
                                    <button
                                        onClick={() => onTrade(h, "SELL")}
                                        className="text-xs px-2.5 py-1 bg-red-800/50
                                                       text-red-400 hover:bg-red-700/50
                                                       rounded transition-colors font-medium"
                                    >
                                        SELL
                                    </button>
                                </div>
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
// MF HOLDINGS TABLE
// ====================================================================

function MfHoldingsTable({ mfHoldings }) {
    if (mfHoldings.length === 0) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-white font-semibold">No MF holdings yet</p>
                <p className="text-slate-400 text-sm mt-1">
                    Go to Mutual Funds → Transact to record your first investment
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
                {mfHoldings.map(h => {
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
                                {isPos ? "+" : ""}{plPct.toFixed(2)}%
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
// COMBINED HOLDINGS TABLE
// ====================================================================

function CombinedHoldingsTable({ holdings, mfHoldings, onChartStock, onTrade }) {
    const stockRows = holdings.map(h => ({
        type:     "STOCK",
        name:     h.stock.symbol,
        subName:  h.stock.name,
        invested: parseFloat(h.totalInvested  || 0),
        value:    parseFloat(h.currentValue   || 0),
        pl:       parseFloat(h.unrealizedPL   || 0),
        plPct:    parseFloat(h.unrealizedPLPercent || 0),
        raw:      h,
    }));

    const mfRows = mfHoldings.map(h => ({
        type:     "MF",
        name:     h.schemeName,
        subName:  h.fundHouse,
        invested: parseFloat(h.totalInvested     || 0),
        value:    parseFloat(h.currentValue      || 0),
        pl:       parseFloat(h.unrealizedPnl     || 0),
        plPct:    parseFloat(h.unrealizedPnlPercent || 0),
        raw:      h,
    }));

    const combined = [...stockRows, ...mfRows]
        .sort((a, b) => b.value - a.value);

    const totalInvested = combined.reduce((s, r) => s + r.invested, 0);
    const totalValue    = combined.reduce((s, r) => s + r.value,    0);
    const totalPL       = totalValue - totalInvested;
    const totalPLPct    = totalInvested > 0
        ? ((totalPL / totalInvested) * 100).toFixed(2)
        : "0.00";
    const isPLPos = totalPL >= 0;

    if (combined.length === 0) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <p className="text-4xl mb-3">⊞</p>
                <p className="text-white font-semibold">No holdings yet</p>
                <p className="text-slate-400 text-sm mt-1">
                    Add stocks or mutual funds to see them here combined
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Combined summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    ["Total Invested", fmt(totalInvested), "text-white",   false],
                    ["Current Value",  fmt(totalValue),    "text-white",   false],
                    ["Total P&L",      fmt(totalPL),       isPLPos ? "text-green-400" : "text-red-400", true],
                    ["Holdings",       combined.length + " (" + stockRows.length + " stocks + " + mfRows.length + " MF)", "text-white", false],
                ].map(([label, value, cls, showPct]) => (
                    <div key={label}
                         className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className={"text-base font-bold mt-1 " + cls}>{value}</p>
                        {showPct && (
                            <p className={"text-xs font-medium mt-0.5 " + cls}>
                                {isPLPos ? "+" : ""}{totalPLPct}%
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Combined table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                        <th className="text-left px-4 py-3">Type</th>
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-right px-4 py-3">Invested</th>
                        <th className="text-right px-4 py-3">Value</th>
                        <th className="text-right px-4 py-3">P&amp;L</th>
                        <th className="text-right px-4 py-3">P&amp;L %</th>
                    </tr>
                    </thead>
                    <tbody>
                    {combined.map((row, idx) => {
                        const isPos = row.pl >= 0;
                        const color = isPos ? "text-green-400" : "text-red-400";

                        return (
                            <tr
                                key={idx}
                                className="border-b border-slate-700/50
                                               hover:bg-slate-700/30 transition-colors"
                            >
                                <td className="px-4 py-3">
                                        <span className={
                                            "text-xs px-2 py-1 rounded font-medium " +
                                            (row.type === "STOCK"
                                                ? "bg-blue-900/30 text-blue-400"
                                                : "bg-purple-900/30 text-purple-400")
                                        }>
                                            {row.type === "STOCK" ? "📈 Stock" : "📊 MF"}
                                        </span>
                                </td>
                                <td className="px-4 py-3 max-w-xs">
                                    {row.type === "STOCK" ? (
                                        <button
                                            onClick={() => onChartStock(row.raw.stock)}
                                            className="text-left group"
                                        >
                                            <p className="font-semibold text-white
                                                              group-hover:text-blue-400
                                                              transition-colors">
                                                {row.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {row.subName}
                                            </p>
                                        </button>
                                    ) : (
                                        <div>
                                            <p className="font-semibold text-white
                                                              text-xs truncate"
                                               title={row.name}>
                                                {row.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {row.subName}
                                            </p>
                                        </div>
                                    )}
                                </td>
                                <td className="text-right px-4 py-3 text-slate-300">
                                    {fmt(row.invested)}
                                </td>
                                <td className="text-right px-4 py-3 text-white font-medium">
                                    {fmt(row.value)}
                                </td>
                                <td className={"text-right px-4 py-3 font-medium " + color}>
                                    {fmt(row.pl)}
                                </td>
                                <td className={"text-right px-4 py-3 font-medium " + color}>
                                    {isPos ? "+" : ""}{row.plPct.toFixed(2)}%
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}