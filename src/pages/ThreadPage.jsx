// src/pages/ThreadPage.jsx
// Creator's side of the 1:1 idea/messaging thread with one tracked client.
// Vertical slice — no broadcast yet (see backend V35 migration comment).
// Matches the visual language of the HTML mockup: idea messages render as
// rich cards, plain replies as bubbles, action-resolution as centered
// system pills — all in one chronological scroll, same as any chat app.

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { getTrackedClient } from "../api/clientTracker";
import { getThread, sendThreadText, sendThreadIdea } from "../api/thread";
import { searchStocks } from "../api/portfolio";

const SIGNAL_META = {
    BUY:          { label: "Buy",          cls: "bg-green-900/30 text-green-400" },
    HOLD:         { label: "Hold",         cls: "bg-amber-900/30 text-amber-400" },
    ADD:          { label: "Add more",     cls: "bg-blue-900/30 text-blue-400" },
    SELL_PARTIAL: { label: "Sell partial", cls: "bg-amber-900/30 text-amber-400" },
    SELL_FULL:    { label: "Sell full",    cls: "bg-red-900/30 text-red-400" },
};

function fmtTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
function fmtDay(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function IdeaBubble({ m }) {
    const meta = SIGNAL_META[m.signalType] || { label: m.signalType, cls: "bg-slate-700 text-slate-300" };
    return (
        <div className="w-64 bg-slate-800 border border-purple-500/30 rounded-2xl rounded-br-md p-3">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-white font-bold text-sm">{m.stockSymbol}</p>
                    <p className="text-slate-500 text-[10px]">{m.stockName}</p>
                </div>
                <span className={"text-[10px] font-bold px-2.5 py-1 rounded-full uppercase " + meta.cls}>
                    {meta.label}
                </span>
            </div>
            {(m.buyRangeLow || m.targetPrice || m.stopLossPrice) && (
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {m.buyRangeLow && (
                        <div className="bg-slate-900/60 rounded-lg text-center py-1.5 px-1">
                            <p className="text-[8px] text-slate-500 uppercase">Buy</p>
                            <p className="text-[11px] font-bold text-white">{m.buyRangeLow}–{m.buyRangeHigh}</p>
                        </div>
                    )}
                    {m.targetPrice && (
                        <div className="bg-slate-900/60 rounded-lg text-center py-1.5 px-1">
                            <p className="text-[8px] text-slate-500 uppercase">Target</p>
                            <p className="text-[11px] font-bold text-white">{m.targetPrice}</p>
                        </div>
                    )}
                    {m.stopLossPrice && (
                        <div className="bg-slate-900/60 rounded-lg text-center py-1.5 px-1">
                            <p className="text-[8px] text-slate-500 uppercase">SL</p>
                            <p className="text-[11px] font-bold text-white">{m.stopLossPrice}</p>
                        </div>
                    )}
                </div>
            )}
            {m.ideaNote && <p className="text-slate-400 text-[11px] leading-relaxed mb-1.5">{m.ideaNote}</p>}
            <p className="text-[9.5px] text-slate-600">
                {m.ideaStatus === "PENDING" ? "⏳ Not yet acted" :
                    m.ideaStatus === "ACTED" ? "✓ Acted on" : "✕ Dismissed"}
            </p>
        </div>
    );
}

function IdeaComposer({ trackedClientId, onSent, onClose, toast }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [stock, setStock] = useState(null);
    const [signal, setSignal] = useState("BUY");
    const [buyLow, setBuyLow] = useState("");
    const [buyHigh, setBuyHigh] = useState("");
    const [target, setTarget] = useState("");
    const [sl, setSl] = useState("");
    const [sellPct, setSellPct] = useState("");
    const [note, setNote] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!query || query.length < 2 || stock) { setResults([]); return; }
        const t = setTimeout(() => {
            searchStocks(query).then(res => setResults(res.data?.content || res.data || [])).catch(() => {});
        }, 250);
        return () => clearTimeout(t);
    }, [query, stock]);

    const send = () => {
        if (!stock) { toast.error("Pick a stock first"); return; }
        setSending(true);
        sendThreadIdea(trackedClientId, {
            stockId: stock.id,
            signalType: signal,
            buyRangeLow: buyLow || null,
            buyRangeHigh: buyHigh || null,
            targetPrice: target || null,
            stopLossPrice: sl || null,
            sellQtyPercent: signal === "SELL_PARTIAL" ? (sellPct || null) : null,
            note: note || null,
        })
            .then(res => { onSent(res.data); onClose(); })
            .catch(() => toast.error("Couldn't send idea"))
            .finally(() => setSending(false));
    };

    return (
        <div className="fixed inset-0 z-[9700] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
             onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                 className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 max-h-[85vh] overflow-y-auto">
                <p className="text-white font-bold text-base mb-4">New idea</p>

                {!stock ? (
                    <>
                        <input value={query} onChange={e => setQuery(e.target.value)}
                               placeholder="Search stock…"
                               className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm mb-2" />
                        {results.map(s => (
                            <button key={s.id} onClick={() => { setStock(s); setResults([]); setQuery(""); }}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg">
                                <p className="text-white text-sm font-semibold">{s.symbol}</p>
                                <p className="text-slate-500 text-xs">{s.name}</p>
                            </button>
                        ))}
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2.5 mb-4">
                            <div><p className="text-white font-semibold text-sm">{stock.symbol}</p><p className="text-slate-500 text-xs">{stock.name}</p></div>
                            <button onClick={() => setStock(null)} className="text-slate-500 text-xs">Change</button>
                        </div>

                        <p className="text-slate-500 text-[11px] font-semibold uppercase mb-2">Signal</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {Object.entries(SIGNAL_META).map(([key, meta]) => (
                                <button key={key} onClick={() => setSignal(key)}
                                        className={"text-[11px] font-bold px-3 py-1.5 rounded-full uppercase " +
                                            (signal === key ? meta.cls + " ring-1 ring-inset ring-current" : "bg-slate-800 text-slate-500")}>
                                    {meta.label}
                                </button>
                            ))}
                        </div>

                        <p className="text-slate-500 text-[11px] font-semibold uppercase mb-2">Price levels (optional)</p>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input value={buyLow} onChange={e => setBuyLow(e.target.value)} placeholder="Buy low" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                            <input value={buyHigh} onChange={e => setBuyHigh(e.target.value)} placeholder="Buy high" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                            <input value={sl} onChange={e => setSl(e.target.value)} placeholder="Stop-loss" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                        </div>
                        {signal === "SELL_PARTIAL" && (
                            <input value={sellPct} onChange={e => setSellPct(e.target.value)} placeholder="% to sell" type="number"
                                   className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs mb-2" />
                        )}
                        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)…"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs mb-4 min-h-[60px]" />

                        <div className="flex gap-2">
                            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 text-white text-sm font-semibold rounded-xl">Cancel</button>
                            <button onClick={send} disabled={sending}
                                    className="flex-1 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                                {sending ? "Sending…" : "Send idea"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function ThreadPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [client, setClient] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [showIdeaComposer, setShowIdeaComposer] = useState(false);
    const bottomRef = useRef(null);

    const load = () => {
        Promise.all([getTrackedClient(id), getThread(id)])
            .then(([c, t]) => { setClient(c.data); setMessages(t.data || []); })
            .catch(() => toast.error("Couldn't load thread"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

    const sendText = () => {
        const body = text.trim();
        if (!body) return;
        setText("");
        sendThreadText(id, body)
            .then(res => setMessages(prev => [...prev, res.data]))
            .catch(() => toast.error("Couldn't send message"));
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>;
    }

    let lastDay = null;

    return (
        <div className="flex flex-col h-[100dvh] bg-slate-950">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 flex-shrink-0">
                <button onClick={() => navigate(-1)} className="text-slate-400 text-xl">←</button>
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {client?.displayName?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                    <p className="text-white font-bold text-sm">{client?.displayName}</p>
                    <p className="text-slate-500 text-[10.5px]">@{client?.mappedUsername || "unmapped"}</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                {messages.length === 0 && (
                    <p className="text-center text-slate-600 text-xs mt-10">No messages yet — send the first idea.</p>
                )}
                {messages.map(m => {
                    const day = fmtDay(m.createdAt);
                    const showDay = day !== lastDay;
                    lastDay = day;
                    const isOut = m.senderType === "CREATOR";
                    const isSystem = m.senderType === "SYSTEM";

                    return (
                        <div key={m.id}>
                            {showDay && <p className="text-center text-[10px] text-slate-600 font-semibold my-2">{day}</p>}
                            {isSystem ? (
                                <div className="flex justify-center">
                                    <span className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-[10.5px] text-slate-400">
                                        {m.body}
                                    </span>
                                </div>
                            ) : (
                                <div className={"flex flex-col " + (isOut ? "items-end" : "items-start")}>
                                    {m.messageType === "IDEA" ? (
                                        <IdeaBubble m={m} />
                                    ) : (
                                        <div className={"max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed " +
                                            (isOut ? "bg-purple-600 text-white rounded-br-md" : "bg-slate-800 border border-slate-700 text-white rounded-bl-md")}>
                                            {m.body}
                                        </div>
                                    )}
                                    <span className="text-[9.5px] text-slate-600 mt-1 px-1">
                                        {fmtTime(m.createdAt)}
                                        {isOut && m.seenAt && <span className="text-purple-400 ml-1">· Seen</span>}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-700/60 flex-shrink-0">
                <button onClick={() => setShowIdeaComposer(true)}
                        className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base flex-shrink-0">
                    📊
                </button>
                <input value={text} onChange={e => setText(e.target.value)}
                       onKeyDown={e => e.key === "Enter" && sendText()}
                       placeholder="Message or send an idea…"
                       className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 text-white text-sm" />
                <button onClick={sendText}
                        className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white flex-shrink-0">
                    ➤
                </button>
            </div>

            {showIdeaComposer && (
                <IdeaComposer
                    trackedClientId={id}
                    toast={toast}
                    onSent={(msg) => setMessages(prev => [...prev, msg])}
                    onClose={() => setShowIdeaComposer(false)}
                />
            )}
        </div>
    );
}