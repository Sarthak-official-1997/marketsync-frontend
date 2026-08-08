import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    getContactMessages, markContactRead, getInboxUnread,
    getAllNotifications, getPendingNotifications, acknowledgeNotification,
} from "../api/admin";
import { getAlerts } from "../api/portfolio";
import { getMyThreads } from "../api/contact";
import ContactAdminModal from "./ContactAdminModal";
import ContactThreadModal from "./ContactThreadModal";

// ── Read-tracking for triggered alerts ──────────────────────────────────────
// Client-side only (per device): remembers which triggered alerts the user has
// already tapped, so the Alerts badge counts only NEW ones. A backend read flag
// would make this sync across devices — this is the local stand-in.
const seenKey = (uid) => `folyo_seen_alerts_${uid || "me"}`;
function loadSeenAlerts(uid) {
    try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || "[]")); }
    catch { return new Set(); }
}
function saveSeenAlerts(uid, set) {
    try { localStorage.setItem(seenKey(uid), JSON.stringify([...set])); } catch { /* ignore */ }
}

// "Clear all" — a SEPARATE local list from "seen". Dismissing an alert from
// this Inbox view is purely about the notification list itself; it never
// touches the real PriceAlert data the Alerts page owns, so clearing your
// inbox can never accidentally delete an actual price alert or trade setup.
const dismissedKey = (uid) => `folyo_dismissed_alerts_${uid || "me"}`;
function loadDismissedAlerts(uid) {
    try { return new Set(JSON.parse(localStorage.getItem(dismissedKey(uid)) || "[]")); }
    catch { return new Set(); }
}
function saveDismissedAlerts(uid, set) {
    try { localStorage.setItem(dismissedKey(uid), JSON.stringify([...set])); } catch { /* ignore */ }
}

