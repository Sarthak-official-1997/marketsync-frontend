import { useState, useEffect } from "react";
import { getNotes, deleteNote, updateNote } from "../api/notes";
import NoteEditor from "./NoteEditor";

function fmtWhen(iso) {
    return new Date(iso).toLocaleString("en-IN", {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
    });
}
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Status line: next upcoming reminder (+count), else "reminded", else "added".
function ReminderStatus({ note }) {
    const upcoming = (note.reminders || []).filter(r => !r.fired)
        .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
    const fired = (note.reminders || []).filter(r => r.fired);

    if (upcoming.length > 0) {
        return (
            <span className="text-amber-300/90 font-semibold">
                ⏰ {fmtWhen(upcoming[0].remindAt)}
                {upcoming.length > 1 && <span className="text-amber-300/60"> +{upcoming.length - 1} more</span>}
            </span>
        );
    }
    if (fired.length > 0) {
        return <span className="text-slate-500">reminded {fmtWhen(fired[fired.length - 1].firedAt || fired[fired.length - 1].remindAt)}</span>;
    }
    return <span className="text-slate-600">added {fmtDate(note.createdAt)}</span>;
}

export default function NotesPanel() {
    const [notes,   setNotes]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [editor,  setEditor]  = useState(null);   // null | "new" | noteObject
    const [busyId,  setBusyId]  = useState(null);

    const load = () => {
        setLoading(true);
        getNotes().then(setNotes).catch(() => setNotes([])).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const onSaved = () => { setEditor(null); load(); };

    const remove = async (id) => {
        setBusyId(id);
        try { await deleteNote(id); setNotes(prev => prev.filter(n => n.id !== id)); }
        catch { /* keep it; user can retry */ }
        finally { setBusyId(null); }
    };

    const toggleDone = async (n) => {
        setBusyId(n.id);
        try { const upd = await updateNote(n.id, { done: !n.done }); setNotes(prev => prev.map(x => x.id === n.id ? upd : x)); }
        catch { /* no-op */ }
        finally { setBusyId(null); }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-xs">
                    {notes.length} note{notes.length === 1 ? "" : "s"} · your research pad
                </p>
                <button onClick={() => setEditor("new")}
                        className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white
                                   px-3 py-1.5 rounded-xl transition-colors">
                    + Add note
                </button>
            </div>

            {loading ? (
                <p className="text-slate-500 text-sm text-center py-10">Loading…</p>
            ) : notes.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-slate-400 text-sm">No notes yet.</p>
                    <p className="text-slate-600 text-xs mt-1">
                        Jot a stock idea, a sector view, or your own learning — link stocks and set reminders if you want.
                    </p>
                    <button onClick={() => setEditor("new")}
                            className="mt-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white
                                       px-4 py-2 rounded-xl">
                        + Add your first note
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {notes.map(n => (
                        <div key={n.id}
                             className={"bg-slate-800 border border-slate-700/60 rounded-xl p-3 " +
                             (n.done ? "opacity-55" : "")}>
                            {n.stocks?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                    {n.stocks.map(s => (
                                        <span key={s.symbol}
                                              className="text-[10px] font-semibold bg-blue-500/15 text-blue-300
                                                         border border-blue-500/30 px-1.5 py-0.5 rounded">
                                            {s.symbol}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <p className={"text-sm text-slate-200 whitespace-pre-wrap break-words " +
                            (n.done ? "line-through" : "")}>
                                {n.body}
                            </p>

                            <div className="flex items-center justify-between mt-2">
                                <div className="text-[11px]">
                                    <ReminderStatus note={n} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => toggleDone(n)} disabled={busyId === n.id}
                                            title={n.done ? "Mark not done" : "Mark done"}
                                            className="text-xs px-2 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700
                                                       text-slate-300 disabled:opacity-40">
                                        {n.done ? "↩︎" : "✓"}
                                    </button>
                                    <button onClick={() => setEditor(n)}
                                            className="text-xs px-2 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300">
                                        ✎
                                    </button>
                                    <button onClick={() => remove(n.id)} disabled={busyId === n.id}
                                            className="text-xs px-2 py-1 rounded-lg bg-red-900/30 hover:bg-red-900/60
                                                       text-red-400 disabled:opacity-40">
                                        🗑
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editor && (
                <NoteEditor
                    note={editor === "new" ? null : editor}
                    onClose={() => setEditor(null)}
                    onSaved={onSaved}
                />
            )}
        </div>
    );
}