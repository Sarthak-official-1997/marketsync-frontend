// src/components/SimpleAlertModal.jsx
// Standalone "Simple Alert" flow — search is built in here, so opening this
// from the bubble goes straight to search → condition → price, no
// intermediate "which type of alert" choice (that choice was already made
// by tapping the Simple Alert bubble). Mobile: full-screen. Desktop:
// centered with a real minHeight so short content never collapses the card.

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { searchStocks, createAlert } from "../api/portfolio";

export default function SimpleAlertModal({ onClose }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [stock, setStock] = useState(null);   // chosen stock, or null = still searching
    const debRef = useRef(null);

    const [condition, setCondition] = useState("above");
    const [price, setPrice] = useState("");
    const [saving, setSaving] = useState(false);

    const CONDITION_TO_TYPE = { above: "PRICE_ABOVE", below: "PRICE_BELOW", equals: "PRICE_EQUALS" };

    const onQueryChange = (val) => {
        setQuery(val);
        clearTimeout(debRef.current);
        if (val.trim().length < 2) { setResults([]); return; }
        setSearching(true);
        debRef.current = setTimeout(() => {
            searchStocks(val).then(res => {
                setResults((res.data?.content || res.data || []).slice(0, 8));
            }).catch(() => setResults([])).finally(() => setSearching(false));
        }, 300);
    };

    const save = () => {
        const p = parseFloat(price);
        if (!p || p <= 0) { toast.error("Enter a valid price"); return; }
        setSaving(true);
        createAlert({
            symbol: stock.symbol, name: stock.name, exchange: stock.exchange || "NSE",
            alertType: CONDITION_TO_TYPE[condition],
            targetPrice: p,
        })
            .then(() => { toast.success("Alert created"); onClose(); })
            .catch(() => toast.error("Couldn't create alert"))
            .finally(() => setSaving(false));
    };

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
                     width: "calc(100vw - 32px)", maxWidth: "420px",
                     minHeight: "360px", maxHeight: "80vh",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <p className="text-white font-bold text-base">🔔 Simple Alert</p>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
                     className="px-4 py-4">

                    {!stock ? (
                        <div>
                            <p className="text-xs text-slate-500 mb-2">Search a stock to set an alert on</p>
                            <input
                                autoFocus
                                value={query}
                                onChange={e => onQueryChange(e.target.value)}
                                placeholder="e.g. HDFCBANK"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                                           text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                            {searching && <p className="text-xs text-slate-500 mt-2">Searching…</p>}
                            {results.length > 0 && (
                                <div className="mt-2 rounded-xl border border-slate-700 overflow-hidden max-h-72 overflow-y-auto">
                                    {results.map(s => (
                                        <button key={s.id || s.symbol} onClick={() => setStock(s)}
                                                className="w-full flex items-center justify-between px-3 py-2.5
                                                           hover:bg-slate-700/60 transition-colors text-left
                                                           border-b border-slate-700/40 last:border-0">
                                            <div className="min-w-0">
                                                <p className="text-white text-sm font-bold">{s.symbol}</p>
                                                <p className="text-slate-500 text-xs truncate">{s.name}</p>
                                            </div>
                                            {s.exchange && (
                                                <span className="text-[10px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                                                    {s.exchange}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button onClick={() => { setStock(null); setResults([]); setQuery(""); }}
                                    className="text-xs text-slate-400 hover:text-white">← Change stock</button>
                            <p className="text-white font-semibold text-sm">{stock.symbol}</p>

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
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                                       placeholder="0.00"
                                       className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                                                  text-white text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <button onClick={save} disabled={saving}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                               text-white text-sm font-semibold rounded-xl transition-colors">
                                {saving ? "Creating…" : "Create alert"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}