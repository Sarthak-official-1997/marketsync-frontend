// src/components/TradeSetupModal.jsx
// "New Alert" creation flow — two tabs:
//   Simple condition: Above / Below / Equals + a target price (extends the
//   original PRICE_ABOVE/PRICE_BELOW alert with a third, Equals, condition).
//   Trade setup: entry / target / stop-loss as one linked unit, filled in
//   manually or extracted from an uploaded chart screenshot via AI (with a
//   confirm-before-save step, same pattern as the AI transaction import).
// Mobile: full-screen. Desktop: centered. Same responsive pattern as the
// rest of the app's modals.

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import {
    createAlert, createTradeSetupAlert, extractTradeSetup,
    getAlerts, deleteAlert, deleteTradeSetupAlert,
} from "../api/portfolio";

export default function TradeSetupModal({ stock, onClose, onCreated }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [tab, setTab] = useState("simple"); // "simple" | "setup"
    const [saving, setSaving] = useState(false);

    // Existing alerts already set on this stock — shown above the form so
    // the person can see what's already configured (both simple-condition
    // and trade-setup alerts, distinguished by tradeSetupId) before
    // deciding whether to add another. getAlerts() has no symbol filter
    // server-side, so filtering happens here.
    const [existingAlerts, setExistingAlerts] = useState(null); // null = still loading
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        if (!stock?.symbol) return;
        let cancelled = false;
        getAlerts()
            .then(res => {
                if (cancelled) return;
                setExistingAlerts((res.data || []).filter(a => a.symbol === stock.symbol));
            })
            .catch(() => { if (!cancelled) setExistingAlerts([]); });
        return () => { cancelled = true; };
    }, [stock?.symbol]);

    const removeExistingAlert = (alert) => {
        setDeletingId(alert.id);
        const req = alert.tradeSetupId != null
            ? deleteTradeSetupAlert(alert.tradeSetupId)
            : deleteAlert(alert.id);
        req
            .then(() => {
                setExistingAlerts(prev => alert.tradeSetupId != null
                    ? prev.filter(a => a.tradeSetupId !== alert.tradeSetupId)
                    : prev.filter(a => a.id !== alert.id));
                toast.success("Alert removed");
            })
            .catch(() => toast.error("Couldn't remove alert"))
            .finally(() => setDeletingId(null));
    };

    // -- Simple condition state --
    const [condition, setCondition] = useState("above"); // above | below | equals
    const [simplePrice, setSimplePrice] = useState("");

    // -- Trade setup state --
    const [entry, setEntry]     = useState("");
    const [target, setTarget]   = useState("");
    const [stopLoss, setStopLoss] = useState("");
    const [category, setCategory] = useState(null); // "EXPRESS_TRADE" | null
    const [extracting, setExtracting] = useState(false);
    const [aiNote, setAiNote] = useState(null);
    const fileInputRef = useRef(null);

    const CONDITION_TO_TYPE = { above: "PRICE_ABOVE", below: "PRICE_BELOW", equals: "PRICE_EQUALS" };

    const saveSimple = () => {
        const price = parseFloat(simplePrice);
        if (!price || price <= 0) { toast.error("Enter a valid price"); return; }
        setSaving(true);
        createAlert({
            symbol: stock.symbol, name: stock.name, exchange: stock.exchange || "NSE",
            alertType: CONDITION_TO_TYPE[condition],
            targetPrice: price,
        })
            .then(() => { toast.success("Alert created"); onCreated?.(); onClose(); })
            .catch(() => toast.error("Couldn't create alert"))
            .finally(() => setSaving(false));
    };

    const saveTradeSetup = () => {
        const e = parseFloat(entry), t = parseFloat(target), s = parseFloat(stopLoss);
        if (!e || !t || !s) { toast.error("Fill in entry, target, and stop-loss"); return; }
        setSaving(true);
        createTradeSetupAlert({
            symbol: stock.symbol, name: stock.name, exchange: stock.exchange || "NSE",
            category,
            entryPrice: e, targetPrice: t, stopLossPrice: s,
        })
            .then(() => { toast.success("Trade setup alert created"); onCreated?.(); onClose(); })
            .catch((err) => {
                const msg = err?.response?.data?.message || "Couldn't create trade setup";
                toast.error(msg);
            })
            .finally(() => setSaving(false));
    };

    const onPickFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setExtracting(true);
        setAiNote(null);
        extractTradeSetup(file)
            .then(res => {
                const d = res.data || {};
                if (d.entryPrice != null) setEntry(String(d.entryPrice));
                if (d.targetPrice != null) setTarget(String(d.targetPrice));
                if (d.stopLossPrice != null) setStopLoss(String(d.stopLossPrice));
                setAiNote(d.message || d.extractionNote || null);
                if (d.entryPrice == null && d.targetPrice == null && d.stopLossPrice == null) {
                    toast.error("Couldn't read levels from this image — enter them manually");
                } else {
                    toast.success("Chart read — review the levels below");
                }
            })
            .catch((err) => {
                const msg = err?.response?.data?.message || "Couldn't read the chart";
                toast.error(msg);
            })
            .finally(() => {
                setExtracting(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            });
    };

    const tabBtn = (id, label) => (
        <button onClick={() => setTab(id)}
                className={"flex-1 text-sm font-semibold py-2 rounded-xl transition-colors " +
                    (tab === id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white")}>
            {label}
        </button>
    );

    return createPortal(
        <div className="fixed inset-0 z-[9702] flex items-end sm:items-center justify-center"
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

                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <div>
                        <p className="text-white font-bold text-base">New Alert</p>
                        <p className="text-slate-500 text-xs">{stock?.symbol}</p>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
                     className="px-4 py-4">

                    {/* Existing alerts on this stock — shown before the form so
                        it's clear what's already set before adding another. */}
                    {existingAlerts === null ? (
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-4">
                            <span className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                            Checking existing alerts…
                        </div>
                    ) : existingAlerts.length > 0 && (
                        <div className="mb-4">
                            <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide mb-2">
                                Existing alerts ({existingAlerts.length})
                            </p>
                            <div className="space-y-1.5">
                                {(() => {
                                    const simple = existingAlerts.filter(a => a.tradeSetupId == null);
                                    const setupGroups = Object.values(
                                        existingAlerts
                                            .filter(a => a.tradeSetupId != null)
                                            .reduce((acc, a) => {
                                                (acc[a.tradeSetupId] ||= []).push(a);
                                                return acc;
                                            }, {})
                                    );
                                    const LABEL = {
                                        PRICE_ABOVE: "Above", PRICE_BELOW: "Below", PRICE_EQUALS: "Equals",
                                        PCT_UP: "Up", PCT_DOWN: "Down",
                                    };
                                    return (
                                        <>
                                            {simple.map(a => (
                                                <div key={a.id}
                                                     className="flex items-center justify-between bg-slate-800/70 border border-slate-700/60 rounded-lg px-3 py-2">
                                                    <span className="text-xs text-slate-300">
                                                        <span className={a.isEnabled && !a.triggeredAt ? "text-white font-semibold" : "text-slate-500"}>
                                                            {LABEL[a.alertType] || a.alertType}
                                                        </span>
                                                        {" "}₹{parseFloat(a.computedTarget || a.targetPrice || 0).toLocaleString("en-IN")}
                                                        {a.triggeredAt && <span className="text-slate-600 ml-1.5">· fired</span>}
                                                        {!a.isEnabled && !a.triggeredAt && <span className="text-slate-600 ml-1.5">· off</span>}
                                                    </span>
                                                    <button onClick={() => removeExistingAlert(a)} disabled={deletingId === a.id}
                                                            className="text-slate-500 hover:text-red-400 text-xs disabled:opacity-40 px-1">
                                                        {deletingId === a.id ? "…" : "✕"}
                                                    </button>
                                                </div>
                                            ))}
                                            {setupGroups.map(group => (
                                                <div key={group[0].tradeSetupId}
                                                     className="flex items-center justify-between bg-slate-800/70 border border-slate-700/60 rounded-lg px-3 py-2">
                                                    <span className="text-xs text-slate-300">
                                                        <span className="text-white font-semibold">Trade setup</span>
                                                        {" "}— {group.length} linked alert{group.length === 1 ? "" : "s"}
                                                        {group.some(a => a.triggeredAt) && <span className="text-slate-600 ml-1.5">· partly fired</span>}
                                                    </span>
                                                    <button onClick={() => removeExistingAlert(group[0])} disabled={deletingId === group[0].id}
                                                            className="text-slate-500 hover:text-red-400 text-xs disabled:opacity-40 px-1">
                                                        {deletingId === group[0].id ? "…" : "✕"}
                                                    </button>
                                                </div>
                                            ))}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        {tabBtn("simple", "Simple condition")}
                        {tabBtn("setup", "Trade setup")}
                    </div>

                    {tab === "simple" ? (
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">Condition</p>
                                <div className="flex gap-2">
                                    {[["above", "≥ Above"], ["below", "≤ Below"], ["equals", "= Equals"]].map(([id, label]) => (
                                        <button key={id} onClick={() => setCondition(id)}
                                                className={"flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors " +
                                                    (condition === id
                                                        ? "bg-blue-600/20 border-blue-500 text-blue-300"
                                                        : "bg-slate-800 border-slate-700 text-slate-400")}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">Target price</p>
                                <input type="number" value={simplePrice} onChange={e => setSimplePrice(e.target.value)}
                                       placeholder="0.00"
                                       className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                                                  text-white text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <button onClick={saveSimple} disabled={saving}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                               text-white text-sm font-semibold rounded-xl transition-colors">
                                {saving ? "Creating…" : "Create alert"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                                Get notified when entry, target, or stop-loss is hit — each level pings separately.
                            </p>

                            {/* Category tag */}
                            <button onClick={() => setCategory(prev => prev === "EXPRESS_TRADE" ? null : "EXPRESS_TRADE")}
                                    className={"w-full text-xs font-semibold py-2 rounded-lg border transition-colors " +
                                        (category === "EXPRESS_TRADE"
                                            ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                                            : "bg-slate-800 border-slate-700 text-slate-400")}>
                                ⚡ {category === "EXPRESS_TRADE" ? "Tagged: Express Trade ✓" : "Tag as Express Trade"}
                            </button>

                            {/* AI upload */}
                            <div className="border border-dashed border-slate-700 rounded-xl p-4 text-center">
                                <p className="text-2xl mb-1">📷</p>
                                <p className="text-xs text-slate-400 mb-2">
                                    Upload a chart screenshot — AI reads entry, target, and stop-loss
                                </p>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile}
                                       className="hidden" id="trade-setup-file" />
                                <label htmlFor="trade-setup-file"
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

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <p className="text-[10px] text-slate-500 mb-1">Entry</p>
                                    <input type="number" value={entry} onChange={e => setEntry(e.target.value)}
                                           placeholder="0.00"
                                           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                                                      text-white text-xs focus:outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-green-500 mb-1">Target</p>
                                    <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                                           placeholder="0.00"
                                           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                                                      text-white text-xs focus:outline-none focus:border-green-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-red-500 mb-1">Stop-loss</p>
                                    <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                                           placeholder="0.00"
                                           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2
                                                      text-white text-xs focus:outline-none focus:border-red-500" />
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-600">
                                Entry & stop-loss ping twice (immediate + a follow-up if still active).
                                Target pings once.
                            </p>

                            <button onClick={saveTradeSetup} disabled={saving}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                               text-white text-sm font-semibold rounded-xl transition-colors">
                                {saving ? "Creating…" : "Confirm and create alert"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}