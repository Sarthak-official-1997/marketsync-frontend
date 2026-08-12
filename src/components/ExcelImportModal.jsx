// src/components/ExcelImportModal.jsx
// "Import Excel" — a distinct, separate entry point from the image-based AI
// trade import, so the person never has to guess whether AI Import handles
// spreadsheets. Upload .xlsx/.xls/.csv → AI reads it → review/edit each
// extracted row as a card (not a table — tables don't work on mobile) →
// confirm creates the real transactions.

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { importExcelPreview, confirmExcelImport } from "../api/portfolio";

function RowCard({ row, onChange, onRemove }) {
    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 sm:p-4 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between gap-2">
                {/* BUG FIXED HERE: this input was a fixed w-28 (112px)
                    regardless of screen size — "ANANT RAJ LIMITED" and
                    "AZAD ENGINEERING" both truncated mid-word even with
                    the whole rest of the modal sitting empty next to them.
                    flex-1 min-w-0 lets it actually use the space the wider
                    modal below now provides, on both mobile and desktop. */}
                <input value={row.symbol || ""} onChange={e => onChange({ ...row, symbol: e.target.value.toUpperCase() })}
                       title={row.symbol}
                       className="bg-transparent text-white font-bold text-sm sm:text-base focus:outline-none border-b
                                  border-transparent focus:border-blue-500 flex-1 min-w-0" />
                <button onClick={onRemove} className="text-slate-500 hover:text-red-400 text-xs flex-shrink-0">Remove</button>
            </div>
            {row.warning && (
                <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1">
                    ⚠️ {row.warning}
                </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="flex gap-1 sm:gap-2">
                    {["BUY", "SELL"].map(t => (
                        <button key={t} onClick={() => onChange({ ...row, type: t })}
                                className={"flex-1 text-[11px] sm:text-xs font-semibold py-1.5 sm:py-2 rounded-lg border transition-colors " +
                                    (row.type === t
                                        ? (t === "BUY" ? "bg-green-600/20 border-green-500 text-green-300" : "bg-red-600/20 border-red-500 text-red-300")
                                        : "bg-slate-800 border-slate-700 text-slate-400")}>
                            {t}
                        </button>
                    ))}
                </div>
                <input type="date" value={row.transactionDate || ""} onChange={e => onChange({ ...row, transactionDate: e.target.value })}
                       className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 sm:py-2 text-white text-xs sm:text-sm
                                  focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                    <p className="text-[9px] sm:text-[10.5px] text-slate-500 mb-0.5">Qty</p>
                    <input type="number" value={row.quantity ?? ""} onChange={e => onChange({ ...row, quantity: e.target.value })}
                           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 sm:py-2 text-white text-xs sm:text-sm
                                      focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                    <p className="text-[9px] sm:text-[10.5px] text-slate-500 mb-0.5">Price/share</p>
                    <input type="number" value={row.pricePerShare ?? ""} onChange={e => onChange({ ...row, pricePerShare: e.target.value })}
                           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 sm:py-2 text-white text-xs sm:text-sm
                                      focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                    <p className="text-[9px] sm:text-[10.5px] text-slate-500 mb-0.5">Fees</p>
                    <input type="number" value={row.fees ?? 0} onChange={e => onChange({ ...row, fees: e.target.value })}
                           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 sm:py-2 text-white text-xs sm:text-sm
                                      focus:outline-none focus:border-blue-500" />
                </div>
            </div>
        </div>
    );
}

export default function ExcelImportModal({ onClose, onImported }) {
    const isMobile = useMobile();
    const toast = useToast();
    const fileInputRef = useRef(null);

    const [stage, setStage] = useState("upload"); // "upload" | "preview" | "result"
    const [uploading, setUploading] = useState(false);
    const [rows, setRows] = useState([]);
    const [previewMsg, setPreviewMsg] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState(null);

    const onPickFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        importExcelPreview(file)
            .then(res => {
                const d = res.data || {};
                setRows(d.rows || []);
                setPreviewMsg(d.message || null);
                setStage("preview");
                if (!d.rows || d.rows.length === 0) {
                    toast.error("Couldn't extract any transactions from this file");
                }
            })
            .catch((err) => {
                toast.error(err?.response?.data?.message || "Couldn't read this file");
            })
            .finally(() => {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            });
    };

    const updateRow = (idx, next) => {
        setRows(prev => prev.map((r, i) => i === idx ? next : r));
    };
    const removeRow = (idx) => {
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const confirm = () => {
        if (rows.length === 0) { toast.error("No rows to import"); return; }
        setConfirming(true);
        confirmExcelImport(rows)
            .then(res => {
                setResult(res.data);
                setStage("result");
                if (res.data.created > 0) onImported?.();
            })
            .catch(() => toast.error("Import failed — please try again"))
            .finally(() => setConfirming(false));
    };

    // BUG FIXED HERE: 480px, then 640px — both were still fixed numbers,
    // not "dynamic." A fixed maxWidth means the modal stops growing the
    // instant it hits that number, no matter how much wider the screen
    // gets past that point — on a large monitor it just sits there small
    // with empty space on both sides, exactly what the screenshot showed.
    // clamp(min, preferred, max) actually scales continuously with the
    // viewport: 55vw as the fluid middle term means it keeps growing as
    // the window grows, never below 460px (still fine on a small laptop
    // window) and never above 880px (so it doesn't become absurd on an
    // ultrawide monitor).
    const desktopStyle = {
        width: "clamp(460px, 55vw, 880px)",
        minHeight: "420px", maxHeight: "88vh",
        borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
    };
    const mobileStyle = {
        width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
        borderRadius: 0, border: "none",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        overflowX: "hidden",
    };

    return createPortal(
        <div className="fixed inset-0 z-[9650] flex items-end sm:items-center justify-center"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9651] bg-slate-900 flex flex-col"
                 style={isMobile ? mobileStyle : desktopStyle}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <p className="text-white font-bold text-base">📊 Import Excel</p>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
                     className="px-4 py-4">

                    {stage === "upload" && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-300">
                                Import your existing holdings or transactions from an Excel or CSV
                                file exported from any broker (Zerodha, Groww, Upstox, etc.).
                            </p>
                            <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center">
                                <p className="text-3xl mb-2">📊</p>
                                <p className="text-xs text-slate-400 mb-3">
                                    Upload a .xlsx, .xls, or .csv file — AI reads the columns
                                    automatically, whatever format your broker uses.
                                </p>
                                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onPickFile}
                                       className="hidden" id="excel-import-file" />
                                <label htmlFor="excel-import-file"
                                       className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                                  text-sm font-semibold rounded-xl cursor-pointer transition-colors">
                                    {uploading ? "Reading file…" : "Choose file"}
                                </label>
                            </div>
                            <p className="text-[11px] text-slate-600 text-center">
                                Nothing is saved until you review and confirm each row.
                            </p>
                        </div>
                    )}

                    {stage === "preview" && (
                        <div className="space-y-3">
                            {previewMsg && (
                                <p className="text-xs text-slate-400 bg-slate-800/60 rounded-lg px-3 py-2">
                                    {previewMsg}
                                </p>
                            )}
                            {rows.map((row, i) => (
                                <RowCard key={i} row={row}
                                         onChange={(next) => updateRow(i, next)}
                                         onRemove={() => removeRow(i)} />
                            ))}
                            {rows.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-8">
                                    No rows left to import.
                                </p>
                            )}
                        </div>
                    )}

                    {stage === "result" && result && (
                        <div className="space-y-3">
                            <div className="text-center py-4">
                                <p className="text-3xl mb-2">{result.failed === 0 ? "✅" : "⚠️"}</p>
                                <p className="text-white font-bold">
                                    {result.created} imported{result.failed > 0 ? `, ${result.failed} failed` : ""}
                                </p>
                            </div>
                            {result.results.filter(r => !r.success).map(r => (
                                <div key={r.rowNumber} className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                                    <p className="text-red-300 text-xs font-semibold">{r.symbol}</p>
                                    <p className="text-red-400/80 text-[11px]">{r.error}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {stage === "preview" && (
                    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/60">
                        <button onClick={confirm} disabled={confirming || rows.length === 0}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                           text-white text-sm font-semibold rounded-xl transition-colors">
                            {confirming ? "Importing…" : `Confirm and import ${rows.length} transactions`}
                        </button>
                    </div>
                )}
                {stage === "result" && (
                    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/60">
                        <button onClick={onClose}
                                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white
                                           text-sm font-semibold rounded-xl transition-colors">
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}