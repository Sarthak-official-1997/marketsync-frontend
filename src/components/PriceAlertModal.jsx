// src/components/PriceAlertModal.jsx
// Set a price alert for any stock directly from the stock detail modal.
// Alert types: target price (above/below) or % change (rise/fall) from reference.
// No expiry — alert fires once and stays triggered.

import { useState } from "react";
import { createAlert } from "../api/portfolio";
import { useToast } from "../context/ToastContext";

const TYPES = {
    target:  ["PRICE_ABOVE", "PRICE_BELOW"],
    percent: ["PCT_UP",      "PCT_DOWN"],
};

export default function PriceAlertModal({ stock, currentPrice, onClose, onCreated }) {
    const toast = useToast();
    const cp    = parseFloat(currentPrice || 0);

    const [tab,   setTab]   = useState("target");     // "target" | "percent"
    const [dir,   setDir]   = useState("above");      // "above" | "below"  (target)
    const [pDir,  setPDir]  = useState("up");         // "up" | "down"      (percent)
    const [price, setPrice] = useState("");           // target price input
    const [pct,   setPct]   = useState("");           // % change input
    const [ref,   setRef]   = useState(cp.toFixed(2)); // reference price for %
    const [saving, setSaving] = useState(false);

    // ── Derived ──────────────────────────────────────────────────────────────
    const alertType = tab === "target"
        ? (dir === "above" ? "PRICE_ABOVE" : "PRICE_BELOW")
        : (pDir === "up"   ? "PCT_UP"      : "PCT_DOWN");

    const targetNum  = parseFloat(price || 0);
    const pctNum     = parseFloat(pct   || 0);
    const refNum     = parseFloat(ref   || cp);

    const computedTarget = tab === "target"
        ? targetNum
        : pDir === "up"
            ? refNum * (1 + pctNum / 100)
            : refNum * (1 - pctNum / 100);

    const distancePct = cp > 0 && computedTarget > 0
        ? ((computedTarget - cp) / cp * 100)
        : null;

    const canSave = tab === "target"
        ? targetNum > 0
        : pctNum > 0 && refNum > 0;

    // ── Preview label ─────────────────────────────────────────────────────────
    const preview = () => {
        const t = computedTarget > 0 ? `₹${computedTarget.toLocaleString("en-IN",{maximumFractionDigits:2})}` : "—";
        const dist = distancePct != null
            ? ` (${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(2)}% from now)`
            : "";
        if (tab === "target")
            return `Alert when ${stock.symbol} goes ${dir === "above" ? "above" : "below"} ${t}${dist}`;
        return `Alert when ${stock.symbol} ${pDir === "up" ? "rises" : "falls"} ${pctNum}% from ₹${refNum.toLocaleString("en-IN",{maximumFractionDigits:2})} → ${t}${dist}`;
    };

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const payload = {
                symbol:         stock.symbol,
                name:           stock.name,
                exchange:       stock.exchange || "NSE",
                alertType,
                targetPrice:    tab === "target" ? targetNum : null,
                pctChange:      tab === "percent" ? pctNum   : null,
                referencePrice: tab === "percent" ? refNum   : null,
            };
            const result = await createAlert(payload);
            toast.success(`Alert set: ${result.data?.description || stock.symbol}`);
            if (onCreated) onCreated(result.data);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to set alert");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔔</span>
                        <div>
                            <p className="text-white font-bold">Set Price Alert</p>
                            <p className="text-slate-500 text-xs">
                                {stock.symbol} · currently ₹{cp.toLocaleString("en-IN",{maximumFractionDigits:2})}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl">✕</button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Tab toggle */}
                    <div className="flex bg-slate-800 rounded-xl p-1">
                        {[["target","🎯 Target Price"],["percent","📊 % Change"]].map(([id,label]) => (
                            <button key={id} onClick={() => setTab(id)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                                               ${tab === id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === "target" ? (
                        <div className="space-y-4">
                            {/* Above / Below toggle */}
                            <div className="flex gap-2">
                                {[["above","📈 Goes Above","bg-green-900/30 border-green-500/30 text-green-400"],
                                    ["below","📉 Drops Below","bg-red-900/30 border-red-500/30 text-red-400"]].map(([v,l,cls]) => (
                                    <button key={v} onClick={() => setDir(v)}
                                            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all
                                                       ${dir === v ? cls : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                            {/* Target price */}
                            <div>
                                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                                    Target Price (₹)
                                </label>
                                <input
                                    type="number" min="0.01" step="0.01"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    placeholder={cp > 0 ? `e.g. ${(cp * 1.05).toFixed(0)}` : "Enter price"}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5
                                               text-white text-sm focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                                {/* Quick suggestions */}
                                {cp > 0 && (
                                    <div className="flex gap-2 mt-2">
                                        {(dir === "above"
                                                ? [2,5,10].map(p => ({ label: `+${p}%`, val: cp*(1+p/100) }))
                                                : [2,5,10].map(p => ({ label: `-${p}%`, val: cp*(1-p/100) }))
                                        ).map(({label, val}) => (
                                            <button key={label}
                                                    onClick={() => setPrice(val.toFixed(2))}
                                                    className="flex-1 py-1 text-xs bg-slate-800 border border-slate-700
                                                               hover:border-slate-500 text-slate-400 hover:text-white
                                                               rounded-lg transition-colors">
                                                {label} = ₹{val.toFixed(0)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Rise / Fall toggle */}
                            <div className="flex gap-2">
                                {[["up","🔼 Rises By","bg-green-900/30 border-green-500/30 text-green-400"],
                                    ["down","🔽 Falls By","bg-red-900/30 border-red-500/30 text-red-400"]].map(([v,l,cls]) => (
                                    <button key={v} onClick={() => setPDir(v)}
                                            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all
                                                       ${pDir === v ? cls : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                            {/* % input */}
                            <div>
                                <label className="text-xs text-slate-400 font-medium block mb-1.5">Percentage (%)</label>
                                <div className="flex gap-2 mb-2">
                                    {[1,2,5,10].map(p => (
                                        <button key={p} onClick={() => setPct(String(p))}
                                                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors font-medium
                                                           ${pct === String(p)
                                                    ? "bg-blue-600 border-blue-500 text-white"
                                                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"}`}>
                                            {p}%
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number" min="0.01" step="0.01" max="100"
                                    value={pct}
                                    onChange={e => setPct(e.target.value)}
                                    placeholder="e.g. 5"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5
                                               text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            {/* Reference price */}
                            <div>
                                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                                    From price (₹)
                                    <button onClick={() => setRef(cp.toFixed(2))}
                                            className="ml-2 text-blue-400 hover:underline text-xs font-normal">
                                        use current
                                    </button>
                                </label>
                                <input
                                    type="number" min="0.01" step="0.01"
                                    value={ref}
                                    onChange={e => setRef(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5
                                               text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {canSave && (
                        <div className={`rounded-xl px-4 py-3 border text-xs font-medium
                                        ${distancePct == null || distancePct >= 0
                            ? "bg-green-900/20 border-green-500/20 text-green-400"
                            : "bg-red-900/20 border-red-500/20 text-red-400"}`}>
                            {preview()}
                        </div>
                    )}

                    {/* Save */}
                    <button
                        disabled={!canSave || saving}
                        onClick={handleSave}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                   disabled:cursor-not-allowed text-white font-bold text-sm
                                   rounded-xl transition-colors">
                        {saving ? "Setting alert…" : "🔔 Set Alert"}
                    </button>
                </div>
            </div>
        </div>
    );
}