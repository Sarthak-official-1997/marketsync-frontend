// src/components/NotesPanel.jsx
// Notes list surface. Shows saved notes; create/edit happen in NoteEditor
// (the "🔗 Link stock" + multi-reminder modal). No $-mention — stocks are
// linked explicitly in the editor. Portal overlay: mobile full-screen,
// desktop centered. Opened from the floating bubble and the /notes route.

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";
import { useToast } from "../context/ToastContext";
import { getNotes, deleteNote, updateNote } from "../api/notes";
import NoteEditor from "./NoteEditor";

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

function fmtRemind(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
        hour: "numeric", minute: "2-digit", hour12: true,
    });
}

export default function NotesPanel({ onClose }) {
    const isMobile = useMobile();
    const toast = useToast();

    const [notes,       setNotes]       = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [search,      setSearch]      = useState("");
    const [editorOpen,  setEditorOpen]  = useState(false);
    const [editingNote, setEditingNote] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        getNotes()
            .then(res => setNotes(res.data || []))
            .catch(() => toast.error("Couldn't load notes"))
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape" && !editorOpen) onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose, editorOpen]);

    const openNew  = () => { setEditingNote(null); setEditorOpen(true); };
    const openEdit = (n) => { setEditingNote(n); setEditorOpen(true); };
    const closeEditor = () => { setEditorOpen(false); setEditingNote(null); };
    const onSaved = () => { closeEditor(); load(); };

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
        ? notes.filter(n =>
            (n.body || "").toLowerCase().includes(search.trim().toLowerCase()) ||
            (n.stocks || []).some(s => (s.symbol || "").toLowerCase().includes(search.trim().toLowerCase())))
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
                    <div className="flex items-center gap-2">
                        <button onClick={openNew}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white
                                           text-xs font-semibold rounded-lg transition-colors">
                            + New note
                        </button>
                        <button onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                           text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                    </div>
                </div>

                {/* Search */}
                {notes.length > 0 && (
                    <div className="flex-shrink-0 px-4 py-2 border-b border-slate-700/40">
                        <input value={search} onChange={e => setSearch(e.target.value)}
                               placeholder="Search notes or linked stocks…"
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
                            <p className="text-slate-400 text-sm mb-4">
                                {search.trim() ? "No notes match your search." : "No notes yet."}
                            </p>
                            {!search.trim() && (
                                <button onClick={openNew}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                                                   text-sm font-semibold rounded-xl transition-colors">
                                    + Write your first note
                                </button>
                            )}
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
                                            <button onClick={() => openEdit(n)} title="Edit"
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                                               text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors">✏️</button>
                                            <button onClick={() => remove(n.id)} title="Delete"
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                                                               text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">🗑</button>
                                        </div>
                                    </div>

                                    {/* Linked stocks — plain symbol chips (no $) */}
                                    {(n.stocks && n.stocks.length > 0) && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {n.stocks.map(s => (
                                                <span key={s.symbol}
                                                      className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-300
                                                                 border border-blue-500/35 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                                                    {s.symbol}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Reminders: upcoming (amber) + fired (muted) */}
                                    {(upcoming.length > 0 || fired.length > 0) && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {upcoming.map((r, i) => (
                                                <span key={"u" + i} className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300
                                                                               border border-amber-500/40 text-[10px] font-semibold px-2 py-0.5 rounded-lg">
                                                    ⏰ {fmtRemind(r.remindAt)}
                                                </span>
                                            ))}
                                            {fired.map((r, i) => (
                                                <span key={"f" + i} className="inline-flex items-center gap-1 bg-slate-700/50 text-slate-500
                                                                               text-[10px] px-2 py-0.5 rounded-lg">
                                                    ✓ {fmtRemind(r.firedAt || r.remindAt)}
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
            </div>

            {/* Create / edit modal — the real editor with Link stock + reminders */}
            {editorOpen && (
                <NoteEditor
                    note={editingNote}
                    onClose={closeEditor}
                    onSaved={onSaved}
                />
            )}
        </div>,
        document.body
    );
}