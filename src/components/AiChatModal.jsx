import { useState, useEffect, useRef, useCallback } from "react";
import { sendChatMessage, getChatSessions, getChatHistory } from "../api/ai";

const newSessionId = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });

// ── Level config ──────────────────────────────────────────────────────────────
const LEVELS = [
    {
        id:      "beginner",
        label:   "Beginner",
        emoji:   "🌱",
        desc:    "New to investing",
        context: "Please explain in very simple terms, avoid technical jargon, " +
            "use everyday language and relatable examples. I am new to investing.",
        color:   "green",
        suggestions: [
            "What is a mutual fund and how does it work?",
            "How do I start investing in stocks with a small amount?",
            "What is the difference between stocks and mutual funds?",
            "Is it safe to invest in the stock market?",
        ],
    },
    {
        id:      "intermediate",
        label:   "Intermediate",
        emoji:   "📈",
        desc:    "Know P/E, SIP, market cap",
        context: "I understand basics like P/E ratio, market cap, SIP, and NAV. " +
            "Use standard finance terms but explain advanced concepts briefly.",
        color:   "blue",
        suggestions: [
            "What is P/E ratio and how should I use it when picking stocks?",
            "Explain how SIP works and why it's better than lump sum in volatile markets",
            "What's the difference between large cap, mid cap, and small cap funds?",
            "How is LTCG tax calculated on equity mutual funds in India?",
        ],
    },
    {
        id:      "advanced",
        label:   "Advanced",
        emoji:   "🔬",
        desc:    "PEG ratio, FCF, derivatives",
        context: "I am an experienced investor familiar with DCF, PEG ratio, " +
            "free cash flow, derivatives, and technical analysis. " +
            "Use technical terms freely and go deep into the analysis.",
        color:   "purple",
        suggestions: [
            "What is PEG ratio and how does it compare to P/E for growth stocks?",
            "Explain free cash flow yield and how to use it for stock valuation",
            "How to analyse a company using ROCE vs ROE vs ROIC?",
            "What is the impact of RBI repo rate changes on equity and debt fund NAVs?",
        ],
    },
];

const LEVEL_STYLES = {
    green:  {
        badge:    "bg-green-900/30 border-green-500/40 text-green-300",
        active:   "bg-green-600 text-white",
        inactive: "bg-slate-800 text-slate-400 hover:text-white border border-slate-700",
    },
    blue:   {
        badge:    "bg-blue-900/30 border-blue-500/40 text-blue-300",
        active:   "bg-blue-600 text-white",
        inactive: "bg-slate-800 text-slate-400 hover:text-white border border-slate-700",
    },
    purple: {
        badge:    "bg-purple-900/30 border-purple-500/40 text-purple-300",
        active:   "bg-purple-600 text-white",
        inactive: "bg-slate-800 text-slate-400 hover:text-white border border-slate-700",
    },
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderInline(text) {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
            ? <strong key={i} className="text-white font-semibold">
                {part.slice(2, -2)}
            </strong>
            : part
    );
}

