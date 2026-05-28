import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getThread, replyToThread } from "../api/contact";
import { markContactRead } from "../api/admin";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function validateMagicBytes(file) {
    const buf   = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (file.type === "image/jpeg") return bytes[0] === 0xFF && bytes[1] === 0xD8;
    if (file.type === "image/png")  return bytes[0] === 0x89 && bytes[1] === 0x50;
    if (file.type === "image/webp") return bytes[0] === 0x52 && bytes[1] === 0x49;
    return false;
}

function fileToBase64(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}

const fmtDate = (d) => {
    if (!d) return "";
    const dt  = new Date(d);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === dt.toDateString();
    if (isToday)     return "Today";
    if (isYesterday) return "Yesterday";
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN",
    { hour: "2-digit", minute: "2-digit", hour12: true });

function DateSeparator({ date }) {
    return (
        <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-xs text-slate-500 bg-slate-900 px-2">{date}</span>
            <div className="flex-1 h-px bg-slate-700/60" />
        </div>
    );
}

export default function ContactThreadModal({ rootId, onClose, onReplied }) {
    const { isCreator, user } = useAuth();
    const [messages,  setMessages]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [text,      setText]      = useState("");
    const [images,    setImages]    = useState([]);
    const [sending,   setSending]   = useState(false);
    const [error,     setError]     = useState("");
    const fileRef    = useRef(null);
    const [lightbox,  setLightbox]  = useState(null); // src string when image is open
    const bottomRef  = useRef(null);
    const inputRef   = useRef(null);

    const loadThread = async () => {
        setLoading(true);
        try {
            const msgs = await getThread(rootId);
            setMessages(msgs || []);
            // Mark root as read if creator is viewing
            if (isCreator) await markContactRead(rootId).catch(() => {});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadThread(); }, [rootId]);

    // Scroll to bottom when messages load/update
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ESC close
    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    const handleFiles = async (files) => {
        setError("");
        for (const file of Array.from(files).slice(0, 3 - images.length)) {
            if (!ALLOWED_TYPES.includes(file.type)) {
                setError("Only JPEG, PNG, WebP images allowed"); continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError("Each image must be under 5MB"); continue;
            }
            if (!await validateMagicBytes(file)) {
                setError("Invalid image file"); continue;
            }
            const b64 = await fileToBase64(file);
            setImages(prev => [...prev, { preview: b64, base64: b64 }]);
        }
    };

    const handleSend = async () => {
        if (!text.trim() && images.length === 0) return;
        setSending(true);
        setError("");
        try {
            const reply = await replyToThread(rootId, {
                messageText: text.trim(),
                images: images.map(i => i.base64),
            });
            setMessages(prev => [...prev, reply]);
            setText("");
            setImages([]);
            onReplied?.();
        } catch (err) {
            setError(err.response?.data || "Failed to send");
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Group messages by date for separators
    const grouped = [];
    let lastDate = null;
    messages.forEach(msg => {
        const d = fmtDate(msg.sentAt);
        if (d !== lastDate) {
            grouped.push({ type: "separator", date: d });
            lastDate = d;
        }
        grouped.push({ type: "message", msg });
    });

    const root = messages.find(m => !m.parentId) || messages[0];

    return (
        <>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
             style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
             onClick={() => { if (!lightbox) onClose(); }}>
            <div className="w-full max-w-2xl h-full max-h-[90vh] bg-slate-900
                            border border-slate-700 rounded-2xl flex flex-col
                            overflow-hidden shadow-2xl"
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60
                                flex-shrink-0 bg-slate-900">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br
                                    from-blue-600/40 to-purple-600/40
                                    border border-slate-600 flex items-center
                                    justify-center text-white font-bold text-sm flex-shrink-0">
                        {isCreator
                            ? (root?.senderName?.[0]?.toUpperCase() || "?")
                            : "S"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">
                            {isCreator
                                ? (root?.senderName || "Anonymous")
                                : "Sarthak"}
                        </p>
                        <p className="text-slate-500 text-xs">
                            {isCreator ? "Client" : "Admin · FOLYO"} ·
                            {" "}{messages.length} message{messages.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white
                                       hover:bg-slate-700 rounded-xl transition-colors">
                        ✕
                    </button>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-6 h-6 border-2 border-blue-500
                                            border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-500 text-sm">No messages yet</p>
                        </div>
                    ) : grouped.map((item, i) => {
                        if (item.type === "separator")
                            return <DateSeparator key={i} date={item.date} />;

                        const { msg } = item;
                        const isMine = isCreator ? msg.isFromAdmin : !msg.isFromAdmin;

                        let imgs = [];
                        if (msg.imagesJson) {
                            try { imgs = JSON.parse(msg.imagesJson); } catch {}
                        }

                        return (
                            <div key={msg.id}
                                 className={"flex mb-2 " + (isMine ? "justify-end" : "justify-start")}>
                                <div className={"max-w-[75%] " + (isMine ? "items-end" : "items-start")
                                + " flex flex-col gap-1"}>
                                    {/* Bubble */}
                                    <div className={"px-4 py-2.5 rounded-2xl text-sm leading-relaxed " +
                                    (isMine
                                        ? "bg-blue-600 text-white rounded-br-sm"
                                        : "bg-slate-800 text-slate-200 rounded-bl-sm")}>
                                        {msg.messageText && (
                                            <p className="whitespace-pre-wrap">{msg.messageText}</p>
                                        )}
                                        {imgs.length > 0 && (
                                            <div className={"flex gap-1.5 flex-wrap " +
                                            (msg.messageText ? "mt-2" : "")}>
                                                {imgs.map((src, idx) => (
                                                    <img key={idx} src={src}
                                                         alt="attachment"
                                                         className="w-28 h-28 object-cover
                                                                    rounded-xl cursor-pointer
                                                                    hover:opacity-90 transition-opacity
                                                                    hover:ring-2 hover:ring-blue-400"
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             setLightbox(src);
                                                         }} />
                                                ))}
                                            </div>
                                        )}
                                        {/* Deleted image notice */}
                                        {!msg.messageText && imgs.length === 0 && (
                                            <p className="text-xs opacity-60 italic">
                                                🖼 Image deleted after 7 days
                                            </p>
                                        )}
                                    </div>
                                    {/* Time */}
                                    <span className="text-[10px] text-slate-600 px-1">
                                        {fmtTime(msg.sentAt)}
                                        {isMine && msg.isRead && (
                                            <span className="ml-1 text-blue-400">✓ Seen</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* Image preview strip */}
                {images.length > 0 && (
                    <div className="flex gap-2 px-4 py-2 flex-shrink-0 border-t border-slate-800">
                        {images.map((img, i) => (
                            <div key={i} className="relative group">
                                <img src={img.preview} alt=""
                                     className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
                                <button onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500
                                                   text-white rounded-full text-[10px] flex items-center
                                                   justify-center opacity-0 group-hover:opacity-100
                                                   transition-opacity">
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <p className="text-red-400 text-xs px-4 pb-1 flex-shrink-0">{error}</p>
                )}

                {/* Input area */}
                <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-700/60
                                flex-shrink-0 bg-slate-900">
                    {/* Attach image */}
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={images.length >= 3}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700
                                   rounded-xl transition-colors flex-shrink-0 disabled:opacity-30"
                        title="Attach image">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor"
                             strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4
                                     4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                    </button>
                    <input ref={fileRef} type="file"
                           accept="image/jpeg,image/png,image/webp"
                           multiple className="hidden"
                           onChange={e => handleFiles(e.target.files)} />

                    {/* Text input */}
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                        rows={1}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl
                                   px-4 py-2.5 text-white text-sm focus:outline-none
                                   focus:border-blue-500 resize-none placeholder:text-slate-600
                                   max-h-32 overflow-y-auto"
                        style={{ minHeight: "42px" }}
                        onInput={e => {
                            e.target.style.height = "auto";
                            e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
                        }}
                    />

                    {/* Send button */}
                    <button
                        onClick={handleSend}
                        disabled={sending || (!text.trim() && images.length === 0)}
                        className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                   text-white rounded-xl transition-colors flex-shrink-0
                                   disabled:cursor-not-allowed">
                        {sending ? (
                            <div className="w-5 h-5 border-2 border-white/30
                                            border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor"
                                 strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                            </svg>
                        )}
                    </button>
                </div>

                <div className="px-4 pb-2 flex-shrink-0">
                    <p className="text-slate-700 text-[10px] text-center">
                        Images are automatically deleted after 7 days · FOLYO
                    </p>
                </div>
            </div>
        </div>
            {/* ── Image lightbox ── */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center
                               bg-black/95 backdrop-blur-sm"
                    onClick={() => setLightbox(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh]"
                         onClick={e => e.stopPropagation()}>
                        <img src={lightbox} alt="full size"
                             className="max-w-full max-h-[85vh] object-contain rounded-xl
                                        shadow-2xl" />
                        <button
                            onClick={() => setLightbox(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 bg-slate-700
                                       hover:bg-red-600 text-white rounded-full
                                       flex items-center justify-center text-sm
                                       transition-colors shadow-lg">
                            ✕
                        </button>
                        <p className="text-slate-500 text-xs text-center mt-3">
                            Click anywhere outside to close
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}