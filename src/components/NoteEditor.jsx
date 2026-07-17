import { useState, useEffect, useRef } from "react";
import StockLogo from "../components/StockLogo";
import { searchStocks } from "../api/portfolio";
import { createNote, updateNote } from "../api/notes";

// 9:30 AM (local/IST) N days from now — the default nudge time.
function atMorning(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(9, 30, 0, 0);
    return d;
}
function fmtRemind(d) {
    return d.toLocaleString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
        hour: "numeric", minute: "2-digit", hour12: true,
    });
}
function toLocalInput(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const sameMinute = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() && a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();

// -- inline "+ Link stock" search (same debounced pattern as the alert search) --
function LinkStockSearch({ onPick, onClose }) {
    const [query,   setQuery]   = useState("");
    const [results, setResults] = useState([]);
    const timer = useRef(null);
    const reqId = useRef(0);
    const boxRef = useRef(null);

    const handleInput = (val) => {
        setQuery(val);
        if (!val.trim()) { clearTimeout(timer.current); reqId.current++; setResults([]); return; }
        clearTimeout(timer.current);
        const myId = ++reqId.current;
        timer.current = setTimeout(() => {
            searchStocks(val).then(r => {
                if (myId !== reqId.current) return;
                setResults((r.data?.content || r.data || []).slice(0, 8));
            }).catch(() => {});
        }, 300);
    };

    useEffect(() => {
        const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) onClose(); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
        };
    }, [onClose]);

    return (
        <div className="relative mt-2" ref={boxRef}>
            <input
                autoFocus
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Search a stock to link (e.g. RELIANCE, Tata…)"
                className="w-full bg-slate-900 border border-blue-500 rounded-xl px-3 py-2.5
                           text-white text-sm placeholder-slate-500 focus:outline-none"
            />
            {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-900 border
                                border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {results.map(s => (
                        <button key={s.id || s.symbol}
                                onClick={() => onPick({ symbol: s.symbol, name: s.name, exchange: s.exchange })}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 text-left">
                            <StockLogo symbol={s.symbol} name={s.name} size={26} />
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-semibold text-sm truncate">{s.symbol}</p>
                                <p className="text-slate-500 text-xs truncate">{s.name}</p>
                            </div>
                            <span className="text-xs text-slate-600">{s.exchange}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function NoteEditor({ note, initialStock, onClose, onSaved }) {
    const editing = !!note;
    const [body, setBody] = useState(note?.body || "");
    const [stocks, setStocks] = useState(
        note?.stocks?.length ? note.stocks
            : initialStock ? [{ symbol: initialStock.symbol, name: initialStock.name, exchange: initialStock.exchange }]
                : []
    );
    // Multiple reminders — array of Date objects (only the upcoming/unfired ones are editable).
    const [reminders, setReminders] = useState(
        (note?.reminders || []).filter(r => !r.fired).map(r => new Date(r.remindAt))
    );
    const [showSearch, setShowSearch] = useState(false);
    const [showCustom, setShowCustom] = useState(false);
    const [customVal, setCustomVal]   = useState("");
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState("");

    const addStock = (s) => {
        setStocks(prev => prev.some(x => x.symbol === s.symbol) ? prev : [...prev, s]);
        setShowSearch(false);
    };
    const removeStock = (sym) => setStocks(prev => prev.filter(x => x.symbol !== sym));

    const addReminder = (d) => {
        setReminders(prev => prev.some(x => sameMinute(x, d))
            ? prev
            : [...prev, d].sort((a, b) => a - b));
    };
    const removeReminder = (idx) => setReminders(prev => prev.filter((_, i) => i !== idx));

    const addCustom = () => {
        if (!customVal) return;
        addReminder(new Date(customVal));
        setCustomVal(""); setShowCustom(false);
    };

    const save = async () => {
        if (!body.trim()) { setError("Write something first."); return; }
        setBusy(true); setError("");
        const payload = {
            body: body.trim(),
            stocks,
            reminders: reminders.map(d => d.toISOString()),
        };
        try {
            const saved = editing ? await updateNote(note.id, payload) : await createNote(payload);
            onSaved(saved);
        } catch (e) {
            setError(e?.response?.data?.message || e?.response?.data?.error || "Could not save the note.");
        } finally {
            setBusy(false);
        }
    };

    const quick = (label, days) =>
        <button type="button" onClick={() => addReminder(atMorning(days))}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border
                       bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50
                       hover:text-amber-300 transition-colors">
            + {label}
        </button>;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end sm:items-center
                        justify-center sm:p-4">
            <div className="bg-slate-800 border border-slate-700 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl
                            shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                    <p className="text-white font-bold">{editing ? "Edit note" : "New note"}</p>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-4">
                    {/* Linked stock chips (top, stable) */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {stocks.map(s => (
                            <span key={s.symbol}
                                  className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-300
                                             border border-blue-500/35 text-xs font-semibold px-2 py-1 rounded-lg">
                                {s.symbol}
                                <button onClick={() => removeStock(s.symbol)} className="text-blue-300/60 hover:text-blue-200">✕</button>
                            </span>
                        ))}
                        {stocks.length === 0 && !showSearch && (
                            <span className="text-slate-600 text-xs self-center">No stock linked (optional)</span>
                        )}
                    </div>

                    {/* Free text */}
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={5}
                        autoFocus={!editing && stocks.length === 0}
                        placeholder="What are you thinking? A stock idea, a sector view, or just your own learning… (any language)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5
                                   text-white text-sm leading-relaxed placeholder-slate-600
                                   focus:outline-none focus:border-blue-500 resize-none"
                    />

                    {/* + Link stock */}
                    {showSearch
                        ? <LinkStockSearch onPick={addStock} onClose={() => setShowSearch(false)} />
                        : <button onClick={() => setShowSearch(true)}
                                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold
                                       bg-blue-500/15 text-blue-300 border border-blue-500/35
                                       px-3 py-1.5 rounded-lg hover:bg-blue-500/25 transition-colors">
                            🔗 Link stock
                        </button>
                    }

                    {/* Reminders (multiple) */}
                    <div className="mt-4">
                        <p className="text-[11px] text-slate-500 font-semibold mb-1.5">⏰ Reminders (optional, add as many as you like)</p>

                        {/* selected reminder chips */}
                        {reminders.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {reminders.map((d, i) => (
                                    <span key={i}
                                          className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-300
                                                     border border-amber-500/40 text-[11px] font-semibold px-2 py-1 rounded-lg">
                                        ⏰ {fmtRemind(d)}
                                        <button onClick={() => removeReminder(i)} className="text-amber-300/60 hover:text-amber-200">✕</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* quick-add pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {quick("Tomorrow", 1)}
                            {quick("In 2 days", 2)}
                            {quick("Next week", 7)}
                            <button type="button" onClick={() => setShowCustom(v => !v)}
                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border
                                           bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50
                                           hover:text-amber-300 transition-colors">
                                + Custom
                            </button>
                        </div>

                        {showCustom && (
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="datetime-local"
                                    value={customVal}
                                    onChange={e => setCustomVal(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2
                                               text-white text-sm focus:outline-none focus:border-amber-500"
                                />
                                <button onClick={addCustom}
                                        className="text-xs font-semibold bg-amber-500/20 border border-amber-500/40
                                                   text-amber-300 px-3 py-2 rounded-xl">
                                    Add
                                </button>
                            </div>
                        )}
                    </div>

                    {error && <p className="text-red-400 text-xs mt-3 mb-1">{error}</p>}
                </div>

                {/* Sticky footer — always visible, clears the bottom nav / home indicator */}
                <div className="shrink-0 flex items-center gap-2 px-4 border-t border-slate-700/50"
                     style={{ paddingTop: "0.75rem",
                         paddingBottom: "calc(0.9rem + env(safe-area-inset-bottom))" }}>
                    <button onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600
                                       text-slate-200 text-sm font-semibold transition-colors">
                        Cancel
                    </button>
                    <button onClick={save} disabled={busy}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                       text-white text-sm font-semibold transition-colors">
                        {busy ? "Saving…" : editing ? "Save changes" : "Save note"}
                    </button>
                </div>
            </div>
        </div>
    );
}