import { useState, useEffect } from "react";
import { getStockPrice } from "../api/portfolio";

const fmt = (val, currency = "INR") => {
    if (!val && val !== 0) return "—";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency === "INR" ? "INR" : "USD",
        maximumFractionDigits: 2,
    }).format(val);
};

export default function StockDetailModal({ stock, onClose }) {
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!stock) return;
        setQuote(null);
        setLoading(true);
        getStockPrice(stock.symbol)
            .then((res) => setQuote(res.data))
            .catch(() => setQuote(null))
            .finally(() => setLoading(false));
    }, [stock?.symbol]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    if (!stock) return null;

    const pl = parseFloat(quote?.changePercent || 0);
    const isPositive = pl >= 0;
    const plColor = isPositive ? "text-green-400" : "text-red-400";
    const plBg = isPositive
        ? "bg-green-900/20 border-green-700/30"
        : "bg-red-900/20 border-red-700/30";

    const tvUrl =
        "https://www.tradingview.com/chart/?symbol=" +
        stock.exchange +
        ":" +
        stock.symbol +
        "&interval=W";

    const tvMobile =
        "https://www.tradingview.com/symbols/" +
        stock.exchange +
        "-" +
        stock.symbol;

    const stats = [
        ["Day High", fmt(quote?.dayHigh, quote?.currency)],
        ["Day Low", fmt(quote?.dayLow, quote?.currency)],
        ["Prev Close", fmt(quote?.previousClose, quote?.currency)],
        ["52W High", fmt(quote?.weekHigh52, quote?.currency)],
        ["52W Low", fmt(quote?.weekLow52, quote?.currency)],
        ["Volume", quote?.volume ? quote.volume.toLocaleString("en-IN") : "—"],
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div
                className="relative z-50 w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="flex items-start justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-4 py-2.5">
                            <p className="text-xl font-bold text-white leading-tight">
                                {stock.symbol}
                            </p>
                            <p className="text-xs text-blue-400">{stock.exchange}</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold text-lg leading-tight">
                                {stock.name}
                            </p>
                            {stock.sector && (
                                <p className="text-xs text-slate-400 mt-1">
                                    {stock.sector}
                                    {stock.industry ? " · " + stock.industry : ""}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* PRICE */}
                <div className="p-5 border-b border-slate-700">
                    {loading ? (
                        <div className="space-y-3">
                            <div className="h-10 w-48 bg-slate-700 rounded animate-pulse" />
                            <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
                        </div>
                    ) : quote ? (
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-4xl font-bold text-white">
                                    {fmt(quote.currentPrice, quote.currency)}
                                </p>
                                <div
                                    className={
                                        "inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg border text-sm font-medium " +
                                        plBg +
                                        " " +
                                        plColor
                                    }
                                >
                                    <span>{isPositive ? "▲" : "▼"}</span>
                                    <span>
                                        {fmt(
                                            Math.abs(quote.change || 0),
                                            quote.currency
                                        )}
                                    </span>
                                    <span>
                                        ({isPositive ? "+" : ""}
                                        {pl.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mb-1">
                                via {quote.dataSource}
                            </p>
                        </div>
                    ) : (
                        <p className="text-slate-400">Price unavailable</p>
                    )}
                </div>

                {/* STATS GRID */}
                {!loading && quote && (
                    <div className="grid grid-cols-3 gap-px bg-slate-700/50 border-b border-slate-700">
                        {stats.map(([label, value]) => (
                            <div key={label} className="bg-slate-900 px-4 py-3">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className="text-sm font-semibold text-white mt-0.5">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* CHART BUTTONS */}
                <div className="p-5 space-y-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                        View Chart
                    </p>

                    <a
                        href={tvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full px-5 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">TV</span>
                            </div>
                            <div className="text-left">
                                <p className="text-white font-semibold">
                                    Open in TradingView
                                </p>
                                <p className="text-blue-200 text-xs">
                                    Full chart · All indicators · Free
                                </p>
                            </div>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5 text-blue-200"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                    </a>

                    <a
                        href={tvMobile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full px-5 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors"
                    >
                        <div className="text-left">
                            <p className="text-white text-sm font-medium">
                                View Symbol Overview
                            </p>
                            <p className="text-slate-400 text-xs">
                                Financials · News · Analysis
                            </p>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 text-slate-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                    </a>
                </div>

                {/* FOOTER */}
                <div className="px-5 py-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-600 text-center">
                        ESC to close · Price data via NSE India
                    </p>
                </div>
            </div>
        </div>
    );
}