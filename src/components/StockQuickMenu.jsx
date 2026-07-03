import { useEffect } from "react";
import { useMobile } from "../hooks/useMobile";

/**
 * StockQuickMenu — appears when a user clicks a stock name anywhere in the app.
 *
 * Desktop: centered overlay (original behaviour).
 * Mobile:  bottom sheet that slides up above the bottom nav (zIndex 9999 > nav's 9000).
 *
 * Used in HoldingsPage, TransactionsPage, and WatchlistPage.
 */
export default function StockQuickMenu({ stock, onClose, onViewChart, onTransact }) {
    const isMobile = useMobile();

    // Close on Escape
    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    const handleViewChart = () => { onViewChart(); onClose(); };
    const handleTransact  = () => { onTransact();  onClose(); };

    // ── MOBILE: bottom sheet ──────────────────────────────────────────────────
    if (isMobile) {
        return (
            <div
                style={{
                    position: "fixed", inset: 0,
                    zIndex: 9999,
                    display: "flex", flexDirection: "column",
                    justifyContent: "flex-end",
                }}
                onClick={onClose}
            >
                <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(4px)",
                }} />

                <div
                    style={{
                        position: "relative",
                        background: "#0f172a",
                        borderTop: "1px solid rgba(71,85,105,0.6)",
                        borderRadius: "20px 20px 0 0",
                        paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{
                        width: 36, height: 4, background: "#334155",
                        borderRadius: 2, margin: "12px auto 0",
                    }} />

                    <div style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderBottom: "1px solid rgba(71,85,105,0.4)",
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ color: "white", fontWeight: 700,
                                fontSize: 15, lineHeight: 1.2, margin: 0 }}>
                                {stock.symbol}
                            </p>
                            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap", maxWidth: 220, margin: 0 }}>
                                {stock.name}
                            </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{
                                fontSize: 11, background: "#1e293b", color: "#94a3b8",
                                padding: "3px 8px", borderRadius: 6, fontWeight: 600,
                            }}>
                                {stock.exchange || "NSE"}
                            </span>
                            <button
                                onClick={onClose}
                                style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: "#1e293b", border: "none",
                                    color: "#64748b", fontSize: 14, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>✕</button>
                        </div>
                    </div>

                    <div style={{ padding: "8px 10px 12px" }}>
                        <button
                            onClick={handleViewChart}
                            style={{
                                width: "100%", display: "flex", alignItems: "center",
                                gap: 14, padding: "13px 12px", borderRadius: 14,
                                background: "transparent", border: "none",
                                cursor: "pointer", textAlign: "left", marginBottom: 4,
                            }}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                background: "rgba(37,99,235,0.2)",
                                border: "1px solid rgba(59,130,246,0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20,
                            }}>📈</div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ color: "white", fontSize: 14, fontWeight: 700, margin: 0 }}>
                                    View Chart &amp; Details
                                </p>
                                <p style={{ color: "#64748b", fontSize: 11, marginTop: 2, margin: 0 }}>
                                    Price · Returns · 52W High/Low · Chart
                                </p>
                            </div>
                            <span style={{ marginLeft: "auto", color: "#475569",
                                fontSize: 18, flexShrink: 0 }}>›</span>
                        </button>

                        <button
                            onClick={handleTransact}
                            style={{
                                width: "100%", display: "flex", alignItems: "center",
                                gap: 14, padding: "13px 12px", borderRadius: 14,
                                background: "transparent", border: "none",
                                cursor: "pointer", textAlign: "left",
                            }}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                background: "rgba(22,163,74,0.2)",
                                border: "1px solid rgba(34,197,94,0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20,
                            }}>💰</div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ color: "white", fontSize: 14, fontWeight: 700, margin: 0 }}>
                                    Transactions
                                </p>
                                <p style={{ color: "#64748b", fontSize: 11, marginTop: 2, margin: 0 }}>
                                    BUY · SELL · View history
                                </p>
                            </div>
                            <span style={{ marginLeft: "auto", color: "#475569",
                                fontSize: 18, flexShrink: 0 }}>›</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── DESKTOP: original centered overlay — unchanged ────────────────────────
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