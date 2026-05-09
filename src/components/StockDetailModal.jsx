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
    const [quote, setQuote]         = useState(null);
    const [quoteLoading, setLoading] = useState(true);

    useEffect(() => {
        if (!stock) return;
        setLoading(true);
        getStockPrice(stock.symbol)
            .then(res => setQuote(res.data))
            .catch(() => setQuote(null))
            .finally(() => setLoading(false));
    }, [stock?.symbol]);

    if (!stock) return null;

    const pl         = parseFloat(quote?.changePercent || 0);
    const isPositive = pl >= 0;
    const plColor    = isPositive ? "text-green-400" : "text-red-400";
    const plBg       = isPositive ? "bg-green-900/30" : "bg-red-900/30";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-slate-900 rounded-2xl border border-slate-700
                           shadow-2xl w-full max-w-5xl flex flex-col"
                style={{ height: "85vh" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5
                                border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        {/* Symbol badge */}
                        <div className="bg-blue-600/20 border border-blue-500/30
                                        rounded-xl px-4 py-2">
                            <p className="text-xl font-bold text-white">
                                {stock.symbol}
                            </p>
                            <p className="text-xs text-blue-400">{stock.exchange}</p>
                        </div>

                        {/* Company name + sector */}
                        <div>
                            <p className="text-white font-semibold text-lg leading-tight">
                                {stock.name}
                            </p>
                            {stock.sector && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {stock.sector}
                                    {stock.industry && ` · ${stock.industry}`}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Live price + change */}
                    <div className="flex items-center gap-4">
                        {quoteLoading ? (
                            <div className="w-24 h-8 bg-slate-700
                                            rounded animate-pulse" />
                        ) : quote ? (
                            <div className="text-right">
                                <p className="text-2xl font-bold text-white">
                                    {fmt(quote.currentPrice, quote.currency)}
                                </p>
                                <div className={`flex items-center justify-end gap-1
                                                 text-sm font-medium ${plColor}`}>
                                    <span>{isPositive ? "▲" : "▼"}</span>
                                    <span>
                                        {fmt(quote.change, quote.currency)}
                                    </span>
                                    <span>
                                        ({isPositive ? "+" : ""}{pl.toFixed(2)}%)
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {quote.dataSource}
                                </p>
                            </div>
                        ) : null}

                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white text-2xl
                                       transition-colors ml-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Quick stats bar */}
                {quote && !quoteLoading && (
                    <div className="flex items-center gap-6 px-5 py-3
                                    border-b border-slate-700/50 flex-shrink-0
                                    overflow-x-auto">
                        {[
                            ["Day High",    fmt(quote.dayHigh, quote.currency)],
                            ["Day Low",     fmt(quote.dayLow, quote.currency)],
                            ["Prev Close",  fmt(quote.previousClose, quote.currency)],
                            ["52W High",    fmt(quote.weekHigh52, quote.currency)],
                            ["52W Low",     fmt(quote.weekLow52, quote.currency)],
                            ["Volume",      quote.volume
                                ? quote.volume.toLocaleString("en-IN")
                                : "—"],
                        ].map(([label, value]) => (
                            <div key={label} className="flex-shrink-0 text-center">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className="text-sm font-medium text-white mt-0.5">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* TradingView Chart — takes remaining space */}
                <div className="flex-1 p-4 min-h-0">
                    <TradingViewChart
                        symbol={stock.symbol}
                        exchange={stock.exchange}
                        theme="dark"
                    />
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-700/50
                                flex-shrink-0 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        Chart powered by{" "}
                        <a href="https://www.tradingview.com"
                           target="_blank"
                           rel="noopener noreferrer"
                           className="text-blue-400 hover:text-blue-300">
                            TradingView
                        </a>
                        {" "}· Live quote via {quote?.dataSource || "NSE"}
                    </p>
                    <button
                        onClick={onClose}
                        className="text-sm text-slate-400 hover:text-white
                                   transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}