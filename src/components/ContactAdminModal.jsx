import { useState, useRef } from "react";
import api from "../api/axios";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB   = 5;
const MAX_IMAGES    = 3;

// Magic byte validation — prevents fake MIME types
async function validateMagicBytes(file) {
    const buf   = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (file.type === "image/jpeg")
        return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    if (file.type === "image/png")
        return bytes[0] === 0x89 && bytes[1] === 0x50 &&
            bytes[2] === 0x4E && bytes[3] === 0x47;
    if (file.type === "image/webp")
        return bytes[0] === 0x52 && bytes[1] === 0x49 &&
            bytes[2] === 0x46 && bytes[3] === 0x46;
    return false;
}

function fileToBase64(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}

export default function ContactAdminModal({ onClose, source = "IN_APP", prefillText = "" }) {
    const [messageText, setMessageText] = useState(prefillText);
    const [images,      setImages]      = useState([]); // { preview, base64, name }
    const [senderName,  setSenderName]  = useState("");
    const [senderEmail, setSenderEmail] = useState("");
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState("");
    const [done,        setDone]        = useState(false);
    const fileRef = useRef(null);
    const isLoginPage = source === "LOGIN_PAGE";

    const handleFiles = async (files) => {
        setError("");
        const remaining = MAX_IMAGES - images.length;
        const toProcess = Array.from(files).slice(0, remaining);

        for (const file of toProcess) {
            // Type check
            if (!ALLOWED_TYPES.includes(file.type)) {
                setError("Only JPEG, PNG, WebP images allowed. No SVG or GIF.");
                continue;
            }
            // Size check
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                setError(`Each image must be under ${MAX_SIZE_MB}MB`);
                continue;
            }
            // Magic byte check — catches renamed files
            const validMagic = await validateMagicBytes(file);
            if (!validMagic) {
                setError("Image file appears corrupted or tampered. Please try another.");
                continue;
            }
            const base64 = await fileToBase64(file);
            setImages(prev => [...prev, { preview: base64, base64, name: file.name }]);
        }
    };

    const handlePaste = async (e) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItems = items.filter(i => i.type.startsWith("image/"));
        if (imageItems.length === 0) return;
        e.preventDefault();
        const files = imageItems.map(i => i.getAsFile()).filter(Boolean);
        await handleFiles(files);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        await handleFiles(e.dataTransfer.files);
    };

    const removeImage = (i) =>
        setImages(prev => prev.filter((_, idx) => idx !== i));

    const handleSend = async () => {
        if (!messageText.trim() || messageText.trim().length < 5) {
            setError("Please write a message (at least 5 characters)");
            return;
        }
        if (isLoginPage && !senderName.trim()) {
            setError("Please enter your name so we know who to contact");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await api.post("/contact", {
                messageText: messageText.trim(),
                senderName:  senderName.trim() || undefined,
                senderEmail: senderEmail.trim() || undefined,
                images:      images.map(i => i.base64),
                source,
            });
            setDone(true);
        } catch (err) {
            const status = err.response?.status;
            if (status === 429) {
                setError("Too many messages sent recently. Please wait an hour and try again.");
            } else {
                setError(err.response?.data || "Failed to send. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[400] flex flex-col items-center
                       justify-end sm:justify-center px-4 pb-0 sm:pb-4"
            style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-slate-900 border border-slate-700
                           rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ maxHeight: "90vh" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
                    <div className="w-10 h-1 bg-slate-600 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-slate-700/60 flex-shrink-0">
                    <div>
                        <h2 className="text-white font-bold text-base">
                            ✉️ Message to Admin
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                            Sarthak · FOLYO Creator
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center
                                   text-slate-400 hover:text-white hover:bg-slate-700
                                   rounded-lg transition-colors text-lg">
                        ✕
                    </button>
                </div>

                {done ? (
                    /* -- Success state -- */
                    <div className="flex flex-col items-center justify-center
                                    py-16 px-6 gap-4">
                        <span className="text-5xl">✅</span>
                        <p className="text-white font-bold text-lg text-center">
                            Message sent!
                        </p>
                        <p className="text-slate-400 text-sm text-center">
                            Sarthak will review your message and get back to you.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                                       text-white font-semibold rounded-xl text-sm
                                       transition-colors">
                            Done
                        </button>
                    </div>
                ) : (
                    /* -- Form -- */
                    <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto flex-1">

                        {/* Name + Email — only on login page (no auth) */}
                        {isLoginPage && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Your Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={senderName}
                                        onChange={e => setSenderName(e.target.value)}
                                        maxLength={100}
                                        placeholder="Your name"
                                        className="w-full bg-slate-800 border border-slate-700
                                                   rounded-xl px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        Email (optional)
                                    </label>
                                    <input
                                        type="email"
                                        value={senderEmail}
                                        onChange={e => setSenderEmail(e.target.value)}
                                        maxLength={200}
                                        placeholder="for reply"
                                        className="w-full bg-slate-800 border border-slate-700
                                                   rounded-xl px-3 py-2 text-white text-sm
                                                   focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Message textarea — accepts paste */}
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">
                                Message <span className="text-slate-600 ml-1">
                                    ({messageText.length}/2000)
                                </span>
                            </label>
                            <textarea
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                onPaste={handlePaste}
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                                maxLength={2000}
                                rows={5}
                                placeholder="Describe your issue, question, or feedback...
You can also paste an image directly here (Ctrl+V)"
                                className="w-full bg-slate-800 border border-slate-700
                                           rounded-xl px-4 py-3 text-white text-sm
                                           focus:outline-none focus:border-blue-500
                                           resize-none placeholder:text-slate-600"
                            />
                        </div>

                        {/* Image upload area */}
                        {images.length < MAX_IMAGES && (
                            <div
                                className="border-2 border-dashed border-slate-700
                                           hover:border-slate-500 rounded-xl p-4
                                           text-center cursor-pointer transition-colors"
                                onClick={() => fileRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    className="hidden"
                                    onChange={e => handleFiles(e.target.files)}
                                />
                                <p className="text-slate-500 text-sm">
                                    📎 Attach image — drag, drop, paste or click
                                </p>
                                <p className="text-slate-600 text-xs mt-1">
                                    JPEG · PNG · WebP only · max 5MB each · up to {MAX_IMAGES}
                                </p>
                            </div>
                        )}

                        {/* Image previews */}
                        {images.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {images.map((img, i) => (
                                    <div key={i} className="relative group">
                                        <img
                                            src={img.preview}
                                            alt={img.name}
                                            className="w-20 h-20 object-cover rounded-xl
                                                       border border-slate-700"
                                        />
                                        <button
                                            onClick={() => removeImage(i)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5
                                                       bg-red-600 text-white rounded-full
                                                       text-xs flex items-center justify-center
                                                       opacity-0 group-hover:opacity-100
                                                       transition-opacity">
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <p className="text-red-400 text-sm bg-red-900/20
                                          border border-red-700/40 rounded-xl px-4 py-3">
                                ⚠️ {error}
                            </p>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={loading || !messageText.trim()}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       text-white font-bold rounded-xl text-sm
                                       transition-colors flex items-center justify-center gap-2">
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30
                                                     border-t-white rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : "Send Message ✉️"}
                        </button>

                        <p className="text-slate-600 text-xs text-center">
                            Messages are reviewed by Sarthak personally.
                            Portfolio tracking, the way it should be.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}