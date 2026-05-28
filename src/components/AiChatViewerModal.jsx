import { useState, useEffect, useRef } from "react";
import { getUserChatSession } from "../api/admin";

const fmtDate = (d) => {
    if (!d) return "";
    const dt  = new Date(d);
    const now = new Date();
    if (dt.toDateString() === now.toDateString()) return "Today";
    if (new Date(now - 86400000).toDateString() === dt.toDateString()) return "Yesterday";
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtTime = (d) => d
    ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

export default function AiChatViewerModal({ userId, sessionId, username, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const bottomRef = useRef(null);

    useEffect(() => {
        getUserChatSession(userId, sessionId)
            .then(data => setMessages(data?.messages || data || []))
            .catch(() => setMessages([]))
            .finally(() => setLoading(false));
    }, [userId, sessionId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    // Group by date for separators
    const grouped = [];
    let lastDate = null;
    messages.forEach(msg => {
        const d = fmtDate(msg.createdAt || msg.timestamp);
        if (d !== lastDate) {
            grouped.push({ type: "separator", date: d });
            lastDate = d;
        }
        grouped.push({ type: "message", msg });
    });

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6"
             style={{ backgroundColor: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)" }}
             onClick={onClose}>
            <div className="w-full max-w-3xl h-full max-h-[92vh] bg-slate-900
                            border border-slate-700 rounded-2xl flex flex-col
                            overflow-hidden shadow-2xl"
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4
                                border-b border-slate-700/60 flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br
                                    from-purple-600/40 to-blue-600/40
                                    border border-slate-600 flex items-center
                                    justify-center text-white font-bold text-sm">
                        {username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-semibold text-sm">{username}</p>
                        <p className="text-slate-500 text-xs">
                            FOLYO AI Chat · {messages.length} messages · Session {sessionId?.slice(0, 8)}
                        </p>
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white
                                       hover:bg-slate-700 rounded-xl transition-colors">
                        ✕
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-6 h-6 border-2 border-purple-500
                                            border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : grouped.map((item, i) => {
                        if (item.type === "separator") {
                            return (
                                <div key={i} className="flex items-center gap-3 my-4">
                                    <div className="flex-1 h-px bg-slate-700/60" />
                                    <span className="text-xs text-slate-500 bg-slate-900 px-2">
                                        {item.date}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-700/60" />
                                </div>
                            );
                        }

                        const { msg } = item;
                        const isUser = msg.role === "user";

                        return (
                            <div key={i}
                                 className={"flex mb-3 " + (isUser ? "justify-end" : "justify-start")}>
                                {!isUser && (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br
                                                    from-purple-600 to-blue-600 flex items-center
                                                    justify-center text-white text-xs font-bold
                                                    flex-shrink-0 mr-2 mt-0.5">
                                        AI
                                    </div>
                                )}
                                <div className={"max-w-[75%] flex flex-col " +
                                (isUser ? "items-end" : "items-start") + " gap-1"}>
                                    <div className={"px-4 py-3 rounded-2xl text-sm leading-relaxed " +
                                    (isUser
                                        ? "bg-blue-600 text-white rounded-br-sm"
                                        : "bg-slate-800 text-slate-200 rounded-bl-sm")}>
                                        <p className="whitespace-pre-wrap">
                                            {msg.content || msg.message || msg.text}
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-slate-600 px-1">
                                        {fmtTime(msg.createdAt || msg.timestamp)}
                                        {isUser && (
                                            <span className="ml-1 capitalize text-slate-700">
                                                · {msg.level || ""}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                <div className="px-5 py-2.5 border-t border-slate-800 flex-shrink-0">
                    <p className="text-slate-600 text-xs text-center italic">
                        Read-only view · FOLYO AI Chat transcript
                    </p>
                </div>
            </div>
        </div>
    );
}