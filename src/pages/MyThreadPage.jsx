// src/pages/MyThreadPage.jsx
// Client's side of the 1:1 idea/messaging thread with their advisor.
// Mirrors ThreadPage.jsx's visual language exactly — same bubble shapes,
// just senderType flipped (CREATOR messages render on the left here,
// CLIENT messages on the right — opposite of the creator's own screen).

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { getMyThread, sendMyThreadText, markIdeaActed } from "../api/thread";

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

function IdeaBubble({ m, onAct }) {
    const meta = SIGNAL_META[m.signalType] || { label: m.signalType, cls: "bg-slate-700 text-slate-300" };
    const [acting, setActing] = useState(false);

    const act = (dismissed) => {
        const note = dismissed
            ? null
            : window.prompt(`Mark ${m.stockSymbol} as done — add a note? (e.g. "Bought at ₹2,015 · 100 sh")`, "");
        if (!dismissed && note === null) return; // cancelled
        setActing(true);
        onAct(m.id, dismissed, note).finally(() => setActing(false));
    };

    return (
        <div className="w-64 bg-slate-800 border border-purple-500/30 rounded-2xl rounded-bl-md p-3">
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
            {m.ideaNote && <p className="text-slate-400 text-[11px] leading-relaxed mb-2">{m.ideaNote}</p>}

            {m.ideaStatus === "PENDING" ? (
                <div className="flex gap-1.5">
                    <button onClick={() => act(false)} disabled={acting}
                            className="flex-1 py-1.5 bg-purple-600 text-white text-[10.5px] font-bold rounded-lg disabled:opacity-50">
                        {acting ? "…" : "Mark as done"}
                    </button>
                    <button onClick={() => act(true)} disabled={acting}
                            className="flex-1 py-1.5 bg-slate-700 text-slate-300 text-[10.5px] font-bold rounded-lg disabled:opacity-50">
                        Dismiss
                    </button>
                </div>
            ) : (
                <p className="text-[9.5px] text-slate-600">
                    {m.ideaStatus === "ACTED" ? "✓ You marked this done" : "✕ Dismissed"}
                </p>
            )}
        </div>
    );
}

export default function MyThreadPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const bottomRef = useRef(null);

    const load = () => {
        getMyThread()
            .then(res => setMessages(res.data || []))
            .catch(() => toast.error("Couldn't load your thread"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

    const sendText = () => {
        const body = text.trim();
        if (!body) return;
        setText("");
        sendMyThreadText(body)
            .then(res => setMessages(prev => [...prev, res.data]))
            .catch(() => toast.error("Couldn't send message"));
    };

    const handleAct = (ideaId, dismissed, note) =>
        markIdeaActed(ideaId, dismissed, note)
            .then(res => {
                setMessages(prev => [
                    ...prev.map(m => m.id === ideaId ? { ...m, ideaStatus: dismissed ? "DISMISSED" : "ACTED" } : m),
                    res.data,
                ]);
            })
            .catch(() => toast.error("Couldn't update that"));

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
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">S</div>
                <div>
                    <p className="text-white font-bold text-sm">Sarthak</p>
                    <p className="text-slate-500 text-[10.5px]">Your advisor</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                {messages.length === 0 && (
                    <p className="text-center text-slate-600 text-xs mt-10">No messages yet.</p>
                )}
                {messages.map(m => {
                    const day = fmtDay(m.createdAt);
                    const showDay = day !== lastDay;
                    lastDay = day;
                    const isOut = m.senderType === "CLIENT";
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
                                        <IdeaBubble m={m} onAct={handleAct} />
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
                <input value={text} onChange={e => setText(e.target.value)}
                       onKeyDown={e => e.key === "Enter" && sendText()}
                       placeholder="Ask Sarthak a question…"
                       className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 text-white text-sm" />
                <button onClick={sendText}
                        className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white flex-shrink-0">
                    ➤
                </button>
            </div>
        </div>
    );
}