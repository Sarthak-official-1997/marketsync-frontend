import { useEffect } from "react";

/**
 * StockQuickMenu — appears when a user clicks a stock name anywhere in the app.
 *
 * Instead of directly opening the transaction panel (old behaviour), this menu
 * gives the user a choice between two distinct flows:
 *   1. View Chart & Details  → StockDetailModal (price, chart, returns)
 *   2. Transactions          → StockTransactionPanel (BUY / SELL / history)
 *
 * Used in HoldingsPage, TransactionsPage, and WatchlistPage.
 * Rendered at the page level, not inside the table row, so z-index is clean.
 */
export default function StockQuickMenu({ stock, onClose, onViewChart, onTransact }) {

    // Close on Escape
    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    const handleViewChart = () => { onViewChart(); onClose(); };
    const handleTransact  = () => { onTransact();  onClose(); };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Menu card */}
            <div
                className="relative z-50 w-72 bg-slate-900 border border-slate-700/80
                           rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Stock identity header */}
                <div className="flex items-center justify-between px-5 py-4
                                bg-slate-800/60 border-b border-slate-700/60">
                    <div className="min-w-0">
                        <p className="text-white font-bold text-base leading-tight">
                            {stock.symbol}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[190px]"
                           title={stock.name}>
                            {stock.name}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs bg-slate-700 text-slate-300
                                         px-2 py-1 rounded-lg font-medium">
                            {stock.exchange || "NSE"}
                        </span>
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-500 hover:text-white
                                       hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Action options */}
                <div className="p-2 space-y-1">

                    {/* Option 1: Chart */}
                    <button
                        onClick={handleViewChart}
                        className="w-full flex items-center gap-3.5 px-4 py-3.5
                                   text-left rounded-xl hover:bg-slate-700/60
                                   transition-colors group"
                    >
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30
                                        rounded-xl flex items-center justify-center
                                        flex-shrink-0 group-hover:bg-blue-600/30
                                        transition-colors">
                            <span className="text-lg">📈</span>
                        </div>
                        <div>
                            <p className="text-white text-sm font-semibold
                                          group-hover:text-blue-400 transition-colors">
                                View Chart & Details
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                                Price · Returns · 52W High/Low · Chart
                            </p>
                        </div>
                        <span className="ml-auto text-slate-600 group-hover:text-slate-400
                                         transition-colors text-sm">
                            →
                        </span>
                    </button>

                    {/* Option 2: Transactions */}
                    <button
                        onClick={handleTransact}
                        className="w-full flex items-center gap-3.5 px-4 py-3.5
                                   text-left rounded-xl hover:bg-slate-700/60
                                   transition-colors group"
                    >
                        <div className="w-10 h-10 bg-green-600/20 border border-green-500/30
                                        rounded-xl flex items-center justify-center
                                        flex-shrink-0 group-hover:bg-green-600/30
                                        transition-colors">
                            <span className="text-lg">💰</span>
                        </div>
                        <div>
                            <p className="text-white text-sm font-semibold
                                          group-hover:text-green-400 transition-colors">
                                Transactions
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                                BUY · SELL · View history
                            </p>
                        </div>
                        <span className="ml-auto text-slate-600 group-hover:text-slate-400
                                         transition-colors text-sm">
                            →
                        </span>
                    </button>

                </div>

                <p className="text-center text-xs text-slate-700 pb-3">
                    Press Esc to close
                </p>
            </div>
        </div>
    );
}