function MarkdownMessage({ text }) {
    if (!text) return null;
    const lines = text.split("\n");
    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                if (line.startsWith("## ") || line.startsWith("### "))
                    return <p key={i} className="font-bold text-white text-sm mt-2 mb-0.5">
                        {line.replace(/^#+\s/, "")}
                    </p>;
                if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* "))
                    return <div key={i} className="flex items-start gap-2">
                        <span className="text-blue-400 flex-shrink-0 mt-0.5 text-xs">●</span>
                        <span className="text-sm leading-relaxed">
                            {renderInline(line.replace(/^[-•*]\s/, ""))}
                        </span>
                    </div>;
                if (line.trim() === "---")
                    return <hr key={i} className="border-slate-600 my-2"/>;
                if (line.trim() === "")
                    return <div key={i} className="h-1.5"/>;
                if (line.startsWith("_") && line.endsWith("_"))
                    return <p key={i} className="text-xs text-slate-500 italic mt-2">
                        {line.slice(1, -1)}
                    </p>;
                return <p key={i} className="text-sm leading-relaxed">
                    {renderInline(line)}
                </p>;
            })}
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center gap-1 px-4 py-3">
            {[0, 1, 2].map(i => (
                <div key={i}
                     className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                     style={{ animationDelay: `${i * 0.15}s` }}/>
            ))}
        </div>
    );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function AiChatModal({ onClose }) {
    const [sessionId,    setSessionId]    = useState(() => newSessionId());
    const [messages,     setMessages]     = useState([]);
    const [input,        setInput]        = useState("");
    const [loading,      setLoading]      = useState(false);
    const [sessions,     setSessions]     = useState([]);
    const [showSessions, setShowSessions] = useState(false);
    const [error,        setError]        = useState("");
    // Idea 3: persistent level state
    const [level,        setLevel]        = useState("intermediate");
    const [showLevelDrop,setShowLevelDrop]= useState(false);
    const levelDropRef   = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef       = useRef(null);

    const currentLevel = LEVELS.find(l => l.id === level) || LEVELS[1];

    useEffect(() => {
        getChatSessions().then(r => setSessions(r.data || [])).catch(() => {});
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Close level dropdown on outside click
    useEffect(() => {
        const h = (e) => {
            if (levelDropRef.current && !levelDropRef.current.contains(e.target))
                setShowLevelDrop(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // ── Send message — silently appends level context ─────────────────────────
    const sendMessage = useCallback(async (text) => {
        const msg = text || input.trim();
        if (!msg || loading) return;

        // What user sees in the chat bubble
        const displayMsg = msg;
        // What Gemini actually receives — includes level context silently
        const enrichedMsg = `${msg}\n\n[User level context: ${currentLevel.context}]`;

        setInput("");
        setError("");
        setMessages(prev => [...prev, {
            role: "user", content: displayMsg, id: Date.now()
        }]);
        setLoading(true);

        try {
            const res = await sendChatMessage(sessionId, enrichedMsg);
            setMessages(prev => [...prev, {
                role: "assistant", content: res.data.response, id: Date.now() + 1,
            }]);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [input, loading, sessionId, currentLevel]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); sendMessage();
        }
    };

    const startNewSession = () => {
        setSessionId(newSessionId());
        setMessages([]); setInput(""); setError("");
        setShowSessions(false);
    };

    const loadSession = async (sid) => {
        try {
            const res = await getChatHistory(sid);
            setSessionId(sid);
            setMessages(res.data.map((m, i) => ({
                id: i, role: m.role, content: m.content,
            })));
            setShowSessions(false);
        } catch { setError("Failed to load session."); }
    };

    const isEmpty = messages.length === 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center
                        justify-center p-0 md:p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
            <div className="w-full md:max-w-2xl h-[92vh] md:h-[85vh] bg-slate-900
                            border border-slate-700 rounded-t-3xl md:rounded-2xl
                            shadow-2xl flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-slate-700/60 flex-shrink-0
                                bg-gradient-to-r from-slate-900 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br
                                        from-blue-600 to-purple-600 flex items-center
                                        justify-center text-lg shadow-lg shadow-blue-900/40">
                            ✨
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-sm">MarketSync AI</h2>
                            <p className="text-slate-500 text-xs">
                                Indian markets · Stocks · Mutual Funds
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">

                        {/* Idea 3: Level badge + dropdown */}
                        <div ref={levelDropRef} className="relative">
                            <button
                                onClick={() => setShowLevelDrop(v => !v)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5
                                           border rounded-lg text-xs font-semibold
                                           transition-colors ${
                                    LEVEL_STYLES[currentLevel.color].badge
                                }`}>
                                <span>{currentLevel.emoji}</span>
                                <span className="hidden sm:block">{currentLevel.label}</span>
                                <span className="text-[10px] opacity-60">▾</span>
                            </button>

                            {showLevelDrop && (
                                <div className="absolute right-0 top-full mt-1.5 w-56
                                                bg-slate-800 border border-slate-700
                                                rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <p className="text-slate-500 text-[10px] font-bold
                                                  uppercase tracking-widest px-3 pt-3 pb-1.5">
                                        Explain answers as if I am:
                                    </p>
                                    {LEVELS.map(l => (
                                        <button key={l.id}
                                                onClick={() => {
                                                    setLevel(l.id);
                                                    setShowLevelDrop(false);
                                                }}
                                                className={`w-full text-left px-3 py-2.5
                                                           flex items-start gap-3
                                                           transition-colors last:rounded-b-xl
                                                           ${level === l.id
                                                    ? "bg-slate-700/80"
                                                    : "hover:bg-slate-700/40"}`}>
                                            <span className="text-lg flex-shrink-0 mt-0.5">
                                                {l.emoji}
                                            </span>
                                            <div>
                                                <p className={`text-sm font-semibold ${
                                                    level === l.id
                                                        ? "text-white" : "text-slate-300"
                                                }`}>
                                                    {l.label}
                                                    {level === l.id && (
                                                        <span className="text-blue-400 ml-2
                                                                         text-xs">✓</span>
                                                    )}
                                                </p>
                                                <p className="text-slate-500 text-xs mt-0.5">
                                                    {l.desc}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                    <p className="text-slate-600 text-[10px] px-3 pb-3 pt-1">
                                        Affects how answers are explained
                                    </p>
                                </div>
                            )}
                        </div>

                        <button onClick={() => setShowSessions(v => !v)}
                                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700
                                           border border-slate-700 rounded-lg text-slate-400
                                           hover:text-white transition-colors">
                            🕐 History
                        </button>
                        <button onClick={startNewSession}
                                className="text-xs px-3 py-1.5 bg-blue-600/20
                                           hover:bg-blue-600/40 border border-blue-500/30
                                           rounded-lg text-blue-400 hover:text-blue-300
                                           transition-colors">
                            + New
                        </button>
                        <button onClick={onClose}
                                className="text-slate-500 hover:text-white text-xl
                                           leading-none transition-colors ml-1">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Session history panel */}
                {showSessions && (
                    <div className="flex-shrink-0 border-b border-slate-700/60
                                    bg-slate-800/80 max-h-48 overflow-y-auto">
                        {sessions.length === 0 ? (
                            <p className="text-slate-500 text-xs text-center py-4">
                                No previous sessions
                            </p>
                        ) : sessions.map((s, i) => (
                            <button key={i} onClick={() => loadSession(s.sessionId)}
                                    className="w-full text-left px-4 py-2.5
                                               hover:bg-slate-700/60 border-b
                                               border-slate-700/30 last:border-0
                                               transition-colors">
                                <p className="text-slate-300 text-xs font-medium truncate">
                                    {s.preview || "Session " + (i + 1)}
                                </p>
                                <p className="text-slate-600 text-[10px] mt-0.5">
                                    {s.messageCount} messages
                                </p>
                            </button>
                        ))}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

                    {/* ── Idea 2: Empty state with level toggle + level-aware suggestions ── */}
                    {isEmpty && (
                        <div className="h-full flex flex-col items-center
                                        justify-center gap-5 py-6">
                            {/* Icon + title */}
                            <div className="text-center">
                                <div className="w-14 h-14 mx-auto rounded-2xl
                                                bg-gradient-to-br from-blue-600/20
                                                to-purple-600/20 border border-blue-500/20
                                                flex items-center justify-center
                                                text-2xl mb-3">
                                    ✨
                                </div>
                                <h3 className="text-white font-bold text-base mb-1">
                                    Ask me anything about markets
                                </h3>
                                <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                                    Stocks, mutual funds, portfolio strategy, taxation —
                                    I'm here to help you understand Indian markets better.
                                </p>
                            </div>

                            {/* Level selector */}
                            <div className="w-full max-w-lg">
                                <p className="text-slate-500 text-xs text-center mb-2">
                                    How familiar are you with investing?
                                </p>
                                <div className="flex gap-2 justify-center">
                                    {LEVELS.map(l => (
                                        <button key={l.id}
                                                onClick={() => setLevel(l.id)}
                                                className={`flex items-center gap-1.5
                                                           px-3 py-2 rounded-xl text-xs
                                                           font-semibold transition-all
                                                           border ${
                                                    level === l.id
                                                        ? LEVEL_STYLES[l.color].active +
                                                        " border-transparent shadow-lg"
                                                        : LEVEL_STYLES[l.color].inactive
                                                }`}>
                                            <span>{l.emoji}</span>
                                            <span>{l.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-slate-600 text-[10px] text-center mt-1.5">
                                    {currentLevel.desc} · affects how answers are explained
                                </p>
                            </div>

                            {/* Level-aware suggested questions */}
                            <div className="w-full max-w-lg grid grid-cols-1 gap-2">
                                {currentLevel.suggestions.map((q, i) => (
                                    <button key={`${level}-${i}`}
                                            onClick={() => sendMessage(q)}
                                            className="text-left px-4 py-3 bg-slate-800/60
                                                       hover:bg-slate-700/80 border
                                                       border-slate-700/60
                                                       hover:border-blue-500/40 rounded-xl
                                                       text-slate-300 hover:text-white
                                                       text-xs transition-all leading-relaxed">
                                        <span className="text-blue-400 mr-2">→</span>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message bubbles */}
                    {messages.map(msg => (
                        <div key={msg.id}
                             className={`flex ${
                                 msg.role === "user" ? "justify-end" : "justify-start"
                             }`}>
                            {msg.role === "assistant" && (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br
                                                from-blue-600 to-purple-600 flex items-center
                                                justify-center text-sm flex-shrink-0
                                                mr-2 mt-1">
                                    ✨
                                </div>
                            )}
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-tr-sm"
                                    : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50"
                            }`}>
                                {msg.role === "user"
                                    ? <p className="text-sm leading-relaxed">{msg.content}</p>
                                    : <MarkdownMessage text={msg.content}/>
                                }
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br
                                            from-blue-600 to-purple-600 flex items-center
                                            justify-center text-sm flex-shrink-0 mr-2 mt-1">
                                ✨
                            </div>
                            <div className="bg-slate-800 border border-slate-700/50
                                            rounded-2xl rounded-tl-sm">
                                <TypingDots/>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/30 border border-red-700/40 rounded-xl
                                        px-4 py-2.5 text-red-300 text-xs text-center">
                            {error}
                        </div>
                    )}

                    <div ref={messagesEndRef}/>
                </div>

                {/* ── Input area ── */}
                <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-slate-700/60
                                bg-slate-900/80">
                    {/* Level indicator above input when chat has started */}
                    {!isEmpty && (
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-slate-600 text-[10px]">Answering as:</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5
                                            rounded-full border ${
                                LEVEL_STYLES[currentLevel.color].badge
                            }`}>
                                {currentLevel.emoji} {currentLevel.label}
                            </span>
                            <span className="text-slate-600 text-[10px]">
                                · change via header badge
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about any stock, MF, or concept... aap Hinglish mein bhi pooch sakte hain"
                                rows={1}
                                disabled={loading}
                                className="w-full bg-slate-800 border border-slate-600
                                           hover:border-slate-500 focus:border-blue-500
                                           rounded-xl px-4 py-3 text-white text-sm
                                           focus:outline-none transition-colors resize-none
                                           disabled:opacity-50 leading-relaxed"
                                style={{ minHeight: "44px", maxHeight: "120px" }}
                                onInput={e => {
                                    e.target.style.height = "auto";
                                    e.target.style.height =
                                        Math.min(e.target.scrollHeight, 120) + "px";
                                }}
                            />
                        </div>
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || loading}
                            className="flex-shrink-0 w-11 h-11 bg-blue-600
                                       hover:bg-blue-500 disabled:opacity-40
                                       disabled:cursor-not-allowed rounded-xl
                                       flex items-center justify-center
                                       transition-all active:scale-95 shadow-lg
                                       shadow-blue-900/30">
                            <span className="text-white text-base">↑</span>
                        </button>
                    </div>
                    <p className="text-center text-slate-700 text-[10px] mt-2">
                        Educational information only · Not personalized financial advice
                    </p>
                </div>
            </div>
        </div>
    );
}