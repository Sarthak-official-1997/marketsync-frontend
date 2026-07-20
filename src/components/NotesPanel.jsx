// src/components/NotesPanel.jsx
// Full notes surface: composer with $-mention stock linking, list, search,
// edit, delete, pin. Rendered as a portal overlay (mobile full-screen, desktop
// centered). Opened from the floating bubble and the /notes route.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { searchStocks } from "../api/portfolio";
import { getNotes, createNote, updateNote, deleteNote } from "../api/notes";

// Relative "time ago" for note timestamps.
function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    const s = Math.floor((Date.now() - then) / 1000);
    if (s < 60)     return "just now";
    const m = Math.floor(s / 60);
    if (m < 60)     return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24)     return h + "h ago";
    const d = Math.floor(h / 24);
    if (d < 30)     return d + "d ago";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Stock chip.
function SymChip({ sym, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1 bg-blue-900/40 text-blue-300
                         text-[11px] font-semibold px-2 py-0.5 rounded-full">
            ${sym}
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

    // Composer state
    const [text,    setText]    = useState("");
    const [linked,  setLinked]  = useState([]);      // linked symbols for the draft
    const [editing, setEditing] = useState(null);    // note id being edited, or null
    const [saving,  setSaving]  = useState(false);

    // $-mention dropdown
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

    // Detect a trailing "$word" as the user types → search stocks for the mention.
    const onTextChange = (e) => {
        const val = e.target.value;
        setText(val);
        const cursor  = e.target.selectionStart || val.length;
        const before  = val.slice(0, cursor);
        const match   = before.match(/\$([A-Za-z]+)$/);   // no brace-quantifier by design
        if (match) {
            const term = match[1];
            setMentionOpen(true);
            clearTimeout(mentionDebounce.current);
            mentionDebounce.current = setTimeout(() => {
                searchStocks(term)
                    .then(res => setMentionResults((res.data && res.data.content) || []))
                    .catch(() => setMentionResults([]));
            }, 250);
        } else {
            setMentionOpen(false);
            setMentionResults([]);
        }
    };

    // Pick a stock from the mention dropdown → strip the "$word" token, add a chip.
    const pickMention = (stock) => {
        setText(prev => prev.replace(/\$([A-Za-z]+)$/, "").replace(/\s+$/, "") + " ");
        setLinked(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
        setMentionOpen(false);
        setMentionResults([]);
        textareaRef.current?.focus();
    };

    const resetComposer = () => { setText(""); setLinked([]); setEditing(null); };

    const beginEdit = (n) => {
        setEditing(n.id);
        setText(n.content || "");
        setLinked(n.linkedSymbols || []);
        setMentionOpen(false);
        textareaRef.current?.focus();
    };

    const save = () => {
        const content = text.trim();
        if (!content) { toast.error("Write something first"); return; }
        setSaving(true);
        const payload = { content, linkedSymbols: linked };
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

    const togglePin = (n) => {
        updateNote(n.id, { pinned: !n.pinned })
            .then(() => load())
            .catch(() => toast.error("Couldn't update note"));
    };

    const filtered = search.trim()
        ? notes.filter(n => (n.content || "").toLowerCase().includes(search.trim().toLowerCase()))
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
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3
                                border-b border-slate-700/60">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📝</span>
                        <p className="text-white font-bold text-base">Notes</p>
                        {notes.length > 0 && (
                            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                                {notes.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        ✕
                    </button>
                </div>

                {/* Composer */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 space-y-2 relative">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={onTextChange}
                        placeholder="Write a note… type $ to link a stock (e.g. $RELIANCE)"
                        rows={isMobile ? 3 : 2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                                   text-white text-sm placeholder-slate-500 resize-none
                                   focus:outline-none focus:border-blue-500"
                    />

                    {/* $-mention dropdown */}
                    {mentionOpen && mentionResults.length > 0 && (
                        <div className="absolute left-4 right-4 top-[64px] z-10 bg-slate-800
                                        border border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                            {mentionResults.slice(0, 8).map(s => (
                                <button key={s.id || s.symbol}
                                        onClick={() => pickMention(s)}
                                        className="w-full flex items-center justify-between px-3 py-2
                                                   hover:bg-slate-700/60 transition-colors text-left border-b border-slate-700/40 last:border-0">
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

                    {/* Linked chips */}
                    {linked.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {linked.map(sym => (
                                <SymChip key={sym} sym={sym}
                                         onRemove={() => setLinked(prev => prev.filter(x => x !== sym))} />
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={save} disabled={saving || !text.trim()}
                                className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700
                                           disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                            {saving ? "Saving…" : editing != null ? "Update note" : "Save note"}
                        </button>
                        {editing != null && (
                            <button onClick={resetComposer}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200
                                               text-sm rounded-xl transition-colors">
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                {notes.length > 0 && (
                    <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/40">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search notes…"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5
                                       text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
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
                        filtered.map(n => (
                            <div key={n.id}
                                 className="bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-3 group">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-slate-200 text-sm whitespace-pre-wrap flex-1 min-w-0 break-words">
                                        {n.content}
                                    </p>
                                    <div className="flex items-center gap-1 flex-shrink-0
                                                    opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => togglePin(n)} title={n.pinned ? "Unpin" : "Pin"}
                                                className={"w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors " +
                                                (n.pinned ? "text-amber-400 bg-amber-500/10" : "text-slate-500 hover:text-amber-400 hover:bg-slate-700")}>
                                            📌
                                        </button>
                                        <button onClick={() => beginEdit(n)} title="Edit"
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                                           text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors">
                                            ✏️
                                        </button>
                                        <button onClick={() => remove(n.id)} title="Delete"
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                                           text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
                                            🗑
                                        </button>
                                    </div>
                                </div>
                                {(n.linkedSymbols && n.linkedSymbols.length > 0) && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {n.linkedSymbols.map(sym => <SymChip key={sym} sym={sym} />)}
                                    </div>
                                )}
                                <p className="text-[10px] text-slate-600 mt-2">
                                    {n.pinned ? "📌 " : ""}{timeAgo(n.updatedAt || n.createdAt)}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}