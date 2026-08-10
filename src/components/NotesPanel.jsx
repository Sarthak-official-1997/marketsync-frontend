// src/components/NotesPanel.jsx
// Notes surface matching the existing backend: body text, $-mention stock links
// (full {symbol,name,exchange}), reminders (each fires ONCE — the backend has
// no repeat/recurring concept for personal notes; a note can carry several
// one-time reminders, which is the closest equivalent), and a done flag.
//
// Adding/editing a note now opens its OWN dedicated modal (matching the
// Quick Trade / Stock Confirm pattern elsewhere in the app) instead of a
// persistent bottom composer. The composer previously got compressed to fit
// at the bottom of the screen for thumb-reach, and in the process the
// reminder quick-pick options effectively disappeared into a bare datetime
// input with no context — this fixes that by giving composing a note its
// own full-height space, exactly like confirming a stock does.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { searchStocks } from "../api/portfolio";
import { getNotes, createNote, updateNote, deleteNote } from "../api/notes";
import SearchPickerModal from "./SearchPickerModal";

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

// Convert a Date object to a datetime-local input value (reverse of the above).
function dateToLocalInput(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Quick-pick reminder presets — each computes a sensible default time
// (9 AM local) that many, then fills the raw datetime input rather than
// hiding it, so a person can still nudge the exact time after picking one.
const REMINDER_PRESETS = [
    { label: "Tomorrow",   days: 1  },
    { label: "In 2 days",  days: 2  },
    { label: "Next week",  days: 7  },
    { label: "Next month", days: 30 },
];

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

// ── The dedicated Add/Edit modal — layered above the main Notes panel ──────

function NoteComposerModal({ initial, onSave, onClose, saving }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [body,      setBody]      = useState(initial?.body || "");
    const [stocks,    setStocks]    = useState(initial?.stocks || []);
    const [reminders, setReminders] = useState(initial?.reminders || []);
    const [remindDraft, setRemindDraft] = useState("");

    const [mentionOpen,    setMentionOpen]    = useState(false);
    const [mentionResults, setMentionResults] = useState([]);
    const mentionDebounce = useRef(null);
    const textareaRef     = useRef(null);

    useEffect(() => { textareaRef.current?.focus(); }, []);

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

    const pickMention = (s) => {
        setBody(prev => prev.replace(/\$([A-Za-z]+)$/, "").replace(/\s+$/, "") + " ");
        addLinkedStock(s);
        setMentionOpen(false);
        setMentionResults([]);
        textareaRef.current?.focus();
    };

    // Shared by both ways of linking a stock — typing $SYMBOL inline, or
    // tapping "🔗 Link Stock" to search explicitly via SearchPickerModal.
    // Typing $ is fast once you know the symbol; the button is for when you
    // don't, or just don't want to type it into the note text itself.
    const addLinkedStock = (s) => {
        setStocks(prev => prev.some(x => x.symbol === s.symbol)
            ? prev
            : [...prev, { symbol: s.symbol, name: s.name || s.symbol, exchange: s.exchange || "NSE" }]);
    };

    const [showLinkModal, setShowLinkModal] = useState(false);

    const applyPreset = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(9, 0, 0, 0); // a sensible default time, still editable below
        setRemindDraft(dateToLocalInput(d));
    };

    const addReminder = () => {
        const iso = localToIso(remindDraft);
        if (!iso) { toast.error("Pick a valid date & time"); return; }
        if (new Date(iso).getTime() < Date.now()) { toast.error("Reminder time is in the past"); return; }
        setReminders(prev => prev.includes(iso) ? prev : [...prev, iso]);
        setRemindDraft("");
    };

    const handleSave = () => {
        const text = body.trim();
        if (!text) { toast.error("Write something first"); return; }
        onSave({ body: text, stocks, reminders });
    };

    return createPortal(
        <>
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
                         width: "calc(100vw - 32px)", maxWidth: "520px",
                         minHeight: "480px", maxHeight: "88vh",
                         borderRadius: "20px", border: "1px solid rgba(71,85,105,0.6)",
                         boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                     }}
                     onClick={e => e.stopPropagation()}>

                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                        <p className="text-white font-bold text-sm">{initial ? "Edit note" : "New note"}</p>
                        <button onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                    </div>

                    <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }} className="px-4 py-4 space-y-3">
                        <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={body}
                            onChange={onBodyChange}
                            placeholder="Write a note… type $ to link a stock (e.g. $RELIANCE)"
                            rows={6}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                                       text-white text-sm placeholder-slate-500 resize-none
                                       focus:outline-none focus:border-blue-500"
                        />
                            {mentionOpen && mentionResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-slate-800 border border-slate-600
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
                        </div>

                        {/* Explicit search-and-pick, alongside typing $SYMBOL
                        inline — reuses the same SearchPickerModal every
                        other stock-search flow in the app uses, rather
                        than a note-specific one-off. */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button type="button" onClick={() => setShowLinkModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 text-blue-300
                                           border border-blue-700/40 text-xs font-semibold rounded-lg
                                           hover:bg-blue-900/50 transition-colors">
                                🔗 Link Stock
                            </button>
                            {stocks.map(s => (
                                <StockChip key={s.symbol} symbol={s.symbol}
                                           onRemove={() => setStocks(prev => prev.filter(x => x.symbol !== s.symbol))} />
                            ))}
                        </div>

                        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-2.5">
                            <p className="text-xs text-slate-400 font-semibold">⏰ Reminders</p>

                            {/* Quick-pick presets — fills the raw input below rather than
                            hiding it, so the exact time is still adjustable. */}
                            <div className="flex flex-wrap gap-1.5">
                                {REMINDER_PRESETS.map(p => (
                                    <button key={p.label} onClick={() => applyPreset(p.days)}
                                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
                                                   bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                                        {p.label}
                                    </button>
                                ))}
                            </div>

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
                                    // Native datetime-local inputs render their own
                                    // internal date/time text using the browser's
                                    // default (usually light) form-control theme —
                                    // Tailwind's text-* classes don't reach it at
                                    // all, since it isn't regular DOM text. That's
                                    // what made this look blank: dark-on-dark from
                                    // the browser's own light-scheme rendering,
                                    // not actually empty. color-scheme: dark tells
                                    // the browser to use its dark native theme for
                                    // this control instead.
                                    style={{ colorScheme: "dark" }}
                                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5
                                           text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                                />
                                <button onClick={addReminder}
                                        className="px-3 py-1.5 bg-amber-600/20 text-amber-300 border border-amber-500/40
                                               text-xs font-semibold rounded-lg hover:bg-amber-600/30 transition-colors flex-shrink-0">
                                    + Add
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-600">
                                Each reminder fires once. Add several times if you want repeated nudges.
                            </p>
                        </div>
                    </div>

                    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/60 flex gap-2">
                        <button onClick={onClose}
                                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white
                                       text-sm font-semibold rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || !body.trim()}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                       text-white text-sm font-semibold rounded-xl transition-colors">
                            {saving ? "Saving…" : initial ? "Update note" : "Save note"}
                        </button>
                    </div>
                </div>
            </div>
            {showLinkModal && (
                <SearchPickerModal
                    title="Link a stock"
                    placeholder="Search symbol or company…"
                    searchFn={(q) => searchStocks(q).then(r => r.data?.content || r.data || [])}
                    renderResult={(s) => (
                        <div className="min-w-0">
                            <p className="text-white text-xs font-bold">{s.symbol}</p>
                            <p className="text-slate-500 text-[10px] truncate">{s.name}</p>
                        </div>
                    )}
                    onPick={(s) => { addLinkedStock(s); setShowLinkModal(false); }}
                    onClose={() => setShowLinkModal(false)}
                />
            )}
        </>,
        document.body
    );
}

