// src/pages/TrackedClientDetailPage.jsx
// Creator-only. One tracked client's full picture: their holdings (with a
// live comparison against real data once mapped), the map-to-user action,
// and three ways to add a holding — manual entry, Excel/CSV import, or an
// AI-read screenshot. The Sync button always shows a confirmation prompt
// first; nothing overwrites the reference copy without it.

import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { searchStocks, getStockPrice } from "../api/portfolio";
import {
    getColumnPrefs, setColumnPrefs, COLUMN_CANDIDATES, PERFORMANCE_COLUMNS_EVENT,
} from "../utils/performanceColumnPrefs";
import { getAllUsers } from "../api/admin";
import SearchPickerModal from "../components/SearchPickerModal";
import StockConfirmPreview from "../components/StockConfirmPreview";
import TransactionsStagingModal from "../components/TransactionsStagingModal";
import PushReviewModal from "../components/PushReviewModal";
import PortfolioValueChart from "../components/PortfolioValueChart";
import StockDetailModal from "../components/StockDetailModal";
import CustomizeColumnsModal from "../components/CustomizeColumnsModal";
import { getClientPortfolioHistory } from "../api/admin";
import {
    getTrackedClient, deleteTrackedClient, mapTrackedClient,
    addTrackedHolding, deleteTrackedHolding,
    previewExcelHoldings, confirmExcelHoldings,
    previewScreenshotHoldings, confirmScreenshotHoldings,
    syncTrackedHolding, getStagedEdits, updateTrackedClientScope,
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

// ── Performance tab: qty / avg price (yours) / LTP / day change / value /
// total gain-loss — one job only, no sync/reference data mixed in. Prices
// are fetched client-side per symbol via the same getStockPrice() endpoint
// StocksMarketPage already uses, so this needed no backend change. ────────
function PerformanceTable({ holdings, onOpenStock }) {
    const [prices, setPrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(true);
    const [columns, setColumns] = useState(() => getColumnPrefs());
    const [showCustomize, setShowCustomize] = useState(false);

    useEffect(() => {
        const onChange = () => setColumns(getColumnPrefs());
        window.addEventListener(PERFORMANCE_COLUMNS_EVENT, onChange);
        return () => window.removeEventListener(PERFORMANCE_COLUMNS_EVENT, onChange);
    }, []);

    useEffect(() => {
        if (!holdings || holdings.length === 0) { setLoadingPrices(false); return; }
        let cancelled = false;
        setLoadingPrices(true);
        Promise.allSettled(holdings.map(h => getStockPrice(h.symbol)))
            .then(results => {
                if (cancelled) return;
                const map = {};
                results.forEach((r, i) => {
                    if (r.status === "fulfilled") map[holdings[i].symbol] = r.value.data;
                });
                setPrices(map);
            })
            .finally(() => { if (!cancelled) setLoadingPrices(false); });
        return () => { cancelled = true; };
    }, [holdings]);

    const fmt = (n) => n == null || isNaN(n) ? "—" : parseFloat(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    const fmtMoney = (n) => n == null || isNaN(n) ? "—" : "₹" + parseFloat(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

    if (!holdings || holdings.length === 0) {
        return <p className="text-slate-500 text-sm text-center py-6">No holdings yet — add one below.</p>;
    }

    const visibleColumns = columns.filter(c => c.visible);

    // One place that knows how to render each column's header + cell, so
    // the table body below is just "loop over visibleColumns" instead of
    // repeating six near-identical <td> blocks conditionally.
    const columnHeader = (colId) => {
        switch (colId) {
            case "qty": return "Qty";
            case "avgPrice": return "Avg. price";
            case "ltp": return "LTP";
            case "dayChange": return "Day change";
            case "value": return "Value";
            case "gainLoss": return "Total gain/loss";
            default: return "";
        }
    };

    const columnCell = (colId, row) => {
        switch (colId) {
            case "qty":
                return <span className="text-slate-300">{fmt(row.qty)}</span>;
            case "avgPrice":
                return <span className="text-slate-300">₹{fmt(row.avg)}</span>;
            case "ltp":
                return (
                    <span className="text-white font-semibold">
                        {loadingPrices ? "…" : (row.ltp != null ? "₹" + fmt(row.ltp) : "—")}
                    </span>
                );
            case "dayChange":
                return (
                    <span className={"font-semibold " +
                        (row.dayChg == null ? "text-slate-600" : row.dayUp ? "text-green-400" : "text-red-400")}>
                        {loadingPrices ? "…" : (row.dayChg != null ? (row.dayUp ? "+" : "") + row.dayChg.toFixed(2) + "%" : "—")}
                    </span>
                );
            case "value":
                return <span className="text-white">{loadingPrices ? "…" : fmtMoney(row.value)}</span>;
            case "gainLoss":
                return (
                    <span className={"font-semibold " +
                        (row.gainLoss == null ? "text-slate-600" : row.glUp ? "text-green-400" : "text-red-400")}>
                        {loadingPrices ? "…" : row.gainLoss != null
                            ? (row.glUp ? "+" : "") + fmtMoney(Math.abs(row.gainLoss)) + " (" + (row.glUp ? "+" : "") + row.gainLossPct.toFixed(2) + "%)"
                            : "—"}
                    </span>
                );
            default:
                return null;
        }
    };

    const rows = holdings.map(h => {
        const p = prices[h.symbol];
        const ltp = p != null ? parseFloat(p.currentPrice ?? p.regularMarketPrice ?? 0) : null;
        const dayChg = p != null ? parseFloat(p.changePercent ?? p.regularMarketChangePercent ?? 0) : null;
        const qty = parseFloat(h.quantity || 0);
        const avg = parseFloat(h.avgBuyPrice || 0);
        const value = ltp != null ? qty * ltp : null;
        const gainLoss = ltp != null ? (ltp - avg) * qty : null;
        const gainLossPct = avg > 0 && ltp != null ? ((ltp - avg) / avg) * 100 : null;
        return {
            holding: h, qty, avg, ltp, dayChg, value, gainLoss, gainLossPct,
            dayUp: dayChg != null && dayChg >= 0,
            glUp: gainLoss != null && gainLoss >= 0,
        };
    });

    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                    <tr className="bg-slate-900/60 text-slate-500 text-[10px] uppercase tracking-wide">
                        <th className="text-left font-semibold px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <span>Stock</span>
                                {/* Matches Google Finance's column-settings icon in the
                                        same header corner — opens the customize modal. */}
                                <button onClick={() => setShowCustomize(true)}
                                        title="Customize columns"
                                        className="text-slate-500 hover:text-white p-0.5 rounded normal-case">
                                    ⚙
                                </button>
                            </div>
                        </th>
                        {visibleColumns.map(c => (
                            <th key={c.id} className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                                {columnHeader(c.id)}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map(row => (
                        <tr key={row.holding.id} className="border-t border-slate-700/40 hover:bg-slate-800/40">
                            <td className="px-3 py-2.5">
                                <button onClick={() => onOpenStock(row.holding)}
                                        className="text-left group">
                                    <p className="text-white font-bold group-hover:text-blue-400 transition-colors">
                                        {row.holding.symbol}
                                    </p>
                                    <p className="text-slate-500 text-[10px] truncate max-w-[140px] group-hover:text-slate-400">
                                        {row.holding.name}
                                    </p>
                                </button>
                            </td>
                            {visibleColumns.map(c => (
                                <td key={c.id} className="text-right px-3 py-2.5 whitespace-nowrap">
                                    {columnCell(c.id, row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-slate-600 px-3 py-2 border-t border-slate-700/40">
                LTP refreshes on tab open — reopen the Performance tab for the latest price.
            </p>

            {showCustomize && (
                <CustomizeColumnsModal
                    columns={columns}
                    onClose={() => setShowCustomize(false)}
                    onSave={(order, visible) => {
                        setColumnPrefs(order, visible);
                        setColumns(getColumnPrefs());
                        setShowCustomize(false);
                    }}
                />
            )}
        </div>
    );
}

function SyncActionsTable({ holdings, mapped, onDelete, onSync, onOpenPush, onEdit, onViewTransactions, onOpenStock }) {
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [confirmingSyncId, setConfirmingSyncId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [editQty, setEditQty] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editDate, setEditDate] = useState("");

    useEffect(() => {
        const closeMenus = () => setOpenMenuId(null);
        document.addEventListener("click", closeMenus);
        return () => document.removeEventListener("click", closeMenus);
    }, []);

    const fmt = (n) => n == null ? "—" : parseFloat(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

    const startEdit = (h) => {
        setEditingId(h.id); setOpenMenuId(null); setConfirmingSyncId(null);
        setEditQty(h.quantity ?? ""); setEditPrice(h.avgBuyPrice ?? ""); setEditDate(h.estimatedBuyDate ?? "");
    };
    const saveEdit = async (h) => {
        if (!editQty || !editPrice) return;
        setBusyId(h.id);
        await onEdit(h, { quantity: parseFloat(editQty), avgBuyPrice: parseFloat(editPrice), estimatedBuyDate: editDate || null });
        setBusyId(null); setEditingId(null);
    };

    if (!holdings || holdings.length === 0) {
        return <p className="text-slate-500 text-sm text-center py-6">No holdings yet — add one below.</p>;
    }

    const colSpan = mapped ? 5 : 3;

    return (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                    <tr className="bg-slate-900/60 text-slate-500 text-[10px] uppercase tracking-wide">
                        <th className="text-left font-semibold px-3 py-2.5">Stock</th>
                        <th className="text-right font-semibold px-3 py-2.5">Your ref.</th>
                        {mapped && <th className="text-right font-semibold px-3 py-2.5">Real holding</th>}
                        {mapped && <th className="text-center font-semibold px-3 py-2.5">Status</th>}
                        <th className="text-right font-semibold px-3 py-2.5">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {holdings.map(h => (
                        <Fragment key={h.id}>
                            <tr className="border-t border-slate-700/40 hover:bg-slate-800/40">
                                <td className="px-3 py-2.5">
                                    <button onClick={() => onOpenStock(h)}
                                            className="text-left group">
                                        <p className="text-white font-bold group-hover:text-blue-400 transition-colors">
                                            {h.symbol}
                                        </p>
                                        <p className="text-slate-500 text-[10px] truncate max-w-[140px] group-hover:text-slate-400">
                                            {h.name}
                                        </p>
                                    </button>
                                </td>
                                <td className="text-right px-3 py-2.5 text-slate-300">
                                    {fmt(h.quantity)} sh @ ₹{fmt(h.avgBuyPrice)}
                                    {h.estimatedBuyDate && (
                                        <span className="block text-slate-600 text-[10px]">~{h.estimatedBuyDate}</span>
                                    )}
                                </td>
                                {mapped && (
                                    <td className="text-right px-3 py-2.5 text-slate-300">
                                        {h.realQuantity != null
                                            ? `${fmt(h.realQuantity)} sh @ ₹${fmt(h.realAvgBuyPrice)}`
                                            : <span className="text-slate-600">Not held</span>}
                                    </td>
                                )}
                                {mapped && (
                                    <td className="text-center px-3 py-2.5">
                                            <span className={"inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap " +
                                                (h.inSync
                                                    ? "bg-green-900/20 text-green-400 border-green-700/40"
                                                    : "bg-amber-900/20 text-amber-400 border-amber-700/40")}>
                                                <span className={"w-1.5 h-1.5 rounded-full " + (h.inSync ? "bg-green-400" : "bg-amber-400")} />
                                                {h.inSync ? "In sync" : "Out of sync"}
                                            </span>
                                    </td>
                                )}
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center justify-end gap-2 relative">
                                        {mapped && (
                                            <button onClick={() => onOpenPush(h)}
                                                    className="text-[11px] font-semibold text-green-400 hover:text-green-300 whitespace-nowrap">
                                                Push
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === h.id ? null : h.id); }}
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 flex-shrink-0">
                                            ⋮
                                        </button>
                                        {openMenuId === h.id && (
                                            <div onClick={e => e.stopPropagation()}
                                                 className="absolute top-7 right-0 z-20 w-40 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-xl">
                                                {mapped && (
                                                    <button onClick={() => { onViewTransactions(h); setOpenMenuId(null); }}
                                                            className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg">
                                                        View transactions
                                                    </button>
                                                )}
                                                <button onClick={() => startEdit(h)}
                                                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg">
                                                    Edit
                                                </button>
                                                {mapped && (
                                                    // Pull is a "check for fresh changes" action, not just a fix
                                                    // for an already-detected mismatch — always available here,
                                                    // same as Push, regardless of current sync state.
                                                    <button onClick={() => { setConfirmingSyncId(h.id); setOpenMenuId(null); }}
                                                            className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg">
                                                        Pull from real
                                                    </button>
                                                )}
                                                <button onClick={() => { onDelete(h); setOpenMenuId(null); }}
                                                        className="w-full text-left px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-900/20 rounded-lg">
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>

                            {editingId === h.id && (
                                <tr className="bg-slate-900/60 border-t border-slate-700/40">
                                    <td colSpan={colSpan} className="px-3 py-3">
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} placeholder="Qty"
                                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                                            <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="Avg price"
                                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingId(null)}
                                                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg">
                                                Cancel
                                            </button>
                                            <button onClick={() => saveEdit(h)} disabled={busyId === h.id}
                                                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg">
                                                {busyId === h.id ? "Saving…" : "Set"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {confirmingSyncId === h.id && (
                                <tr className="border-t border-amber-700/30">
                                    <td colSpan={colSpan} className="px-3 py-3 bg-amber-500/5">
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                                            <p className="text-amber-300 text-[11px] mb-2">
                                                Have you acknowledged the changes? This will overwrite your reference
                                                copy to match their real holding — cannot be undone.
                                            </p>
                                            <div className="flex gap-2">
                                                <button onClick={() => setConfirmingSyncId(null)}
                                                        className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors">
                                                    Cancel
                                                </button>
                                                <button onClick={async () => { setBusyId(h.id); await onSync(h); setBusyId(null); setConfirmingSyncId(null); }}
                                                        disabled={busyId === h.id}
                                                        className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                                                    {busyId === h.id ? "Syncing…" : "Confirm sync"}
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </Fragment>
                    ))}
                    </tbody>
                </table>
            </div>
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

// ── Analytics tab: concentration risk and today's top movers, computed
// client-side from the same holdings + live prices Performance already
// fetches. Sector allocation was dropped — too little of the stock
// catalog has sector data populated to make it trustworthy, and it
// wasn't worth the time to backfill it just for this. No new backend
// endpoint needed for what's here. ────────────────────────────────────
function AnalyticsTab({ holdings }) {
    const [prices, setPrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(true);

    useEffect(() => {
        if (!holdings || holdings.length === 0) { setLoadingPrices(false); return; }
        let cancelled = false;
        setLoadingPrices(true);
        Promise.allSettled(holdings.map(h => getStockPrice(h.symbol)))
            .then(results => {
                if (cancelled) return;
                const map = {};
                results.forEach((r, i) => {
                    if (r.status === "fulfilled") map[holdings[i].symbol] = r.value.data;
                });
                setPrices(map);
            })
            .finally(() => { if (!cancelled) setLoadingPrices(false); });
        return () => { cancelled = true; };
    }, [holdings]);

    const fmtMoney = (n) => n == null || isNaN(n) ? "—" : "₹" + parseFloat(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

    if (!holdings || holdings.length === 0) {
        return <p className="text-slate-500 text-sm text-center py-6">No holdings yet — add one below.</p>;
    }
    if (loadingPrices) {
        return (
            <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Current value per holding — falls back to reference cost basis
    // (qty × avg price) if a live price failed to load for that symbol,
    // so one bad quote doesn't zero out the whole picture.
    const rows = holdings.map(h => {
        const p = prices[h.symbol];
        const ltp = p != null ? parseFloat(p.currentPrice ?? p.regularMarketPrice ?? 0) : null;
        const dayChg = p != null ? parseFloat(p.changePercent ?? p.regularMarketChangePercent ?? 0) : null;
        const qty = parseFloat(h.quantity || 0);
        const avg = parseFloat(h.avgBuyPrice || 0);
        const value = ltp != null && ltp > 0 ? qty * ltp : qty * avg;
        return { ...h, value, dayChg };
    });

    const totalValue = rows.reduce((s, r) => s + r.value, 0) || 1;

    // Concentration — top 5 individual holdings by weight
    const topHoldings = rows.slice().sort((a, b) => b.value - a.value).slice(0, 5)
        .map(r => ({ ...r, pct: (r.value / totalValue) * 100 }));
    const top2Pct = topHoldings.slice(0, 2).reduce((s, r) => s + r.pct, 0);

    // Today's movers, sorted by |day change|
    const movers = rows.filter(r => r.dayChg != null)
        .slice().sort((a, b) => Math.abs(b.dayChg) - Math.abs(a.dayChg)).slice(0, 5);

    // Diversification score — pure position-concentration measure (inverse
    // HHI over portfolio weights), no sector component. Sector-based
    // scoring was dropped: too little of the stock catalog has sector data
    // populated for it to be trustworthy, and querying/backfilling it
    // wasn't worth the time for what it would've added here.
    const weights = rows.map(r => r.value / totalValue);
    const hhi = weights.reduce((s, w) => s + w * w, 0); // 1/n (spread) .. 1 (single stock)
    const diversificationScore = Math.max(0, Math.min(100, Math.round((1 - hhi) * 100)));
    const scoreLabel = diversificationScore < 40 ? "Concentrated" : diversificationScore < 70 ? "Moderate" : "Well spread";

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Concentration */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                    <p className="text-white font-bold text-sm mb-0.5">Concentration</p>
                    <p className="text-slate-500 text-[11px] mb-3">% of portfolio value in top holdings</p>
                    <div className="space-y-2">
                        {topHoldings.map(h => (
                            <div key={h.id}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-white font-semibold">{h.symbol}</span>
                                    <span className="text-slate-500">{h.pct.toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div className={"h-full rounded-full " + (h.pct >= 15 ? "bg-amber-500" : "bg-blue-500")}
                                         style={{ width: `${Math.min(100, h.pct)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {top2Pct >= 30 && (
                        <p className="text-amber-400 text-[10.5px] mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-2">
                            ⚠ Top 2 holdings are {top2Pct.toFixed(0)}% of this portfolio — a concentrated bet, not necessarily a mistake, but worth knowing.
                        </p>
                    )}
                </div>

                {/* Diversification score */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                    <p className="text-white font-bold text-sm mb-0.5">Diversification score</p>
                    <p className="text-slate-500 text-[11px] mb-3">Based on position sizing only</p>
                    <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-extrabold text-white leading-none">{diversificationScore}</span>
                        <span className="text-slate-500 text-xs mb-0.5">/100 · {scoreLabel}</span>
                    </div>
                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                             style={{
                                 width: `${diversificationScore}%`,
                                 background: "linear-gradient(90deg, #f0596a, #ffb547, #3ecf8e)",
                             }} />
                    </div>
                    <p className="text-slate-600 text-[10px] mt-2 leading-relaxed">
                        Measures how evenly value is spread across holdings — a few big positions score lower, many similar-sized ones score higher. Doesn't account for sector overlap between holdings.
                    </p>
                </div>
            </div>

            {/* Top movers — full width, since sector card is gone */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <p className="text-white font-bold text-sm mb-0.5">Today's movers</p>
                <p className="text-slate-500 text-[11px] mb-3">Biggest moves, up or down</p>
                {movers.length === 0 ? (
                    <p className="text-slate-600 text-xs">No live price data available right now.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                        {movers.map(m => (
                            <div key={m.id} className="flex justify-between items-center py-1.5 border-t border-slate-700/40 first:border-t-0">
                                <div>
                                    <p className="text-white text-xs font-bold">{m.symbol}</p>
                                    <p className="text-slate-600 text-[10px] truncate max-w-[160px]">{m.name}</p>
                                </div>
                                <span className={"text-xs font-bold " + (m.dayChg >= 0 ? "text-green-400" : "text-red-400")}>
                                    {(m.dayChg >= 0 ? "+" : "") + m.dayChg.toFixed(2)}%
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
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
    const [viewingStockDetail, setViewingStockDetail] = useState(null); // holding-shaped stock, or null — opens StockDetailModal
    const [showPushReview, setShowPushReview] = useState(false);
    const [pushStockId, setPushStockId] = useState(null); // null = Push All, set = one stock
    const [stagedCount, setStagedCount] = useState(0);

    // Performance = "how is this stock doing" (qty/avg/LTP/day change/value/
    // gain-loss). Sync & Actions = "does my record match theirs" (reference
    // vs real holding, status, Push/Pull/Edit/Remove). One card grid used to
    // try to answer both at once — split so each table stays to 5-7 columns
    // and one clear job.
    const [activeTab, setActiveTab] = useState("performance"); // "performance" | "sync"

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

    // Opens the same StockDetailModal used everywhere else in the app —
    // holding already carries everything the modal needs (stockId, symbol,
    // name, exchange), so this is just a reshape, no extra fetch.
    const openStockDetail = (holding) => {
        setViewingStockDetail({
            id: holding.stockId || holding.id,
            symbol: holding.symbol,
            name: holding.name,
            exchange: holding.exchange,
        });
    };

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

            {/* Google Finance-style value chart — only for mapped clients,
                since there's no real account to have a price history for
                an untracked one yet. */}
            {client.mappedUserId && (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                    {/* Which holdings this client's numbers below are actually
                        computed from — Stocks only, MF only, or both. Changing
                        this re-fetches, since the value/P&L/day-change figures
                        genuinely change with it. */}
                    <div className="flex items-center gap-1.5 mb-4">
                        {[["STOCKS", "Stocks"], ["MF", "MF"], ["COMBINED", "Combined"]].map(([val, label]) => (
                            <button key={val}
                                    onClick={() => {
                                        if (client.portfolioScope === val) return;
                                        updateTrackedClientScope(client.id, val)
                                            .then(res => setClient(res.data))
                                            .catch(() => toast.error("Couldn't change portfolio scope"));
                                    }}
                                    className={"text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors " +
                                        ((client.portfolioScope || "COMBINED") === val
                                            ? "bg-purple-600/20 border-purple-500 text-purple-300"
                                            : "bg-slate-900 border-slate-700 text-slate-400")}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <PortfolioValueChart
                        currentValue={client.realPortfolioValue}
                        fetchHistory={(range) => getClientPortfolioHistory(client.mappedUserId, range)}
                    />
                    {/* Honest limitation, not a bug: the history endpoint this
                        chart's LINE is drawn from only has stock price data —
                        it has no MF equivalent yet. The Value/P&L/Today
                        numbers above DO correctly reflect the scope chosen,
                        but the shape of the line itself is stock-only
                        regardless of scope until MF gets its own history
                        endpoint — silently mismatching those would be worse
                        than saying so plainly. */}
                    {client.portfolioScope !== "STOCKS" && (
                        <p className="text-[11px] text-slate-600 mt-2">
                            ⓘ Chart line reflects stock price history only — mutual fund history isn't available yet.
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-center gap-1 border-b border-slate-700/60">
                <button onClick={() => setActiveTab("performance")}
                        className={"px-1 pb-2.5 mr-5 text-sm font-semibold border-b-2 transition-colors " +
                            (activeTab === "performance"
                                ? "text-white border-blue-500"
                                : "text-slate-500 border-transparent hover:text-slate-300")}>
                    Performance
                </button>
                <button onClick={() => setActiveTab("sync")}
                        className={"px-1 pb-2.5 mr-5 text-sm font-semibold border-b-2 transition-colors " +
                            (activeTab === "sync"
                                ? "text-white border-blue-500"
                                : "text-slate-500 border-transparent hover:text-slate-300")}>
                    Sync &amp; Actions
                    {client.mappedUserId && stagedCount > 0 && (
                        <span className="ml-1.5 bg-green-900/40 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full align-middle">
                            {stagedCount}
                        </span>
                    )}
                </button>
                <button onClick={() => setActiveTab("analytics")}
                        className={"px-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors " +
                            (activeTab === "analytics"
                                ? "text-white border-blue-500"
                                : "text-slate-500 border-transparent hover:text-slate-300")}>
                    Analytics
                </button>
            </div>

            {activeTab === "performance" ? (
                <PerformanceTable holdings={client.holdings || []} onOpenStock={openStockDetail} />
            ) : activeTab === "sync" ? (
                <SyncActionsTable
                    holdings={client.holdings || []}
                    mapped={!!client.mappedUserId}
                    onDelete={onDeleteHolding}
                    onSync={onSync}
                    onOpenPush={(h) => openPush(h.stockId || h.id)}
                    onEdit={onEditHolding}
                    onViewTransactions={setViewingTransactionsFor}
                    onOpenStock={openStockDetail}
                />
            ) : (
                <AnalyticsTab holdings={client.holdings || []} />
            )}

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

            {viewingStockDetail && (
                <StockDetailModal stock={viewingStockDetail} onClose={() => setViewingStockDetail(null)} />
            )}

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