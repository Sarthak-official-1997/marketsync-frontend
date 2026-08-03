// src/components/SimpleAlertModal.jsx
// Standalone "Simple Alert" flow. Search now uses the shared SearchPickerModal
// (same consistent popup as Watchlist's add-stock search), instead of an
// inline top-of-body search field — one search experience everywhere in
// the app, not a different one per screen.

import { useState } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { searchStocks, createAlert } from "../api/portfolio";
import SearchPickerModal from "./SearchPickerModal";
import StockConfirmPreview from "./StockConfirmPreview";

export default function SimpleAlertModal({ onClose }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [stock, setStock] = useState(null);   // null = still searching
    const [candidate, setCandidate] = useState(null); // picked from search, awaiting confirm
    const [condition, setCondition] = useState("above");
    const [price, setPrice] = useState("");
    const [saving, setSaving] = useState(false);

    const CONDITION_TO_TYPE = { above: "PRICE_ABOVE", below: "PRICE_BELOW", equals: "PRICE_EQUALS" };

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

    // Step 1.5: a stock has been picked from search but not yet confirmed —
    // THIS CHECK MUST COME BEFORE THE "!stock" SEARCH CHECK BELOW. Same
    // ordering bug found and fixed in QuickTradeModal: with "!stock" checked
    // first, it returned unconditionally and made this candidate check
    // unreachable dead code — the search screen would show forever no
    // matter what was clicked.
    if (candidate && !stock) {
        return (
            <StockConfirmPreview
                stock={candidate}
                onConfirm={() => setStock(candidate)}
                onCancel={() => setCandidate(null)}
            />
        );
    }

    // Step 1: no stock chosen yet — the shared search popup handles this
    // entire step (search box, results, keyboard-avoidance, positioning).
    if (!stock) {
        return (
            <SearchPickerModal
                title="🔔 Simple Alert"
                placeholder="Search a stock to set an alert on…"
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

    // Step 2: stock chosen — condition + price + create.
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
                     minHeight: "340px", maxHeight: "80vh",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <div>
                        <p className="text-white font-bold text-base">🔔 Simple Alert</p>
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
            </div>
        </div>,
        document.body
    );
}