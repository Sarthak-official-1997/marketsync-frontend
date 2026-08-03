// src/components/StockInfoModal.jsx
// Read-only version — just the info, a close button, nothing to confirm.
// For anywhere the app wants to show "here's what this stock is doing
// right now" about an ALREADY-chosen stock — e.g. tapping a linked stock
// chip in a Note. No Cancel/Confirm chrome, since nothing is being decided.

import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import StockInfoCard from "./StockInfoCard";

export default function StockInfoModal({ stock, onClose }) {
    const isMobile = useMobile();

    return createPortal(
        <div className="fixed inset-0 z-[9660] flex items-end sm:items-center justify-center"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9661] bg-slate-900 flex flex-col"
                 style={isMobile ? {
                     width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
                     borderRadius: 0, border: "none",
                     paddingTop: "env(safe-area-inset-top, 0px)",
                     paddingBottom: "env(safe-area-inset-bottom, 0px)",
                     overflowX: "hidden",
                 } : {
                     width: "calc(100vw - 32px)", maxWidth: "420px",
                     height: "500px",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-end px-4 py-3 border-b border-slate-700/60">
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }} className="px-4 py-4">
                    <StockInfoCard stock={stock} />
                </div>
            </div>
        </div>,
        document.body
    );
}