const fmtTime = (d) => {
    if (!d) return "";
    const dt   = new Date(d);
    const now  = new Date();
    const diff = Math.floor((now - dt) / 1000);
    if (diff < 60)    return "just now";
    if (diff < 3600)  return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const SOURCE_LABEL = {
    LOGIN_PAGE: "Login page",
    AI_CHAT:    "FOLYO AI",
    IN_APP:     "In-app",
};

function EmptyState({ icon, text, sub }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 px-6">
            <span className="text-4xl">{icon}</span>
            <p className="text-slate-400 text-sm font-medium text-center">{text}</p>
            {sub && <p className="text-slate-600 text-xs text-center">{sub}</p>}
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-500
                            border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

function TabBar({ tabs, active, onChange }) {
    if (tabs.length <= 1) return null;
    return (
        <div className="flex border-b border-slate-700/60 flex-shrink-0">
            {tabs.map(t => (
                <button key={t.id} onClick={() => onChange(t.id)}
                        className={"flex-1 py-3 text-xs font-semibold transition-colors " +
                            "flex items-center justify-center gap-1.5 " +
                            (active === t.id
                                ? "text-white border-b-2 border-blue-500 bg-slate-800/40"
                                : "text-slate-500 hover:text-slate-300")}>
                    {t.label}
                    {t.badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold
                                         rounded-full min-w-[18px] h-[18px] px-1
                                         flex items-center justify-center leading-none">
                            {t.badge > 99 ? "99+" : t.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

export default function InboxPanel({ onClose, onUnreadChange }) {
    const { isCreator, user } = useAuth();
    const uid = user?.id ?? user?.email ?? "me";

    const [tab,         setTab]         = useState(isCreator ? "messages" : "notifications");
    const [messages,    setMessages]    = useState([]);
    const [myMessages,  setMyMessages]  = useState([]);
    const [broadcasts,  setBroadcasts]  = useState([]);
    const [pending,     setPending]     = useState([]);
    const [triggered,   setTriggered]   = useState([]);   // read-only triggered price alerts
    const [seenAlerts,  setSeenAlerts]  = useState(() => loadSeenAlerts(uid));
    const [dismissedAlerts, setDismissedAlerts] = useState(() => loadDismissedAlerts(uid));
    const [loading,     setLoading]     = useState(true);
    const [threadId,    setThreadId]    = useState(null);
    const [showContact, setShowContact] = useState(false);
    const navigate = useNavigate();

    const markAlertSeen = (id) => {
        // Persist FIRST, synchronously and independently of React state. The panel
        // usually unmounts (onClose) immediately after this tap, and React drops
        // pending state-updater side effects on unmount — so writing inside
        // setSeenAlerts would silently never run. Write straight to storage here.
        try {
            const cur = loadSeenAlerts(uid);
            cur.add(id);
            saveSeenAlerts(uid, cur);
        } catch { /* ignore */ }
        // Update in-memory state too, for the live dot/dimming while still open.
        setSeenAlerts(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    // Bulk actions — operate on whatever's CURRENTLY visible (i.e. not
    // already dismissed), same write-synchronously-first reasoning as
    // markAlertSeen above (the panel closes right after these fire).
    const markAllAlertsRead = () => {
        const visible = triggered.filter(a => !dismissedAlerts.has(a.id));
        if (visible.length === 0) return;
        try {
            const cur = loadSeenAlerts(uid);
            visible.forEach(a => cur.add(a.id));
            saveSeenAlerts(uid, cur);
        } catch { /* ignore */ }
        setSeenAlerts(prev => new Set([...prev, ...visible.map(a => a.id)]));
    };

    const clearAllAlerts = () => {
        const visible = triggered.filter(a => !dismissedAlerts.has(a.id));
        if (visible.length === 0) return;
        try {
            const cur = loadDismissedAlerts(uid);
            visible.forEach(a => cur.add(a.id));
            saveDismissedAlerts(uid, cur);
        } catch { /* ignore */ }
        setDismissedAlerts(prev => new Set([...prev, ...visible.map(a => a.id)]));
    };

    const panelRef = useRef(null);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [pendRes, msgRes, bcastRes, alertRes] = await Promise.allSettled([
                getPendingNotifications(),
                isCreator ? getContactMessages() : getMyThreads(),
                isCreator ? getAllNotifications() : Promise.resolve([]),
                getAlerts(),
            ]);
            setPending(pendRes.status   === "fulfilled" ? (pendRes.value   || []) : []);
            if (isCreator) {
                setMessages(msgRes.status   === "fulfilled" ? (msgRes.value   || []) : []);
                setBroadcasts(bcastRes.status === "fulfilled" ? (bcastRes.value || []) : []);
            } else {
                setMyMessages(msgRes.status === "fulfilled" ? (msgRes.value || []) : []);
            }
            // Triggered price alerts (read-only mirror of the Alerts page).
            const alertList = alertRes.status === "fulfilled"
                ? (alertRes.value?.data || alertRes.value || []) : [];
            setTriggered(alertList.filter(a => a.triggeredAt));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, [isCreator]);

    // -- FIX: Outside click — NO setTimeout (was causing stale handler during 50ms gap)
    // -- FIX: Guard threadId/showContact — child modals render outside panelRef DOM
    //         so panelRef.contains(target) returns false even when clicking inside them.
    useEffect(() => {
        const h = (e) => {
            if (threadId || showContact) return; // child modal open — don't close panel
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose, threadId, showContact]);

    // ESC — only when no child modal open (child modal handles its own ESC)
    useEffect(() => {
        const h = (e) => {
            if (e.key === "Escape" && !threadId && !showContact) onClose();
        };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose, threadId, showContact]);

    const handleMarkRead = async (msg) => {
        if (!msg.read) {
            await markContactRead(msg.id).catch(() => {});
            setMessages(prev => prev.map(m =>
                m.id === msg.id ? { ...m, read: true } : m
            ));
            onUnreadChange?.();
        }
        setThreadId(msg.id);
    };

    const handleAck = async (notif) => {
        await acknowledgeNotification(notif.recipientId ?? notif.id).catch(() => {});
        setPending(prev => prev.filter(n =>
            (n.recipientId ?? n.id) !== (notif.recipientId ?? notif.id)
        ));
        onUnreadChange?.();
    };

    const unreadMessages = messages.filter(m => !m.read).length;

    const visibleTriggered = triggered.filter(a => !dismissedAlerts.has(a.id));
    const unseenAlertCount = visibleTriggered.reduce((n, a) => n + (seenAlerts.has(a.id) ? 0 : 1), 0);

    const creatorTabs = [
        { id: "messages",   label: "Messages",  badge: unreadMessages },
        { id: "inbox",      label: "My Inbox",  badge: pending.length },
        { id: "broadcasts", label: "Broadcasts", badge: 0             },
        { id: "alerts",     label: "Alerts",    badge: unseenAlertCount },
    ];
    const userTabs = [
        { id: "notifications", label: "Notifications", badge: pending.length },
        { id: "messages",      label: "My Messages",   badge: 0              },
        { id: "alerts",        label: "Alerts",        badge: unseenAlertCount },
    ];
    const tabs = isCreator ? creatorTabs : userTabs;

    return (
        <>
            {/* -- FIX: md:hidden instead of md:bg-transparent
                md:bg-transparent still blocks all clicks on desktop (sidebar, nav etc).
                md:hidden removes the div entirely on desktop so the app stays interactive.
                Mobile keeps the full backdrop as expected. -- */}
            {!threadId && !showContact && (
                <div className="fixed inset-0 z-[150] bg-black/50 md:hidden"
                     onClick={onClose} />
            )}

            {/* Panel */}
            <div ref={panelRef}
                 className="fixed right-0 top-0 bottom-0 z-[160]
                            bg-slate-900 border-l border-slate-700/60
                            flex flex-col shadow-2xl animate-slide-in-right"
                 style={{ width: "min(100vw, 400px)" }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-slate-700/60 flex-shrink-0">
                    <h2 className="text-white font-bold text-base">Inbox</h2>
                    <div className="flex items-center gap-1">
                        <button onClick={loadAll}
                                className="p-2 text-slate-400 hover:text-white
                                           hover:bg-slate-700 rounded-lg transition-colors"
                                title="Refresh">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                 strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0
                                         004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003
                                         8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </button>
                        <button onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white
                                           hover:bg-slate-700 rounded-lg transition-colors
                                           text-base leading-none">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <TabBar tabs={tabs} active={tab} onChange={setTab} />

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? <Spinner /> : (
                        <>
                            {/* CREATOR: Messages tab */}
                            {isCreator && tab === "messages" && (
                                messages.length === 0 ? (
                                    <EmptyState icon="✉️" text="No messages yet"
                                                sub="Users can message you from login page, AI chat, or their inbox" />
                                ) : messages.map(msg => (
                                    <div key={msg.id}
                                         onClick={() => handleMarkRead(msg)}
                                         className={"flex items-start gap-3 px-4 py-3.5 " +
                                             "cursor-pointer border-b border-slate-800/60 " +
                                             "last:border-0 hover:bg-slate-800/60 transition-colors " +
                                             (!msg.read ? "bg-slate-800/30" : "")}>
                                        <div className="mt-2 flex-shrink-0">
                                            <div className={"w-2 h-2 rounded-full " +
                                                (!msg.read ? "bg-blue-500" : "bg-transparent")} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={"text-sm truncate " +
                                                    (!msg.read ? "text-white font-semibold" : "text-slate-300")}>
                                                    {msg.senderName || "Anonymous"}
                                                </p>
                                                <span className="text-slate-500 text-xs flex-shrink-0">
                                                    {fmtTime(msg.sentAt)}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-xs truncate mt-0.5">
                                                {msg.messageText}
                                            </p>
                                            <span className="text-slate-700 text-[10px]">
                                                {SOURCE_LABEL[msg.source] || msg.source}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* CREATOR: My Inbox tab */}
                            {isCreator && tab === "inbox" && (
                                pending.length === 0 ? (
                                    <EmptyState icon="🎉" text="All caught up!" />
                                ) : pending.map(notif => (
                                    <NotifRow key={notif.recipientId ?? notif.id}
                                              notif={notif}
                                              onAck={() => handleAck(notif)} />
                                ))
                            )}

                            {/* CREATOR: Broadcasts tab */}
                            {isCreator && tab === "broadcasts" && (
                                broadcasts.length === 0 ? (
                                    <EmptyState icon="📢" text="No broadcasts sent yet"
                                                sub="Use the Notifications page to compose and send" />
                                ) : broadcasts.map(b => (
                                    <BroadcastRow key={b.id} b={b} />
                                ))
                            )}

                            {/* USER: Notifications tab */}
                            {!isCreator && tab === "notifications" && (
                                pending.length === 0 ? (
                                    <EmptyState icon="🎉" text="No new notifications"
                                                sub="Admin announcements will appear here" />
                                ) : pending.map(notif => (
                                    <NotifRow key={notif.recipientId ?? notif.id}
                                              notif={notif}
                                              onAck={() => handleAck(notif)} />
                                ))
                            )}

                            {/* USER: My Messages tab */}
                            {!isCreator && tab === "messages" && (
                                myMessages.length === 0 ? (
                                    <EmptyState icon="✉️" text="No messages sent yet"
                                                sub="Use the button below to message Sarthak" />
                                ) : myMessages.map(msg => (
                                    <div key={msg.id}
                                         onClick={() => setThreadId(msg.id)}
                                         className="flex items-start gap-3 px-4 py-3.5
                                                    cursor-pointer border-b border-slate-800/60
                                                    last:border-0 hover:bg-slate-800/60
                                                    transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-300 text-sm truncate">
                                                {msg.messageText}
                                            </p>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-slate-600 text-xs">
                                                    {fmtTime(msg.sentAt)} ·{" "}
                                                    {SOURCE_LABEL[msg.source] || msg.source}
                                                </p>
                                                <span className={"text-[10px] px-2 py-0.5 rounded-full " +
                                                    (msg.read
                                                        ? "bg-green-900/40 text-green-400"
                                                        : "bg-slate-700 text-slate-400")}>
                                                    {msg.read ? "✓ Seen" : "Pending"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {/* Alerts tab (both roles): read-only triggered price alerts.
                                Tapping a row opens the Alerts page focused on that alert.
                                "Clear all" / "Mark all read" only affect THIS list — they
                                never touch the real PriceAlert rows the Alerts page owns. */}
                            {tab === "alerts" && (
                                visibleTriggered.length === 0 ? (
                                    <EmptyState icon="🔕" text="No triggered alerts"
                                                sub="Price alerts that hit their target will show up here" />
                                ) : (<>
                                    <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-slate-800/60">
                                        {unseenAlertCount > 0 && (
                                            <button onClick={markAllAlertsRead}
                                                    className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                                                Mark all read
                                            </button>
                                        )}
                                        <button onClick={clearAllAlerts}
                                                className="text-xs text-slate-500 hover:text-red-400 font-medium">
                                            Clear all
                                        </button>
                                    </div>
                                    {visibleTriggered.map(a => {
                                        const unseen = !seenAlerts.has(a.id);
                                        return (
                                            <button key={a.id}
                                                    onClick={() => {
                                                        markAlertSeen(a.id);   // read → drops the badge count
                                                        navigate("/stocks/alerts", {
                                                            state: { fromInbox: true, alertId: a.id },
                                                        });
                                                        onClose();
                                                    }}
                                                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left
                                                           cursor-pointer border-b border-slate-800/60
                                                           last:border-0 hover:bg-slate-800/60 transition-colors">
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
                                                <span className={"w-2 h-2 rounded-full " +
                                                    (unseen ? "bg-red-500" : "bg-transparent")} />
                                                    <span className="text-lg">🔔</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className={"text-sm truncate " +
                                                            (unseen ? "text-white font-semibold" : "text-slate-300")}>
                                                            {a.symbol}
                                                        </p>
                                                        <span className="text-slate-500 text-xs flex-shrink-0">
                                                        {fmtTime(a.triggeredAt)}
                                                    </span>
                                                    </div>
                                                    {a.name && (
                                                        <p className="text-slate-500 text-xs truncate mt-0.5">
                                                            {a.name}
                                                        </p>
                                                    )}
                                                    <p className="text-green-400 text-[11px] truncate mt-0.5">
                                                        ✓ {a.description || "Target hit"} · tap to view →
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>)
                            )}
                        </>
                    )}
                </div>

                {/* User: Message Sarthak button */}
                {!isCreator && (
                    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-800">
                        <button
                            onClick={() => setShowContact(true)}
                            className="w-full py-2.5 flex items-center justify-center gap-2
                                       bg-blue-600 hover:bg-blue-700 text-white font-semibold
                                       rounded-xl text-sm transition-colors">
                            ✉️ Message Sarthak
                        </button>
                    </div>
                )}

                <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
                    <p className="text-slate-600 text-xs text-center italic">
                        FOLYO · Portfolio tracking, the way it should be.
                    </p>
                </div>
            </div>

            {/* Child modals — outside panelRef DOM but guards in useEffect prevent
                InboxPanel from closing when these are open */}
            {threadId && (
                <ContactThreadModal
                    rootId={threadId}
                    onClose={() => setThreadId(null)}
                    onReplied={() => { loadAll(); onUnreadChange?.(); }}
                />
            )}

            {showContact && (
                <ContactAdminModal
                    source="IN_APP"
                    onClose={() => { setShowContact(false); loadAll(); }}
                />
            )}
        </>
    );
}

// -- Sub-components ------------------------------------------------------------

function NotifRow({ notif, onAck }) {
    return (
        <div className="flex items-start gap-3 px-4 py-3.5
                        border-b border-slate-800/60 last:border-0 bg-slate-800/20">
            <div className="mt-2 flex-shrink-0">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{notif.title}</p>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                    {notif.message || notif.body}
                </p>
                <p className="text-slate-600 text-[10px] mt-1">
                    {fmtTime(notif.sentAt)}
                </p>
            </div>
            {notif.requiresAck && (
                <button onClick={onAck}
                        className="flex-shrink-0 text-xs px-2.5 py-1.5 mt-0.5
                                   bg-amber-900/40 hover:bg-amber-600
                                   text-amber-400 hover:text-white
                                   rounded-lg transition-colors font-medium">
                    Acknowledge
                </button>
            )}
        </div>
    );
}

function BroadcastRow({ b }) {
    const ackd  = b.acknowledgedCount || 0;
    const total = b.totalRecipients   || 0;
    const pct   = total > 0 ? Math.round((ackd / total) * 100) : 0;
    return (
        <div className="px-4 py-3.5 border-b border-slate-800/60 last:border-0">
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{b.title}</p>
                    <p className="text-slate-500 text-xs truncate mt-0.5">
                        {b.message || b.body}
                    </p>
                    <p className="text-slate-600 text-[10px] mt-1">
                        {fmtTime(b.createdAt || b.sentAt)}
                    </p>
                </div>
                <span className="text-green-400 text-sm font-bold flex-shrink-0">
                    {pct}%
                </span>
            </div>
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all"
                     style={{ width: pct + "%" }} />
            </div>
            <p className="text-slate-600 text-[10px] mt-1">
                {ackd}/{total} acknowledged
            </p>
        </div>
    );
}