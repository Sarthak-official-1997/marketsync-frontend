// src/components/NotesPanel.jsx
// Notes surface matching the existing backend: body text, $-mention stock links
// (full {symbol,name,exchange}), reminders (each fires once), and a done flag.
// Portal overlay — mobile full-screen, desktop centered. Opened from the bubble
// and the /notes route.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { searchStocks } from "../api/portfolio";
import { getNotes, createNote, updateNote, deleteNote } from "../api/notes";

// Relative "time ago".
function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    const s = Math.floor((Date.now() - then) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24); if (d < 30) return d + "d ago";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Format a reminder time for display.
function fmtRemind(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Convert a datetime-local input value to an ISO string (backend wants ISO).
function localToIso(local) {
    if (!local) return null;
    const d = new Date(local);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

// Stock chip (full link object).
function StockChip({ symbol, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1 bg-blue-900/40 text-blue-300
                         text-[11px] font-semibold px-2 py-0.5 rounded-full">
            ${symbol}
            {onRemove && (
                <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="text-blue-400 hover:text-white leading-none">✕</button>
            )}
        </span>
    );
}

export default function NotesPanel({ onClose }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [notes,   setNotes]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [search,  setSearch]  = useState("");

    // Composer draft
    const [body,     setBody]     = useState("");
    const [stocks,   setStocks]   = useState([]);   // [{symbol,name,exchange}]
    const [reminders,setReminders]= useState([]);   // [isoString] (new/unfired times to send)
    const [editing,  setEditing]  = useState(null);
    const [saving,   setSaving]   = useState(false);
    const [remindDraft, setRemindDraft] = useState("");   // datetime-local input value

    // $-mention
    const [mentionOpen,    setMentionOpen]    = useState(false);
    const [mentionResults, setMentionResults] = useState([]);
    const mentionDebounce = useRef(null);
    const textareaRef     = useRef(null);

    const load = useCallback(() => {
        setLoading(true);
        getNotes()
            .then(res => setNotes(res.data || []))
            .catch(() => toast.error("Couldn't load notes"))
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    // Detect trailing "$word" → search stocks (no brace-quantifier regex by design).
    const onBodyChange = (e) => {
        const val = e.target.value;
        setBody(val);
        const cursor = e.target.selectionStart || val.length;
        const match  = val.slice(0, cursor).match(/\$([A-Za-z]+)$/);
        if (match) {
            setMentionOpen(true);
            clearTimeout(mentionDebounce.current);
            mentionDebounce.current = setTimeout(() => {
                searchStocks(match[1])
                    .then(res => setMentionResults((res.data && res.data.content) || []))
                    .catch(() => setMentionResults([]));
            }, 250);
        } else {
            setMentionOpen(false);
            setMentionResults([]);
        }
    };

    // Pick a stock → strip the "$word", add a full link object.
    const pickMention = (s) => {
        setBody(prev => prev.replace(/\$([A-Za-z]+)$/, "").replace(/\s+$/, "") + " ");
        setStocks(prev => prev.some(x => x.symbol === s.symbol)
            ? prev
            : [...prev, { symbol: s.symbol, name: s.name || s.symbol, exchange: s.exchange || "NSE" }]);
        setMentionOpen(false);
        setMentionResults([]);
        textareaRef.current?.focus();
    };

    const addReminder = () => {
        const iso = localToIso(remindDraft);
        if (!iso) { toast.error("Pick a valid date & time"); return; }
        if (new Date(iso).getTime() < Date.now()) { toast.error("Reminder time is in the past"); return; }
        setReminders(prev => prev.includes(iso) ? prev : [...prev, iso]);
        setRemindDraft("");
    };

    const resetComposer = () => {
        setBody(""); setStocks([]); setReminders([]); setEditing(null); setRemindDraft("");
    };

    const beginEdit = (n) => {
        setEditing(n.id);
        setBody(n.body || "");
        setStocks((n.stocks || []).map(s => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })));
        // Only carry forward UNFIRED reminders (backend keeps fired ones as history).
        setReminders((n.reminders || []).filter(r => !r.fired).map(r => r.remindAt));
        setMentionOpen(false);
        textareaRef.current?.focus();
    };

    const save = () => {
        const text = body.trim();
        if (!text) { toast.error("Write something first"); return; }
        setSaving(true);
        const payload = { body: text, stocks, reminders };
        const req = editing != null ? updateNote(editing, payload) : createNote(payload);
        req
            .then(() => { resetComposer(); load(); toast.success(editing != null ? "Note updated" : "Note saved"); })
            .catch(() => toast.error("Couldn't save note"))
            .finally(() => setSaving(false));
    };

    const remove = (id) => {
        deleteNote(id)
            .then(() => { setNotes(prev => prev.filter(n => n.id !== id)); if (editing === id) resetComposer(); })
            .catch(() => toast.error("Couldn't delete note"));
    };

    const toggleDone = (n) => {
        updateNote(n.id, { done: !n.done })
            .then(() => load())
            .catch(() => toast.error("Couldn't update note"));
    };

    const filtered = search.trim()
        ? notes.filter(n => (n.body || "").toLowerCase().includes(search.trim().toLowerCase()))
        : notes;

    return createPortal(
        <div className="fixed inset-0 z-[9600] flex items-end sm:items-center justify-center"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="relative z-[9601] bg-slate-900 flex flex-col"
                 style={isMobile ? {
                     width: "100vw", height: "100dvh", maxWidth: "100vw", maxHeight: "100dvh",
                     borderRadius: 0, border: "none",
                     paddingTop: "env(safe-area-inset-top, 0px)",
                     paddingBottom: "env(safe-area-inset-bottom, 0px)",
                     overflowX: "hidden",
                 } : {
                     width: "calc(100vw - 32px)", height: "calc(100vh - 48px)",
                     maxWidth: "720px", maxHeight: "900px",
                     borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                 }}
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📝</span>
                        <p className="text-white font-bold text-base">Notes</p>
                        {notes.length > 0 && (
                            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{notes.length}</span>
                        )}
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                {/* Search */}
                {notes.length > 0 && (
                    <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/40">
                        <input value={search} onChange={e => setSearch(e.target.value)}
                               placeholder="Search notes…"
                               className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5
                                          text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                )}

                {/* List */}
                <div style={{ flex: "1 1 0", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
                     className="px-4 py-3 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-3xl mb-2">📝</p>
                            <p className="text-slate-400 text-sm">
                                {search.trim() ? "No notes match your search." : "No notes yet — write your first one above."}
                            </p>
                        </div>
                    ) : (
                        filtered.map(n => {
                            const upcoming = (n.reminders || []).filter(r => !r.fired);
                            const fired    = (n.reminders || []).filter(r => r.fired);
                            return (
                                <div key={n.id}
                                     className={"bg-slate-800/60 border rounded-2xl px-4 py-3 group " +
                                     (n.done ? "border-slate-700/30 opacity-70" : "border-slate-700/50")}>
                                    <div className="flex items-start justify-between gap-2">
                                        <p className={"text-sm whitespace-pre-wrap flex-1 min-w-0 break-words " +
                                        (n.done ? "text-slate-500 line-through" : "text-slate-200")}>
                                            {n.body}
                                        </p>
                                        <div className="flex items-center gap-1 flex-shrink-0
                                                        opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => toggleDone(n)} title={n.done ? "Mark not done" : "Mark done"}
                                                    className={"w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors " +
                                                    (n.done ? "text-green-400 bg-green-500/10" : "text-slate-500 hover:text-green-400 hover:bg-slate-700")}>
                                                ✓
                                            </button>
                                            <button onClick={() => beginEdit(n)} title="Edit"
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                                               text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors">✏️</button>
                                            <button onClick={() => remove(n.id)} title="Delete"
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                                               text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">🗑</button>
                                        </div>
                                    </div>

                                    {/* Linked stocks */}
                                    {(n.stocks && n.stocks.length > 0) && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {n.stocks.map(s => <StockChip key={s.symbol} symbol={s.symbol} />)}
                                        </div>
                                    )}

                                    {/* Reminders: upcoming (amber) + fired (muted) */}
                                    {(upcoming.length > 0 || fired.length > 0) && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {upcoming.map((r, i) => (
                                                <span key={"u" + i} className="inline-flex items-center gap-1 bg-amber-900/30 text-amber-300
                                                                               text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                    ⏰ {fmtRemind(r.remindAt)}
                                                </span>
                                            ))}
                                            {fired.map((r, i) => (
                                                <span key={"f" + i} className="inline-flex items-center gap-1 bg-slate-700/50 text-slate-500
                                                                               text-[10px] px-2 py-0.5 rounded-full">
                                                    ✓ fired {fmtRemind(r.firedAt || r.remindAt)}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <p className="text-[10px] text-slate-600 mt-2">{timeAgo(n.createdAt)}</p>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Composer — anchored at the BOTTOM of the screen (not the top), matching
                    how a chat app's input sits within thumb reach. The outer modal is a
                    100dvh flex column with the list above taking flex:1, so on mobile
                    keyboards that respect dvh, this naturally stays just above the
                    keyboard when it opens — no extra JS viewport-tracking needed. */}
                <div className="flex-shrink-0 px-4 pt-3 border-t border-slate-700/50 space-y-2 relative"
                     style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}>
                    <textarea
                        ref={textareaRef}
                        value={body}
                        onChange={onBodyChange}
                        placeholder="Write a note… type $ to link a stock (e.g. $RELIANCE)"
                        rows={isMobile ? 3 : 2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                                   text-white text-sm placeholder-slate-500 resize-none
                                   focus:outline-none focus:border-blue-500"
                    />

                    {/* $-mention dropdown */}
                    {mentionOpen && mentionResults.length > 0 && (
                        <div className="absolute left-4 right-4 bottom-full mb-2 z-10 bg-slate-800 border border-slate-600
                                        rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                            {mentionResults.slice(0, 8).map(s => (
                                <button key={s.id || s.symbol} onClick={() => pickMention(s)}
                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/60
                                                   transition-colors text-left border-b border-slate-700/40 last:border-0">
                                    <div className="min-w-0">
                                        <p className="text-white text-xs font-bold">{s.symbol}</p>
                                        <p className="text-slate-500 text-[10px] truncate">{s.name}</p>
                                    </div>
                                    {s.exchange && (
                                        <span className="text-[9px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                                            {s.exchange}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Linked stock chips */}
                    {stocks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {stocks.map(s => (
                                <StockChip key={s.symbol} symbol={s.symbol}
                                           onRemove={() => setStocks(prev => prev.filter(x => x.symbol !== s.symbol))} />
                            ))}
                        </div>
                    )}

                    {/* Reminder draft chips + add control */}
                    {reminders.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {reminders.map(iso => (
                                <span key={iso} className="inline-flex items-center gap-1 bg-amber-900/30 text-amber-300
                                                           text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                    ⏰ {fmtRemind(iso)}
                                    <button onClick={() => setReminders(prev => prev.filter(x => x !== iso))}
                                            className="text-amber-400 hover:text-white leading-none">✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <input
                            type="datetime-local"
                            value={remindDraft}
                            onChange={e => setRemindDraft(e.target.value)}
                            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5
                                       text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button onClick={addReminder}
                                className="px-3 py-1.5 bg-amber-600/20 text-amber-300 border border-amber-500/40
                                           text-xs font-semibold rounded-lg hover:bg-amber-600/30 transition-colors flex-shrink-0">
                            + Reminder
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={save} disabled={saving || !body.trim()}
                                className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                           text-white text-sm font-semibold rounded-xl transition-colors">
                            {saving ? "Saving…" : editing != null ? "Update note" : "Save note"}
                        </button>
                        {editing != null && (
                            <button onClick={resetComposer}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-xl transition-colors">
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}