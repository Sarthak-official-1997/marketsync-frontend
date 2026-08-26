// src/pages/MyIdeasPage.jsx
// Client's categorized view of their own active ideas — separate from the
// chat thread. Derived entirely from getMyThread()'s existing data,
// filtered client-side: no new backend endpoint needed for this to exist.
//
// IMPORTANT CONSTRAINT, don't remove this without re-reading why: this
// page NEVER computes or shows a stop-loss "touched" status on its own.
// That's the entire reason the SL-gating feature exists — a client seeing
// a live "SL hit" badge here would bypass the creator's decision gate
// completely. Stop-loss level is shown as plain informational text (part
// of the original plan), never as a live-computed alert. Target-hit status
// IS shown, but only from the persisted `hit` flag already present in the
// thread data (reflecting whatever the creator's last alert check found)
// — never freshly recomputed here, which would risk showing "target hit"
// before the creator's own dashboard has even caught up to the same fact.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { getMyThread } from "../api/thread";
import { getStockPrice } from "../api/portfolio";

const SIGNAL_META = {
    BUY:          { label: "Buy",          cls: "bg-green-900/30 text-green-400" },
    HOLD:         { label: "Hold",         cls: "bg-amber-900/30 text-amber-400" },
    ADD:          { label: "Add more",     cls: "bg-blue-900/30 text-blue-400" },
    SELL_PARTIAL: { label: "Sell partial", cls: "bg-amber-900/30 text-amber-400" },
    SELL_FULL:    { label: "Sell full",    cls: "bg-red-900/30 text-red-400" },
};

function fmtAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`;
}

function InvestmentCard({ idea, livePrice }) {
    const meta = SIGNAL_META[idea.signalType] || { label: idea.signalType, cls: "bg-slate-700 text-slate-300" };
    // "Advised at" — best available reference price: the idea's own buy
    // range low (if given), otherwise no cost basis to compare against.
    const advisedAt = idea.buyRangeLow != null ? parseFloat(idea.buyRangeLow) : null;
    const returnPct = advisedAt && livePrice ? ((livePrice - advisedAt) / advisedAt) * 100 : null;

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 mb-3">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-white font-bold text-sm">{idea.stockSymbol || idea.mfSchemeCode}</p>
                    <p className="text-slate-500 text-[10.5px]">{fmtAgo(idea.createdAt)}</p>
                </div>
                {returnPct != null ? (
                    <div className="text-right">
                        <p className={"text-sm font-bold " + (returnPct >= 0 ? "text-green-400" : "text-red-400")}>
                            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                        </p>
                        <p className="text-slate-500 text-[9px] uppercase">since advised</p>
                    </div>
                ) : (
                    <span className={"text-[10px] font-bold px-2.5 py-1 rounded-full uppercase " + meta.cls}>{meta.label}</span>
                )}
            </div>
            {advisedAt && livePrice && (
                <div className="flex justify-between text-[10.5px] text-slate-500 border-t border-slate-700/60 pt-2 mb-1.5">
                    <span>Advised at ₹{advisedAt.toLocaleString("en-IN")}</span>
                    <span>Now ₹{livePrice.toLocaleString("en-IN")}</span>
                </div>
            )}
            {idea.ideaNote && <p className="text-slate-400 text-[11px] italic">"{idea.ideaNote}"</p>}
        </div>
    );
}

function TradeSetupCard({ idea, livePrice }) {
    // All targets, whether from the legacy single targetPrice field or
    // the multi-target list — unified into one array for display so a
    // simple single-target idea and a T1/T2/T3 one render the same way.
    const allTargets = idea.targets && idea.targets.length > 0
        ? idea.targets
        : (idea.targetPrice != null ? [{ targetPrice: idea.targetPrice, sortOrder: 0, hit: false }] : []);

    const hitCount = allTargets.filter(t => t.hit).length;
    const nextOpen = allTargets.find(t => !t.hit);

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 mb-3 relative overflow-hidden">
            <div className={"absolute left-0 top-0 bottom-0 w-1 " +
                (hitCount === allTargets.length && allTargets.length > 0 ? "bg-green-500" : "bg-purple-500")} />
            <div className="pl-2">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <p className="text-white font-bold text-sm">{idea.stockSymbol}</p>
                        <p className="text-slate-500 text-[10.5px]">{livePrice ? `₹${livePrice.toLocaleString("en-IN")} now` : ""}</p>
                    </div>
                    {allTargets.length > 0 && hitCount > 0 ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-green-900/30 text-green-400">
                            🎯 Target {hitCount} of {allTargets.length} hit
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-purple-900/30 text-purple-400">
                            ▶ Active
                        </span>
                    )}
                </div>

                {allTargets.length > 1 && (
                    <div className="flex gap-1 mb-2">
                        {allTargets.map((t, i) => (
                            <div key={i} className={"flex-1 h-1.5 rounded-full " + (t.hit ? "bg-green-500" : "bg-slate-700")} />
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {idea.buyRangeLow != null && (
                        <div className="bg-slate-900/60 rounded-lg text-center py-1.5 px-1">
                            <p className="text-[8px] text-slate-500 uppercase">Entry</p>
                            <p className="text-[11px] font-bold text-white">{idea.buyRangeLow}–{idea.buyRangeHigh}</p>
                        </div>
                    )}
                    {allTargets.map((t, i) => (
                        <div key={i} className={"rounded-lg text-center py-1.5 px-1 " + (t.hit ? "bg-green-900/20" : "bg-slate-900/60")}>
                            <p className="text-[8px] text-slate-500 uppercase">{allTargets.length > 1 ? `T${i + 1}` : "Target"}</p>
                            <p className={"text-[11px] font-bold " + (t.hit ? "text-green-400" : "text-white")}>
                                {t.targetPrice}{t.hit ? " ✓" : ""}
                            </p>
                        </div>
                    ))}
                    {/* Stop-loss shown as plain informational text ONLY —
                        never a computed "touched" status. See file header
                        comment for why this distinction is load-bearing. */}
                    {idea.stopLossPrice != null && (
                        <div className="bg-slate-900/60 rounded-lg text-center py-1.5 px-1">
                            <p className="text-[8px] text-slate-500 uppercase">Stop-loss</p>
                            <p className="text-[11px] font-bold text-white">{idea.stopLossPrice}</p>
                        </div>
                    )}
                </div>

                {nextOpen && nextOpen.partialBookPercent != null && (
                    <p className="text-[10.5px] text-slate-500">
                        Plan: book {nextOpen.partialBookPercent}% at this target, hold the rest
                    </p>
                )}
                {idea.ideaNote && <p className="text-slate-400 text-[11px] italic mt-1.5">"{idea.ideaNote}"</p>}
            </div>
        </div>
    );
}

export default function MyIdeasPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [ideas, setIdeas] = useState(null);
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMyThread()
            .then(res => {
                const activeIdeas = (res.data || []).filter(m =>
                    m.messageType === "IDEA" && m.ideaStatus === "PENDING");
                setIdeas(activeIdeas);

                const symbols = [...new Set(activeIdeas.filter(i => i.stockSymbol).map(i => i.stockSymbol))];
                Promise.allSettled(symbols.map(sym => getStockPrice(sym)))
                    .then(results => {
                        const map = {};
                        results.forEach((r, i) => {
                            if (r.status === "fulfilled") {
                                map[symbols[i]] = parseFloat(r.value.data?.currentPrice ?? r.value.data?.regularMarketPrice ?? 0) || null;
                            }
                        });
                        setPrices(map);
                    });
            })
            .catch(() => toast.error("Couldn't load your ideas"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>;
    }

    const investments = (ideas || []).filter(i => i.category === "INVESTMENT" || i.category == null);
    const tradeSetups = (ideas || []).filter(i => i.category === "TRADE_SETUP");

    return (
        <div className="max-w-lg mx-auto">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                <button onClick={() => navigate(-1)} className="text-slate-400 text-xl">←</button>
                <p className="text-white font-bold text-base flex-1">My Ideas</p>
                <button onClick={() => navigate("/my-thread")}
                        className="text-[11px] font-semibold text-purple-400 flex-shrink-0">
                    💬 Message
                </button>
            </div>

            <div className="px-4 py-4">
                {(!ideas || ideas.length === 0) && (
                    <p className="text-center text-slate-600 text-xs mt-10">
                        Nothing here yet — ideas your advisor sends will show up here.
                    </p>
                )}

                {investments.length > 0 && (
                    <>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                            📈 Long-term Investments
                        </p>
                        {investments.map(idea => (
                            <InvestmentCard key={idea.id} idea={idea} livePrice={prices[idea.stockSymbol]} />
                        ))}
                    </>
                )}

                {tradeSetups.length > 0 && (
                    <>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 mt-4">
                            ⚡ Active Trade Setups
                        </p>
                        {tradeSetups.map(idea => (
                            <TradeSetupCard key={idea.id} idea={idea} livePrice={prices[idea.stockSymbol]} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}