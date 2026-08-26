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
import { searchStocks, searchMfSchemes } from "../api/portfolio";

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
    const isMf = m.assetType === "MF";
    // Unify legacy single targetPrice and the new multi-target list into
    // one array so both a simple idea and a T1/T2/T3 one render the same
    // shape — same reasoning as MyIdeasPage's TradeSetupCard.
    const allTargets = m.targets && m.targets.length > 0
        ? m.targets
        : (m.targetPrice != null ? [{ targetPrice: m.targetPrice, hit: false }] : []);

    return (
        <div className="w-64 bg-slate-800 border border-purple-500/30 rounded-2xl rounded-br-md p-3">
            <div className="flex items-center justify-between mb-1.5">
                <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">
                        {isMf ? m.mfSchemeName : m.stockSymbol}
                    </p>
                    <p className="text-slate-500 text-[10px] truncate">
                        {isMf ? m.mfFundHouse : m.stockName}
                    </p>
                </div>
                <span className={"text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex-shrink-0 " + meta.cls}>
                    {meta.label}
                </span>
            </div>
            {m.category && (
                <p className="text-[9.5px] text-slate-500 mb-1.5">
                    {m.category === "TRADE_SETUP" ? "⚡ Trade Setup" : "📈 Investment"}
                </p>
            )}
            {(m.buyRangeLow || allTargets.length > 0 || m.stopLossPrice) && (
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {m.buyRangeLow && (
                        <div className="bg-slate-900/60 rounded-lg text-center py-1.5 px-1">
                            <p className="text-[8px] text-slate-500 uppercase">Buy</p>
                            <p className="text-[11px] font-bold text-white">{m.buyRangeLow}–{m.buyRangeHigh}</p>
                        </div>
                    )}
                    {allTargets.map((t, i) => (
                        <div key={i} className={"rounded-lg text-center py-1.5 px-1 " + (t.hit ? "bg-green-900/25" : "bg-slate-900/60")}>
                            <p className="text-[8px] text-slate-500 uppercase">{allTargets.length > 1 ? `T${i + 1}` : "Target"}</p>
                            <p className={"text-[11px] font-bold " + (t.hit ? "text-green-400" : "text-white")}>
                                {t.targetPrice}{t.hit ? " ✓" : ""}
                            </p>
                        </div>
                    ))}
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
    const [assetType, setAssetType] = useState("STOCK"); // "STOCK" | "MF"
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [stock, setStock] = useState(null);
    const [scheme, setScheme] = useState(null);
    const [signal, setSignal] = useState("BUY");
    const [category, setCategory] = useState("INVESTMENT"); // INVESTMENT | TRADE_SETUP
    const [buyLow, setBuyLow] = useState("");
    const [buyHigh, setBuyHigh] = useState("");
    // Always an array now, even for a single target — one row is exactly
    // the old single-target case, just expressed through the same list
    // structure instead of a separate field. The legacy targetPrice
    // column still exists on the backend for OLD ideas sent before this
    // existed; the composer just never writes to it anymore.
    const [targets, setTargets] = useState([{ price: "", pct: "" }]);
    const [sl, setSl] = useState("");
    const [sellPct, setSellPct] = useState("");
    const [note, setNote] = useState("");
    const [sending, setSending] = useState(false);

    const picked = assetType === "STOCK" ? stock : scheme;

    useEffect(() => {
        if (!query || query.length < 2 || picked) { setResults([]); return; }
        const t = setTimeout(() => {
            const search = assetType === "STOCK" ? searchStocks(query) : searchMfSchemes(query);
            search.then(res => setResults(res.data?.content || res.data || [])).catch(() => {});
        }, 250);
        return () => clearTimeout(t);
    }, [query, picked, assetType]);

    const switchAssetType = (type) => {
        setAssetType(type); setQuery(""); setResults([]); setStock(null); setScheme(null);
    };

    const send = () => {
        if (!picked) { toast.error(`Pick a ${assetType === "STOCK" ? "stock" : "scheme"} first`); return; }
        setSending(true);
        const cleanTargets = targets
            .filter(t => t.price !== "" && t.price != null)
            .map(t => ({ targetPrice: t.price, partialBookPercent: t.pct || null }));
        sendThreadIdea(trackedClientId, {
            assetType,
            stockId: assetType === "STOCK" ? stock.id : null,
            mfSchemeCode: assetType === "MF" ? scheme.schemeCode : null,
            mfSchemeName: assetType === "MF" ? scheme.schemeName : null,
            mfFundHouse: assetType === "MF" ? scheme.fundHouse : null,
            signalType: signal,
            category,
            buyRangeLow: buyLow || null,
            buyRangeHigh: buyHigh || null,
            targetPrice: null,
            targets: cleanTargets.length > 0 ? cleanTargets : null,
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

                {!picked && (
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => switchAssetType("STOCK")}
                                className={"flex-1 py-2 rounded-lg text-xs font-bold " +
                                    (assetType === "STOCK" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400")}>
                            Stock
                        </button>
                        <button onClick={() => switchAssetType("MF")}
                                className={"flex-1 py-2 rounded-lg text-xs font-bold " +
                                    (assetType === "MF" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400")}>
                            Mutual Fund
                        </button>
                    </div>
                )}

                {!picked ? (
                    <>
                        <input value={query} onChange={e => setQuery(e.target.value)}
                               placeholder={assetType === "STOCK" ? "Search stock…" : "Search MF scheme…"}
                               className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm mb-2" />
                        {assetType === "STOCK"
                            ? results.map(s => (
                                <button key={s.id} onClick={() => { setStock(s); setResults([]); setQuery(""); }}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg">
                                    <p className="text-white text-sm font-semibold">{s.symbol}</p>
                                    <p className="text-slate-500 text-xs">{s.name}</p>
                                </button>
                            ))
                            : results.map(s => (
                                <button key={s.schemeCode} onClick={() => { setScheme(s); setResults([]); setQuery(""); }}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg">
                                    <p className="text-white text-sm font-semibold truncate">{s.schemeName}</p>
                                    <p className="text-slate-500 text-xs">{s.fundHouse}</p>
                                </button>
                            ))
                        }
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2.5 mb-4">
                            <div className="min-w-0">
                                <p className="text-white font-semibold text-sm truncate">
                                    {assetType === "STOCK" ? stock.symbol : scheme.schemeName}
                                </p>
                                <p className="text-slate-500 text-xs truncate">
                                    {assetType === "STOCK" ? stock.name : scheme.fundHouse}
                                </p>
                            </div>
                            <button onClick={() => { setStock(null); setScheme(null); }} className="text-slate-500 text-xs flex-shrink-0 ml-2">Change</button>
                        </div>

                        <p className="text-slate-500 text-[11px] font-semibold uppercase mb-2">Category</p>
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setCategory("INVESTMENT")}
                                    className={"flex-1 py-2 rounded-lg text-xs font-bold " +
                                        (category === "INVESTMENT" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-500")}>
                                📈 Investment
                            </button>
                            <button onClick={() => setCategory("TRADE_SETUP")}
                                    className={"flex-1 py-2 rounded-lg text-xs font-bold " +
                                        (category === "TRADE_SETUP" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-500")}>
                                ⚡ Trade Setup
                            </button>
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

                        <p className="text-slate-500 text-[11px] font-semibold uppercase mb-2">Entry range / stop-loss (optional)</p>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <input value={buyLow} onChange={e => setBuyLow(e.target.value)} placeholder="Buy low" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                            <input value={buyHigh} onChange={e => setBuyHigh(e.target.value)} placeholder="Buy high" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                            <input value={sl} onChange={e => setSl(e.target.value)} placeholder="Stop-loss" type="number"
                                   className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs" />
                        </div>

                        <p className="text-slate-500 text-[11px] font-semibold uppercase mb-2">
                            Target{targets.length > 1 ? "s" : ""} (optional)
                        </p>
                        <div className="space-y-2 mb-2">
                            {targets.map((t, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    {targets.length > 1 && (
                                        <span className="text-[10px] font-bold text-purple-400 w-6 flex-shrink-0">T{i + 1}</span>
                                    )}
                                    <input value={t.price} type="number" placeholder="Target price"
                                           onChange={e => setTargets(prev => prev.map((x, xi) => xi === i ? { ...x, price: e.target.value } : x))}
                                           className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs min-w-0" />
                                    <input value={t.pct} type="number" placeholder="Book %"
                                           onChange={e => setTargets(prev => prev.map((x, xi) => xi === i ? { ...x, pct: e.target.value } : x))}
                                           className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs flex-shrink-0" />
                                    {targets.length > 1 && (
                                        <button onClick={() => setTargets(prev => prev.filter((_, xi) => xi !== i))}
                                                className="text-slate-500 hover:text-red-400 text-xs flex-shrink-0 px-1">✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setTargets(prev => [...prev, { price: "", pct: "" }])}
                                className="text-[11px] text-purple-400 font-semibold mb-4">
                            + Add another target
                        </button>

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
    const [loadError, setLoadError] = useState(null);
    const [text, setText] = useState("");
    const [showIdeaComposer, setShowIdeaComposer] = useState(false);
    const bottomRef = useRef(null);

    // BUG FIXED HERE: on a failed load, the old code showed a toast but
    // still fell through to the main render with client still null — that's
    // exactly what produced the "?" avatar and "@unmapped" text instead of
    // a real error screen. Toasts are easy to miss/dismiss; the person is
    // left looking at a broken-looking thread with no indication anything
    // actually went wrong. Now a failed load renders its own explicit
    // error state with a Retry button, and the real error (not just the
    // generic toast message) is logged so the actual cause — network,
    // 404 because the endpoint isn't deployed yet, 500, whatever — is a
    // console check away instead of a guess.
    const load = () => {
        setLoadError(null);
        Promise.all([getTrackedClient(id), getThread(id)])
            .then(([c, t]) => { setClient(c.data); setMessages(t.data || []); })
            .catch(err => {
                console.error("Thread load failed:", err?.response?.status, err?.response?.data || err);
                setLoadError(err?.response?.status === 404
                    ? "This thread isn't available yet — the messaging feature may not be deployed on the backend yet."
                    : "Couldn't load this thread. Check your connection and try again.");
            })
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

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] px-6 text-center gap-3">
                <span className="text-3xl">⚠️</span>
                <p className="text-white font-semibold text-sm">{loadError}</p>
                <div className="flex gap-2 mt-2">
                    <button onClick={() => navigate(-1)}
                            className="px-4 py-2 bg-slate-700 text-white text-xs font-semibold rounded-lg">
                        Go back
                    </button>
                    <button onClick={() => { setLoading(true); load(); }}
                            className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    let lastDay = null;

    // BUG FIXED HERE: this page used to wrap itself in h-[100dvh] flex
    // flex-col, trying to own the entire device viewport with its own
    // internal scroll region and a flex-pinned composer at the bottom.
    // But this component doesn't render at the top level — Layout.jsx
    // already puts it inside <main className="flex-1 overflow-y-auto">,
    // itself inside a padded wrapper div. No other page in this app tries
    // to claim full-viewport height; they all just flow normally inside
    // that existing scroll container. Claiming h-[100dvh] from inside a
    // container that's already smaller than the viewport (Layout's mobile
    // header takes 56px off the top) meant this component was taller than
    // the space actually available, so Layout's OWN outer scroll took
    // over instead of this component's intended inner scroll — that's
    // what "had to scroll down to see the composer" actually was.
    // Fixed by not fighting it: no forced height, message list is just
    // normal flowing content, and the composer uses position:sticky
    // instead of flex-pinning — sticky naturally pins to the bottom of
    // whichever ancestor is actually scrolling, without this component
    // needing to know or compute that ancestor's exact height itself.
    // bottom-16 (64px) on mobile clears the app's fixed bottom nav;
    // sm:bottom-0 removes that offset on desktop, which has no bottom nav.
    return (
        <div className="flex flex-col -m-3 min-h-[calc(100vh-56px)]">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-950 sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="text-slate-400 text-xl">←</button>
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {client?.displayName?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{client?.displayName}</p>
                    <p className="text-slate-500 text-[10.5px]">@{client?.mappedUsername || "unmapped"}</p>
                </div>
                {/* Jumps straight to their portfolio — the existing "💬 Message"
                    button on TrackedClientDetailPage already provides the way
                    back, so this makes the two screens a real back-and-forth
                    loop instead of a one-way trip. */}
                <button onClick={() => navigate(`/creator/client-tracker/${id}`)}
                        title="View portfolio"
                        className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm flex-shrink-0">
                    📊
                </button>
            </div>

            <div className="flex-1 px-3 py-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center gap-2 py-16 px-6">
                        <span className="text-3xl">💬</span>
                        <p className="text-slate-400 text-sm font-semibold">No messages yet</p>
                        <p className="text-slate-600 text-xs max-w-[240px]">
                            Send {client?.displayName || "them"} a quick check-in, or tap 📊 below to share a stock idea with price levels.
                        </p>
                    </div>
                ) : messages.map(m => {
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

            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-700/60
                            bg-slate-950 sticky bottom-16 sm:bottom-0 z-10">
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