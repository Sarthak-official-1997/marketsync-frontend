// src/pages/TrackedClientDetailPage.jsx
// Creator-only. One tracked client's full picture: their holdings (with a
// live comparison against real data once mapped), the map-to-user action,
// and three ways to add a holding — manual entry, Excel/CSV import, or an
// AI-read screenshot. The Sync button always shows a confirmation prompt
// first; nothing overwrites the reference copy without it.

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { searchStocks } from "../api/portfolio";
import { getAllUsers } from "../api/admin";
import SearchPickerModal from "../components/SearchPickerModal";
import StockConfirmPreview from "../components/StockConfirmPreview";
import TransactionsStagingModal from "../components/TransactionsStagingModal";
import PushReviewModal from "../components/PushReviewModal";
import {
    getTrackedClient, deleteTrackedClient, mapTrackedClient,
    addTrackedHolding, deleteTrackedHolding,
    previewExcelHoldings, confirmExcelHoldings,
    previewScreenshotHoldings, confirmScreenshotHoldings,
    syncTrackedHolding, getStagedEdits,
} from "../api/clientTracker";

// ── Map-to-user picker ────────────────────────────────────────────────────
function MapUserPicker({ onPick, onClose }) {
    const [users, setUsers] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const loadUsers = () => {
        setLoading(true);
        setLoadError(false);
        getAllUsers()
            .then(setUsers)
            .catch(() => setLoadError(true))   // was silently swallowed before —
            .finally(() => setLoading(false)); // a failed fetch looked identical
    };                                          // to "no matching users"

    useEffect(() => { loadUsers(); }, []);

    const filtered = users.filter(u =>
        (u.username || "").toLowerCase().includes(query.toLowerCase()) ||
        (u.fullName || "").toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[9700] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <div className="relative z-[9701] bg-slate-900 border border-slate-700/60 rounded-2xl
                            w-full max-w-sm mx-4 flex flex-col"
                 style={{
                     // A real height, not just maxHeight — with only maxHeight, this
                     // card shrinks to fit its content and the results list gets
                     // squeezed into almost no visible space. Same bug already found
                     // and fixed in SearchPickerModal/TradeSetupModal/AiChatModal —
                     // this is now a standing rule: every scrollable modal in this
                     // app gets a real height (or minHeight), never maxHeight alone.
                     height: "min(70vh, 480px)",
                 }}
                 onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/60">
                    <p className="text-white font-bold text-sm mb-2">Map to a registered user</p>
                    <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                           placeholder="Search username or name…"
                           className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
                                      text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div style={{ flex: "1 1 0", overflowY: "auto" }} className="px-2 py-2">
                    {loading ? (
                        <p className="text-slate-500 text-xs text-center py-6">Loading users…</p>
                    ) : loadError ? (
                        <div className="text-center py-6">
                            <p className="text-red-400 text-xs mb-2">Couldn't load the user list</p>
                            <button onClick={loadUsers}
                                    className="text-blue-400 hover:text-blue-300 text-xs font-semibold">
                                Try again
                            </button>
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-slate-500 text-xs text-center py-6">No registered users yet</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-slate-500 text-xs text-center py-6">No matches for "{query}"</p>
                    ) : filtered.map(u => (
                        <button key={u.id} onClick={() => onPick(u.id)}
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">
                            <p className="text-white text-sm font-semibold">{u.fullName || u.username}</p>
                            <p className="text-slate-500 text-xs">@{u.username}</p>
                        </button>
                    ))}
                </div>
                <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/60">
                    <button onClick={onClose}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white
                                       text-sm font-semibold rounded-xl transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── One holding row, with live comparison + sync + direct push + edit ────
function HoldingRow({ holding, mapped, onDelete, onSync, onOpenPush, onEdit, onViewTransactions }) {
    const [confirming, setConfirming] = useState(null); // "sync" | null
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editQty, setEditQty] = useState(holding.quantity ?? "");
    const [editPrice, setEditPrice] = useState(holding.avgBuyPrice ?? "");
    const [editDate, setEditDate] = useState(holding.estimatedBuyDate ?? "");

    const fmt = (n) => n == null ? "—" : parseFloat(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

    const saveEdit = async () => {
        if (!editQty || !editPrice) return;
        setBusy(true);
        await onEdit(holding, { quantity: parseFloat(editQty), avgBuyPrice: parseFloat(editPrice), estimatedBuyDate: editDate || null });
        setBusy(false);
        setEditing(false);
    };

    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3">
            {/* Name and action buttons are on SEPARATE rows, always — the
                previous single-row "flex justify-between" packed the stock
                name and three action links (View Transactions / Edit /
                Remove) side by side, and in a narrower grid card the button
                row wrapped to two lines and visually collided with the name/
                description underneath it. Stacking removes the competition
                for horizontal space entirely, at any card width. */}
            <div className="mb-1.5">
                <p className="text-white font-bold text-sm">{holding.symbol}</p>
                <p className="text-slate-500 text-[11px] truncate">{holding.name}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
                {mapped && (
                    <button onClick={() => onViewTransactions(holding)}
                            className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                        View Transactions
                    </button>
                )}
                <button onClick={() => { setEditing(v => !v); setConfirming(null); }}
                        className="text-xs text-slate-400 hover:text-white font-semibold">
                    Edit
                </button>
                <button onClick={() => onDelete(holding)} className="text-xs text-slate-500 hover:text-red-400">
                    Remove
                </button>
            </div>

            {editing ? (
                <div className="mt-2 bg-slate-900 rounded-xl p-2.5 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} placeholder="Qty"
                               className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                        <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="Avg price"
                               className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                               className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setEditing(false)}
                                className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">
                            Cancel
                        </button>
                        <button onClick={saveEdit} disabled={busy}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg">
                            {busy ? "Saving…" : "Set"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                    <div>
                        <p className="text-slate-500 mb-0.5">Your reference</p>
                        <p className="text-white font-semibold">{fmt(holding.quantity)} sh @ ₹{fmt(holding.avgBuyPrice)}</p>
                        {holding.estimatedBuyDate && (
                            <p className="text-slate-600 text-[10px]">~{holding.estimatedBuyDate}</p>
                        )}
                    </div>
                    {mapped && (
                        <div>
                            <p className="text-slate-500 mb-0.5">Their real holding</p>
                            {holding.realQuantity != null ? (
                                <p className="text-white font-semibold">
                                    {fmt(holding.realQuantity)} sh @ ₹{fmt(holding.realAvgBuyPrice)}
                                </p>
                            ) : (
                                <p className="text-slate-600">Not held</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {mapped && !editing && (
                <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className={"text-[11px] font-semibold " +
                        (holding.inSync ? "text-green-400" : "text-amber-400")}>
                        {holding.inSync ? "✓ In sync" : "⚠ Out of sync"}
                    </span>
                    <div className="flex items-center gap-3">
                        {/* Pull is a "check for fresh changes" action, not just
                            a fix for an already-detected mismatch — it was
                            previously hidden the moment inSync became true
                            (e.g. right after a successful Push), which meant
                            there was no way to re-check later if the real
                            account changed again afterward. Always available
                            now, same as Push, regardless of last-known sync
                            state. */}
                        {confirming !== "sync" && (
                            <button onClick={() => setConfirming("sync")}
                                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">
                                Pull from real →
                            </button>
                        )}
                        <button onClick={() => onOpenPush(holding)}
                                className="text-[11px] font-semibold text-green-400 hover:text-green-300">
                            ⬆ Push →
                        </button>
                    </div>
                </div>
            )}

            {confirming === "sync" && (
                <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                    <p className="text-amber-300 text-[11px] mb-2">
                        Have you acknowledged the changes? This will overwrite your reference
                        copy to match their real holding — cannot be undone.
                    </p>
                    <div className="flex gap-2">
                        <button onClick={() => setConfirming(null)}
                                className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white
                                           text-xs font-semibold rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button onClick={async () => { setBusy(true); await onSync(holding); setBusy(false); setConfirming(null); }}
                                disabled={busy}
                                className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40
                                           text-white text-xs font-semibold rounded-lg transition-colors">
                            {busy ? "Syncing…" : "Confirm sync"}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

// ── Manual add form ───────────────────────────────────────────────────────
function ManualAddForm({ onAdd }) {
    const [stock, setStock] = useState(null);
    const [candidate, setCandidate] = useState(null); // picked from search, awaiting confirm
    const [showSearch, setShowSearch] = useState(true);
    const [qty, setQty] = useState("");
    const [price, setPrice] = useState("");
    const [date, setDate] = useState("");

    const submit = () => {
        if (!stock || !qty || !price) return;
        onAdd({ stockId: stock.id, quantity: parseFloat(qty), avgBuyPrice: parseFloat(price), estimatedBuyDate: date || null });
        setStock(null); setCandidate(null); setQty(""); setPrice(""); setDate(""); setShowSearch(true);
    };

    return (
        <div className="space-y-2">
            {!stock ? (
                <>
                    {showSearch && (
                        <SearchPickerModal
                            title="Add holding"
                            placeholder="Search stock…"
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
                            onPick={(item) => { setCandidate(item); setShowSearch(false); }}
                            onClose={() => setShowSearch(false)}
                        />
                    )}
                    {candidate && (
                        <StockConfirmPreview
                            stock={candidate}
                            onConfirm={() => { setStock(candidate); setCandidate(null); }}
                            onCancel={() => { setCandidate(null); setShowSearch(true); }}
                        />
                    )}
                </>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <p className="text-white text-sm font-semibold">{stock.symbol}</p>
                        <button onClick={() => { setStock(null); setShowSearch(true); }}
                                className="text-xs text-slate-400 hover:text-white">Change</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty"
                               className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs" />
                        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Avg price"
                               className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs" />
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                               className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs" />
                    </div>
                    <button onClick={submit}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                        Add holding
                    </button>
                </>
            )}
        </div>
    );
}

export default function TrackedClientDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [addMode, setAddMode] = useState(null); // "manual" | "excel" | "screenshot" | null
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [excelRows, setExcelRows] = useState(null);
    const [screenshotTrades, setScreenshotTrades] = useState([]); // all trades from all uploaded screenshots
    const [extracting, setExtracting] = useState(false);
    const fileRef = useRef(null);

    const [viewingTransactionsFor, setViewingTransactionsFor] = useState(null); // holding, or null
    const [showPushReview, setShowPushReview] = useState(false);
    const [pushStockId, setPushStockId] = useState(null); // null = Push All, set = one stock
    const [stagedCount, setStagedCount] = useState(0);

    const load = () => {
        setLoading(true);
        getTrackedClient(id)
            .then(res => setClient(res.data))
            .catch(() => toast.error("Couldn't load this client"))
            .finally(() => setLoading(false));
    };
    const loadStagedCount = () => {
        getStagedEdits(id).then(res => setStagedCount((res.data || []).length)).catch(() => {});
    };
    useEffect(() => { load(); loadStagedCount(); }, [id]);

    const onMap = (userId) => {
        mapTrackedClient(id, userId)
            .then(() => { toast.success("Mapped"); setShowMapPicker(false); load(); })
            .catch((err) => toast.error(err?.response?.data?.message || "Couldn't map"));
    };

    const onAddManual = (req) => {
        addTrackedHolding(id, req)
            .then(() => { toast.success("Holding added"); setAddMode(null); load(); loadStagedCount(); })
            .catch(() => toast.error("Couldn't add holding"));
    };

    const onDeleteHolding = (holding) => {
        deleteTrackedHolding(id, holding.stockId || holding.id)
            .then(() => { toast.success("Removed"); load(); })
            .catch(() => toast.error("Couldn't remove"));
    };

    const onSync = (holding) => {
        return syncTrackedHolding(id, holding.stockId || holding.id, true)
            .then(() => { toast.success("Synced"); load(); })
            .catch(() => toast.error("Sync failed"));
    };

    const onEditHolding = (holding, values) => {
        return addTrackedHolding(id, { stockId: holding.stockId || holding.id, ...values })
            .then(() => { toast.success("Updated"); loadStagedCount(); load(); })
            .catch(() => toast.error("Couldn't save changes"));
    };

    // Opens the real, review-then-confirm Push flow — stockId null means
    // "Push All" (everything staged for this client); a specific stockId
    // scopes it to just that one stock's staged changes.
    const openPush = (stockId) => { setPushStockId(stockId); setShowPushReview(true); };

    const onExcelFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        previewExcelHoldings(id, file)
            .then(res => setExcelRows(res.data.rows || []))
            .catch(() => toast.error("Couldn't read this file"))
            .finally(() => { if (fileRef.current) fileRef.current.value = ""; });
    };
    const confirmExcel = () => {
        confirmExcelHoldings(id, excelRows)
            .then(() => { toast.success("Holdings imported"); setExcelRows(null); setAddMode(null); load(); loadStagedCount(); })
            .catch(() => toast.error("Import failed"));
    };

    const [dragActive, setDragActive] = useState(false);
    const [extractionMessage, setExtractionMessage] = useState(null);

    // Processes MULTIPLE screenshots at once — ALL of them go to the backend
    // in ONE request, so Gemini sees every image together. This matters a
    // lot: if someone scrolled a wide portfolio table and screenshotted it
    // in 3 pieces (different columns each time), sending them together lets
    // the model recognize "same stock, same table" and produce one clean
    // holding per stock — sending them separately (the old approach) is
    // exactly what caused a real 6-stock portfolio to come out as 10 wrong
    // "holdings" with mismatched prices.
    const processScreenshotFiles = async (fileList) => {
        const files = Array.from(fileList || []).filter(f => f && f.type?.startsWith("image/"));
        if (files.length === 0) {
            toast.error("No images found — please drop, paste, or choose image files");
            return;
        }
        setExtracting(true);
        setExtractionMessage(`Reading ${files.length} screenshot${files.length === 1 ? "" : "s"}…`);
        try {
            const res = await previewScreenshotHoldings(id, files);
            const trades = res.data?.trades || [];
            if (trades.length === 0) {
                toast.error("Couldn't extract any holdings from those screenshots");
            } else {
                setScreenshotTrades(prev => [...prev, ...trades]);
                toast.success(res.data?.message || `Extracted ${trades.length} holding${trades.length === 1 ? "" : "s"}`);
            }
        } catch {
            toast.error("Couldn't read those screenshots — try again or add manually");
        } finally {
            setExtracting(false);
            setExtractionMessage(null);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    // File-picker (click to browse) — supports selecting several files at once
    const onScreenshotFile = (e) => processScreenshotFiles(e.target.files);

    // Drag-and-drop — supports dropping several files at once
    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        processScreenshotFiles(e.dataTransfer.files);
    };

    // Paste (Ctrl+V / Cmd+V) — clipboard only ever holds one image per paste,
    // but pasting again just appends to the growing review list, so several
    // screenshots can still be added one paste at a time.
    const onScreenshotPaste = (e) => {
        const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith("image/"));
        if (item) processScreenshotFiles([item.getAsFile()]);
    };
    const [confirmingScreenshots, setConfirmingScreenshots] = useState(false);

    const removeScreenshotTrade = (idx) => {
        setScreenshotTrades(prev => prev.filter((_, i) => i !== idx));
    };

    const confirmScreenshot = async () => {
        if (screenshotTrades.length === 0) return;
        setConfirmingScreenshots(true);
        try {
            await confirmScreenshotHoldings(id, screenshotTrades);
            toast.success(`${screenshotTrades.length} holding${screenshotTrades.length === 1 ? "" : "s"} imported`);
            setScreenshotTrades([]);
            setAddMode(null);
            load();
            loadStagedCount();
        } catch {
            toast.error("Import failed — please try again");
        } finally {
            setConfirmingScreenshots(false);
        }
    };

    if (loading || !client) {
        return (
            <div className="flex justify-center py-16">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <button onClick={() => navigate("/creator/client-tracker")}
                    className="text-xs text-slate-400 hover:text-white">← All tracked clients</button>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">{client.displayName}</h1>
                    <p className="text-slate-500 text-xs mt-0.5">
                        {client.mappedUsername ? `Mapped to @${client.mappedUsername}` : "Not mapped to a real account"}
                        {" · "}{(client.holdings || []).length} stock{(client.holdings || []).length === 1 ? "" : "s"} tracked
                        {client.mappedUserId && stagedCount > 0 && (
                            <span className="text-green-400"> · {stagedCount} ready to push</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {client.mappedUserId && stagedCount > 0 && (
                        <button onClick={() => openPush(null)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs
                                           font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                            ⬆ Push All
                            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {stagedCount}
                            </span>
                        </button>
                    )}
                    {!client.mappedUserId && (
                        <button onClick={() => setShowMapPicker(true)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs
                                           font-semibold rounded-lg transition-colors">
                            Map to user
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {(client.holdings || []).length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6 col-span-full">No holdings yet — add one below.</p>
                ) : client.holdings.map(h => (
                    <HoldingRow key={h.id} holding={h} mapped={!!client.mappedUserId}
                                onDelete={onDeleteHolding} onSync={onSync}
                                onOpenPush={(h) => openPush(h.stockId || h.id)} onEdit={onEditHolding}
                                onViewTransactions={setViewingTransactionsFor} />
                ))}
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3">
                <div className="flex gap-2 mb-3">
                    {[["manual", "Manual"], ["excel", "Import Excel"], ["screenshot", "Screenshot"]].map(([id2, label]) => (
                        <button key={id2} onClick={() => setAddMode(addMode === id2 ? null : id2)}
                                className={"flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors " +
                                    (addMode === id2 ? "bg-blue-600/20 border-blue-500 text-blue-300" : "bg-slate-800 border-slate-700 text-slate-400")}>
                            {label}
                        </button>
                    ))}
                </div>

                {addMode === "manual" && <ManualAddForm onAdd={onAddManual} />}

                {addMode === "excel" && (
                    <div className="space-y-2">
                        {!excelRows ? (
                            <>
                                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onExcelFile} className="hidden" id="ct-excel" />
                                <label htmlFor="ct-excel" className="block text-center py-3 border border-dashed border-slate-700 rounded-xl
                                                                     text-xs text-slate-400 cursor-pointer hover:border-slate-500">
                                    📊 Upload holdings Excel/CSV
                                </label>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-slate-400">{excelRows.length} rows extracted — review below</p>
                                {excelRows.map((r, i) => <p key={i} className="text-xs text-white">{r.symbol} — {r.quantity} @ ₹{r.pricePerShare}</p>)}
                                <button onClick={confirmExcel} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                                    Confirm import
                                </button>
                            </>
                        )}
                    </div>
                )}

                {addMode === "screenshot" && (
                    <div className="space-y-2">
                        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onScreenshotFile} className="hidden" id="ct-shot" />

                        {/* Drop zone stays available even after some screenshots are queued,
                            so more can be added before confirming — e.g. one screenshot per
                            broker, or a multi-page portfolio export. */}
                        <div
                            tabIndex={0}
                            onPaste={onScreenshotPaste}
                            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={onDrop}
                            onClick={() => fileRef.current?.click()}
                            className={"text-center py-5 px-3 border-2 border-dashed rounded-xl cursor-pointer " +
                                "transition-colors focus:outline-none " +
                                (dragActive
                                    ? "border-blue-500 bg-blue-500/10"
                                    : "border-slate-700 hover:border-slate-500")}>
                            <p className="text-2xl mb-1">📷</p>
                            <p className="text-xs text-slate-300 font-medium">
                                {extracting
                                    ? "Reading screenshots…"
                                    : "Drop one or more screenshots, paste, or click to browse"}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">
                                Works from your phone or laptop — select several files at once, or add them one at a time
                            </p>
                        </div>

                        {/* A real, visible processing panel — not just a tiny spinner easy to
                            miss and mistake for the app being frozen. Shown clearly while
                            Gemini reads and reconciles the uploaded screenshots. */}
                        {extracting && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <div>
                                    <p className="text-blue-300 text-sm font-semibold">{extractionMessage}</p>
                                    <p className="text-blue-400/70 text-[11px] mt-0.5">
                                        This can take a moment for several screenshots — stay on this screen.
                                    </p>
                                </div>
                            </div>
                        )}

                        {screenshotTrades.length > 0 && (
                            <>
                                <p className="text-xs text-slate-400">
                                    {screenshotTrades.length} holding{screenshotTrades.length === 1 ? "" : "s"} extracted — review below
                                </p>
                                {screenshotTrades.map((t, i) => (
                                    <div key={i} className="bg-slate-800 rounded-lg px-3 py-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-white font-semibold">
                                                {t.stockSymbol} — {t.quantity ?? "?"} @ {t.price != null ? `₹${t.price}` : "price unclear"}
                                            </p>
                                            <button onClick={() => removeScreenshotTrade(i)}
                                                    className="text-slate-500 hover:text-red-400 text-xs flex-shrink-0 ml-2">
                                                Remove
                                            </button>
                                        </div>
                                        {t.confidence === "LOW" && (
                                            <p className="text-[10px] text-amber-400 mt-1">
                                                ⚠ Low confidence{t.extractionNote ? ` — ${t.extractionNote}` : " — double-check this before confirming"}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                <button onClick={confirmScreenshot} disabled={confirmingScreenshots}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                                   text-white text-xs font-semibold rounded-lg">
                                    {confirmingScreenshots
                                        ? "Importing…"
                                        : `Confirm import (${screenshotTrades.length})`}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {showMapPicker && <MapUserPicker onPick={onMap} onClose={() => setShowMapPicker(false)} />}

            {viewingTransactionsFor && (
                <TransactionsStagingModal
                    trackedClientId={id}
                    stock={viewingTransactionsFor}
                    onClose={() => setViewingTransactionsFor(null)}
                    onStagedChange={loadStagedCount}
                />
            )}

            {showPushReview && (
                <PushReviewModal
                    trackedClientId={id}
                    stockId={pushStockId}
                    clientName={client.displayName}
                    onClose={() => { setShowPushReview(false); setPushStockId(null); }}
                    onPushed={() => { loadStagedCount(); load(); setPushStockId(null); }}
                />
            )}
        </div>
    );
}