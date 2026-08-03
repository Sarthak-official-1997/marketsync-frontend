// src/components/QuickTradeModal.jsx
// Standalone "Quick Trade" flow. Search now uses the shared SearchPickerModal
// (same consistent popup as Watchlist and Simple Alert), instead of its own
// inline top-of-body search field.

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { searchStocks, createTradeSetupAlert, extractTradeSetup } from "../api/portfolio";
import SearchPickerModal from "./SearchPickerModal";
import StockConfirmPreview from "./StockConfirmPreview";

export default function QuickTradeModal({ onClose }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [stock, setStock] = useState(null);
    const [candidate, setCandidate] = useState(null); // picked from search, awaiting confirm

    const [entry, setEntry] = useState("");
    const [targets, setTargets] = useState([""]); // one or more target prices
    const [stopLoss, setStopLoss] = useState("");
    const [category, setCategory] = useState("EXPRESS_TRADE");
    const [extracting, setExtracting] = useState(false);
    const [aiNote, setAiNote] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    const onPickFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setExtracting(true);
        setAiNote(null);
        extractTradeSetup(file)
            .then(res => {
                const d = res.data || {};
                if (d.entryPrice != null) setEntry(String(d.entryPrice));
                if (d.targetPrice != null) setTargets([String(d.targetPrice)]);
                if (d.stopLossPrice != null) setStopLoss(String(d.stopLossPrice));
                setAiNote(d.message || d.extractionNote || null);
                if (d.entryPrice == null && d.targetPrice == null && d.stopLossPrice == null) {
                    toast.error("Couldn't read levels from this image — enter them manually");
                } else {
                    toast.success("Chart read — review the levels below");
                }
            })
            .catch((err) => toast.error(err?.response?.data?.message || "Couldn't read the chart"))
            .finally(() => {
                setExtracting(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            });
    };

    const addTargetField    = () => setTargets(prev => [...prev, ""]);
    const removeTargetField = (idx) => setTargets(prev => prev.filter((_, i) => i !== idx));
    const updateTargetField = (idx, val) => setTargets(prev => prev.map((t, i) => i === idx ? val : t));

    const save = () => {
        const e = parseFloat(entry), s = parseFloat(stopLoss);
        const parsedTargets = targets.map(t => parseFloat(t)).filter(t => !isNaN(t) && t > 0);
        if (!e || parsedTargets.length === 0 || !s) {
            toast.error("Fill in entry, at least one target, and stop-loss");
            return;
        }
        setSaving(true);
        createTradeSetupAlert({
            symbol: stock.symbol, name: stock.name, exchange: stock.exchange || "NSE",
            category,
            entryPrice: e, targetPrices: parsedTargets, stopLossPrice: s,
        })
            .then(() => { toast.success("Quick Trade alert created"); onClose(); })
            .catch((err) => toast.error(err?.response?.data?.message || "Couldn't create trade setup"))
            .finally(() => setSaving(false));
    };

    // Step 1.5: a stock has been picked from search but not yet confirmed —
    // THIS CHECK MUST COME BEFORE THE "!stock" SEARCH CHECK BELOW. They were
    // previously in the wrong order: "if (!stock) return <SearchPickerModal/>"
    // ran first and returned unconditionally, which made this candidate
    // check completely unreachable dead code — stock stays null until this
    // very step confirms it, so the search screen would show forever no
    // matter what was clicked. That was the actual bug behind "clicking a
    // stock does nothing."
    if (candidate && !stock) {
        return (
            <StockConfirmPreview
                stock={candidate}
                onConfirm={() => setStock(candidate)}
                onCancel={() => setCandidate(null)}
            />
        );
    }

    // Step 1: no stock chosen yet — shared search popup handles this step.
    if (!stock) {
        return (
            <SearchPickerModal
                title="⚡ Quick Trade"
                placeholder="Search a stock for this trade…"
                searchFn={(q) => searchStocks(q).then(res => res.data?.content || res.data || [])}
                renderResult={(s) => (
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className="font-semibold text-white text-sm">{s.symbol}</span>
                            <span className="text-slate-400 text-xs ml-2 truncate">{s.name}</span>
                        </div>
                        {s.exchange && (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex-shrink-0">
                                {s.exchange}
                            </span>
                        )}
                    </div>
                )}
                onPick={setCandidate}
                onClose={onClose}
            />
        );
    }

    // Step 2: stock chosen — category, AI upload / manual levels, create.
    return createPortal(
        <div className="fixed inset-0 z-[9650] flex items-end sm:items-center justify-center"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9651] bg-slate-900 flex flex-col"
                 style={isMobile ? {
                     width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
                     borderRadius: 0, border: "none",
                     paddingTop: "env(safe-area-inset-top, 0px)",
                     paddingBottom: "env(safe-area-inset-bottom, 0px)",
                     overflowX: "hidden",
                 } : {
                     width: "calc(100vw - 32px)", maxWidth: "440px",
                     minHeight: "460px", maxHeight: "88vh",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <div>
                        <p className="text-white font-bold text-base">⚡ Quick Trade</p>
                        <p className="text-slate-500 text-xs">{stock.symbol}</p>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
                     className="px-4 py-4 space-y-3">
                    <button onClick={() => { setStock(null); setCandidate(null); }}
                            className="text-xs text-slate-400 hover:text-white">← Change stock</button>

                    <p className="text-xs text-slate-500">
                        Get notified when entry, target, or stop-loss is hit — each level pings separately.
                    </p>

                    <button onClick={() => setCategory(prev => prev === "EXPRESS_TRADE" ? null : "EXPRESS_TRADE")}
                            className={"w-full text-xs font-semibold py-2 rounded-lg border transition-colors " +
                            (category === "EXPRESS_TRADE"
                                ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                                : "bg-slate-800 border-slate-700 text-slate-400")}>
                        ⚡ {category === "EXPRESS_TRADE" ? "Tagged: Express Trade ✓" : "Tag as Express Trade"}
                    </button>

                    <div className="border border-dashed border-slate-700 rounded-xl p-4 text-center">
                        <p className="text-2xl mb-1">📷</p>
                        <p className="text-xs text-slate-400 mb-2">
                            Upload a chart screenshot — AI reads entry, target, and stop-loss
                        </p>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile}
                               className="hidden" id="quick-trade-file" />
                        <label htmlFor="quick-trade-file"
                               className="inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white
                                          text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                            {extracting ? "Reading chart…" : "Upload chart image"}
                        </label>
                    </div>

                    {aiNote && (
                        <p className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/30
                                      rounded-lg px-3 py-2">
                            {aiNote}
                        </p>
                    )}

                    <p className="text-[11px] text-slate-600 text-center">or enter manually</p>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className="text-[10px] text-slate-500 mb-1">Entry</p>
                            <input type="number" value={entry} onChange={e => setEntry(e.target.value)}
                                   placeholder="0.00"
                                   className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                                              text-white text-xs focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <p className="text-[10px] text-red-500 mb-1">Stop-loss</p>
                            <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                                   placeholder="0.00"
                                   className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                                              text-white text-xs focus:outline-none focus:border-red-500" />
                        </div>
                    </div>

                    {/* One or more targets — for swing trades with staged profit-booking
                        (Target 1, Target 2, Target 3...). "Add another target" appends a
                        new field; each fires its own separate notification when hit. */}
                    <div className="space-y-1.5">
                        {targets.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <p className="text-[10px] text-green-500 w-14 flex-shrink-0">
                                    Target {targets.length > 1 ? i + 1 : ""}
                                </p>
                                <input type="number" value={t} onChange={e => updateTargetField(i, e.target.value)}
                                       placeholder="0.00"
                                       className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                                                  text-white text-xs focus:outline-none focus:border-green-500" />
                                {targets.length > 1 && (
                                    <button onClick={() => removeTargetField(i)}
                                            className="text-slate-500 hover:text-red-400 text-xs flex-shrink-0">
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        <button onClick={addTargetField}
                                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold">
                            + Add another target
                        </button>
                    </div>

                    <p className="text-[11px] text-slate-600">
                        Entry & stop-loss ping twice (immediate + a follow-up if still active). Each target pings once.
                    </p>

                    <button onClick={save} disabled={saving}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                       text-white text-sm font-semibold rounded-xl transition-colors">
                        {saving ? "Creating…" : "Confirm and create alert"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}