// ── One note card — collapsed by default for long text, tap to expand ──────

function NoteCard({ n, onEdit, onDelete, onToggleDone }) {
    const [expanded, setExpanded] = useState(false);
    const upcoming = (n.reminders || []).filter(r => !r.fired);
    const fired    = (n.reminders || []).filter(r => r.fired);
    const hasStocks = n.stocks && n.stocks.length > 0;
    const hasReminders = upcoming.length > 0 || fired.length > 0;

    // Long notes stay compact until tapped — a fixed line-clamp instead of
    // letting the raw text push everything else down the list.
    const isLong = (n.body || "").length > 180 || (n.body || "").split("\n").length > 4;

    return (
        <div className={"bg-slate-800/60 border rounded-2xl px-4 py-3 group " +
            (n.done ? "border-slate-700/30 opacity-70" : "border-slate-700/50")}>

            {/* Type indicators — visible even collapsed, so what kind of note
                this is (plain / stock-linked / reminder / both) is clear at
                a glance without expanding. */}
            {(hasStocks || hasReminders) && (
                <div className="flex items-center gap-1.5 mb-1.5">
                    {hasStocks && (
                        <span className="text-[10px] text-blue-400" title="Has linked stock">📌 {n.stocks.length}</span>
                    )}
                    {upcoming.length > 0 && (
                        <span className="text-[10px] text-amber-400" title="Has upcoming reminder">⏰ {upcoming.length}</span>
                    )}
                </div>
            )}

            <div className="flex items-start justify-between gap-2">
                <p onClick={() => isLong && setExpanded(v => !v)}
                   className={"text-sm whitespace-pre-wrap flex-1 min-w-0 break-words " +
                       (isLong ? "cursor-pointer " : "") +
                       (n.done ? "text-slate-500 line-through" : "text-slate-200")}
                   style={!expanded && isLong ? {
                       display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
                   } : undefined}>
                    {n.body}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0
                                opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onToggleDone(n)} title={n.done ? "Mark not done" : "Mark done"}
                            className={"w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors " +
                                (n.done ? "text-green-400 bg-green-500/10" : "text-slate-500 hover:text-green-400 hover:bg-slate-700")}>
                        ✓
                    </button>
                    <button onClick={() => onEdit(n)} title="Edit"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                       text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors">✏️</button>
                    <button onClick={() => onDelete(n.id)} title="Delete"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                       text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">🗑</button>
                </div>
            </div>

            {isLong && (
                <button onClick={() => setExpanded(v => !v)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold mt-1">
                    {expanded ? "Show less ▲" : "Show more ▼"}
                </button>
            )}

            {/* Full metadata — only shown expanded (or always, for short notes
                where there's no reason to hide it). */}
            {(expanded || !isLong) && (
                <>
                    {hasStocks && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {n.stocks.map(s => <StockChip key={s.symbol} symbol={s.symbol} />)}
                        </div>
                    )}
                    {hasReminders && (
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
                </>
            )}

            <p className="text-[10px] text-slate-600 mt-2">{timeAgo(n.createdAt)}</p>
        </div>
    );
}

export default function NotesPanel({ onClose }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [notes,   setNotes]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [search,  setSearch]  = useState("");
    const [composerFor, setComposerFor] = useState(undefined); // undefined = closed, null = new, note = editing
    const [saving,   setSaving]   = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getNotes()
            .then(res => setNotes(res.data || []))
            .catch(() => toast.error("Couldn't load notes"))
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape" && composerFor === undefined) onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose, composerFor]);

    const handleSaveNote = (payload) => {
        setSaving(true);
        const editingId = composerFor?.id;
        const req = editingId != null ? updateNote(editingId, payload) : createNote(payload);
        req
            .then(() => { setComposerFor(undefined); load(); toast.success(editingId != null ? "Note updated" : "Note saved"); })
            .catch(() => toast.error("Couldn't save note"))
            .finally(() => setSaving(false));
    };

    const beginEdit = (n) => {
        setComposerFor({
            id: n.id,
            body: n.body || "",
            stocks: (n.stocks || []).map(s => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })),
            // Only carry forward UNFIRED reminders (backend keeps fired ones as history).
            reminders: (n.reminders || []).filter(r => !r.fired).map(r => r.remindAt),
        });
    };

    const remove = (id) => {
        deleteNote(id)
            .then(() => setNotes(prev => prev.filter(n => n.id !== id)))
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

                {/* List — takes the FULL remaining space now that the composer
                    isn't permanently docked at the bottom. */}
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
                                {search.trim() ? "No notes match your search." : "No notes yet — tap + to write your first one."}
                            </p>
                        </div>
                    ) : (
                        filtered.map(n => (
                            <NoteCard key={n.id} n={n} onEdit={beginEdit} onDelete={remove} onToggleDone={toggleDone} />
                        ))
                    )}
                </div>

                {/* + New note — opens the dedicated composer modal, same
                    pattern as confirming a stock elsewhere in the app,
                    instead of a permanently-docked bottom bar. */}
                <button onClick={() => setComposerFor(null)}
                        className="absolute bottom-5 right-5 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700
                                   text-white text-2xl font-bold flex items-center justify-center
                                   shadow-lg shadow-blue-900/40 transition-colors z-10">
                    +
                </button>
            </div>

            {composerFor !== undefined && (
                <NoteComposerModal
                    initial={composerFor}
                    saving={saving}
                    onSave={handleSaveNote}
                    onClose={() => setComposerFor(undefined)}
                />
            )}
        </div>,
        document.body
    );
}