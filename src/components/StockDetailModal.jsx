import { useState, useEffect } from "react";
import TradingViewChart from "./TradingViewChart";
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
    const [fullscreen, setFullscreen] = useState(false);

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
            if (e.key === "Escape") {
                if (fullscreen) setFullscreen(false);
                else onClose();
            }
        };

        document.addEventListener("keydown", handler);

        return () => {
            document.removeEventListener("keydown", handler);
        };
    }, [fullscreen, onClose]);

    if (!stock) return null;

    const pl = parseFloat(quote?.changePercent || 0);
    const isPositive = pl >= 0;
    const plColor = isPositive ? "text-green-400" : "text-red-400";

    const tvUrl =
        "https://www.tradingview.com/chart/?symbol=" +
        stock.exchange +
        ":" +
        stock.symbol;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={fullscreen ? undefined : onClose}
        >
            {!fullscreen && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            )}

            <div
                className={
                    fullscreen
                        ? "fixed inset-2 z-50 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
                        : "relative z-50 w-full max-w-5xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
                }
                style={{
                    height: fullscreen
                        ? "calc(100vh - 16px)"
                        : "85vh",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="flex items-start justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-3 py-2 flex-shrink-0">
                            <p className="text-lg font-bold text-white leading-tight">
                                {stock.symbol}
                            </p>

                            <p className="text-xs text-blue-400">
                                {stock.exchange}
                            </p>
                        </div>

                        <div>
                            <p className="text-white font-semibold leading-tight">
                                {stock.name}
                            </p>

                            {stock.sector && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {stock.sector}
                                    {stock.industry
                                        ? " · " + stock.industry
                                        : ""}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {loading && (
                            <div className="w-28 h-10 bg-slate-700 rounded animate-pulse" />
                        )}

                        {!loading && quote && (
                            <div className="text-right mr-2">
                                <p className="text-2xl font-bold text-white">
                                    {fmt(
                                        quote.currentPrice,
                                        quote.currency
                                    )}
                                </p>

                                <p
                                    className={
                                        "text-sm font-medium " + plColor
                                    }
                                >
                                    {isPositive ? "▲" : "▼"}{" "}
                                    {fmt(
                                        Math.abs(
                                            quote.change || 0
                                        ),
                                        quote.currency
                                    )}{" "}
                                    (
                                    {isPositive ? "+" : ""}
                                    {pl.toFixed(2)}%)
                                </p>
                            </div>
                        )}

                        {/* Open in TradingView button */}
                        <a
                            href={tvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in TradingView"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
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
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line
                                    x1="10"
                                    y1="14"
                                    x2="21"
                                    y2="3"
                                />
                            </svg>
                        </a>

                        {/* Fullscreen button */}
                        <button
                            onClick={() =>
                                setFullscreen((f) => !f)
                            }
                            title={
                                fullscreen
                                    ? "Exit fullscreen"
                                    : "Fullscreen"
                            }
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                        >
                            {fullscreen ? (
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
                                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                                </svg>
                            ) : (
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
                                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                                </svg>
                            )}
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            title="Close"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
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
                                <line
                                    x1="18"
                                    y1="6"
                                    x2="6"
                                    y2="18"
                                />
                                <line
                                    x1="6"
                                    y1="6"
                                    x2="18"
                                    y2="18"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* STATS BAR */}
                {!loading && quote && (
                    <div className="flex items-center gap-6 px-5 py-2.5 border-b border-slate-700/50 flex-shrink-0 overflow-x-auto bg-slate-800/50">
                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500">
                                Day High
                            </p>

                            <p className="text-sm font-medium text-white mt-0.5">
                                {fmt(
                                    quote.dayHigh,
                                    quote.currency
                                )}
                            </p>
                        </div>

                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500">
                                Day Low
                            </p>

                            <p className="text-sm font-medium text-white mt-0.5">
                                {fmt(
                                    quote.dayLow,
                                    quote.currency
                                )}
                            </p>
                        </div>

                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500">
                                Prev Close
                            </p>

                            <p className="text-sm font-medium text-white mt-0.5">
                                {fmt(
                                    quote.previousClose,
                                    quote.currency
                                )}
                            </p>
                        </div>

                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500">
                                52W High
                            </p>

                            <p className="text-sm font-medium text-white mt-0.5">
                                {fmt(
                                    quote.weekHigh52,
                                    quote.currency
                                )}
                            </p>
                        </div>

                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500">
                                52W Low
                            </p>

                            <p className="text-sm font-medium text-white mt-0.5">
                                {fmt(
                                    quote.weekLow52,
                                    quote.currency
                                )}
                            </p>
                        </div>

                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500">
                                Volume
                            </p>

                            <p className="text-sm font-medium text-white mt-0.5">
                                {quote.volume
                                    ? quote.volume.toLocaleString(
                                        "en-IN"
                                    )
                                    : "—"}
                            </p>
                        </div>

                        <div className="flex-shrink-0 ml-auto">
                            <p className="text-xs text-slate-500">
                                Source
                            </p>

                            <p className="text-xs font-medium text-blue-400 mt-0.5">
                                {quote.dataSource}
                            </p>
                        </div>
                    </div>
                )}

                {/* CHART */}
                <div className="flex-1 min-h-0">
                    <TradingViewChart
                        symbol={stock.symbol}
                        exchange={stock.exchange}
                    />
                </div>

                {/* FOOTER */}
                <div className="px-5 py-2.5 border-t border-slate-700/50 flex-shrink-0 flex items-center justify-between bg-slate-800/30">
                    <p className="text-xs text-slate-500">
                        {"Chart powered by "}
                        <a
                            href="https://www.tradingview.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                        >
                            TradingView
                        </a>

                        {quote
                            ? " · Live quote via " +
                            quote.dataSource
                            : ""}
                    </p>

                    <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-600">
                            {fullscreen
                                ? "ESC to exit fullscreen"
                                : "ESC to close"}
                        </span>

                        <a
                            href={tvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Open in TradingView →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}