import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminClients, sendNotification, getAllNotifications, getNotificationStatus } from "../api/admin";

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const dt = new Date(d);
        return dt.toLocaleString("en-IN", { day: "2-digit", month: "short",
            year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return d; }
};

// ── Read Status Modal ─────────────────────────────────────────────────────────
function ReadStatusModal({ notifId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getNotificationStatus(notifId).then(setData).finally(() => setLoading(false));
    }, [notifId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div>
                        <p className="text-white font-bold">{data?.title || "…"}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Read status per recipient</p>
                    </div>
                    <button onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl">✕</button>
                </div>

                {loading ? (
                    <div className="h-32 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-3 divide-x divide-slate-700/60 border-b border-slate-700">
                            {[
                                ["Total", data.totalRecipients, "text-white"],
                                ["Viewed", data.viewedCount, "text-blue-400"],
                                ["Acknowledged", data.acknowledgedCount, "text-green-400"],
                            ].map(([l, v, c]) => (
                                <div key={l} className="px-6 py-3 text-center">
                                    <p className={`text-2xl font-bold ${c}`}>{v}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{l}</p>
                                </div>
                            ))}
                        </div>
                        {/* Per-user table */}
                        <div className="max-h-80 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                                    <th className="text-left px-5 py-2.5">User</th>
                                    <th className="text-center px-4 py-2.5">Viewed</th>
                                    <th className="text-center px-4 py-2.5">Acknowledged</th>
                                    <th className="text-right px-5 py-2.5">Ack'd At</th>
                                </tr>
                                </thead>
                                <tbody>
                                {(data.recipients || []).map(r => (
                                    <tr key={r.userId}
                                        className="border-b border-slate-700/40 last:border-0 hover:bg-slate-800">
                                        <td className="px-5 py-2.5">
                                            <p className="text-white font-medium text-sm">{r.fullName || r.username}</p>
                                            <p className="text-slate-500 text-xs">@{r.username}</p>
                                        </td>
                                        <td className="text-center px-4 py-2.5">
                                            <span className={r.viewed ? "text-blue-400" : "text-slate-600"}>
                                                {r.viewed ? "✓ Yes" : "— No"}
                                            </span>
                                        </td>
                                        <td className="text-center px-4 py-2.5">
                                            <span className={r.acknowledged ? "text-green-400 font-semibold" : "text-slate-600"}>
                                                {r.acknowledged ? "✓ Yes" : "Pending"}
                                            </span>
                                        </td>
                                        <td className="text-right px-5 py-2.5 text-slate-500 text-xs">
                                            {r.acknowledged ? fmtDate(r.acknowledgedAt) : "—"}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminNotificationsPage() {
    const [clients, setClients]     = useState([]);
    const [sent,    setSent]        = useState([]);
    const [loading, setLoading]     = useState(true);
    const [sending, setSending]     = useState(false);
    const [viewId,  setViewId]      = useState(null);
    const [form,    setForm]        = useState({
        title: "", message: "", requiresAck: true,
        recipientType: "ALL", selectedIds: [],
        // Reminder scheduling
        enableReminders: false,
        reminderStartTime: "14:00",   // 2 PM IST default
        reminderCount: 3,
        reminderIntervalMinutes: 10,
    });
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([getAdminClients(), getAllNotifications()])
            .then(([cl, notifs]) => { setClients(cl); setSent(notifs); })
            .finally(() => setLoading(false));
    }, []);

    const toggleClient = (id) => {
        setForm(f => ({
            ...f,
            selectedIds: f.selectedIds.includes(id)
                ? f.selectedIds.filter(x => x !== id)
                : [...f.selectedIds, id],
        }));
    };

    const handleSend = async () => {
        if (!form.title.trim() || !form.message.trim()) return;
        setSending(true);
        try {
            const payload = {
                title: form.title,
                message: form.message,
                requiresAck: form.requiresAck,
                recipientType: form.recipientType,
                userIds: form.recipientType === "SELECTED" ? form.selectedIds : [],
                enableReminders: form.enableReminders,
                reminderStartTime: form.reminderStartTime,
                reminderCount: form.reminderCount,
                reminderIntervalMinutes: form.reminderIntervalMinutes,
            };
            const notif = await sendNotification(payload);
            setSent(prev => [notif, ...prev]);
            setForm({ title: "", message: "", requiresAck: true, recipientType: "ALL", selectedIds: [] });
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const recipientCount = form.recipientType === "ALL"
        ? clients.length
        : form.selectedIds.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">Push Notifications</h1>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            👑 CREATOR
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Send messages to clients — they must acknowledge before using the app</p>
                </div>
                <button onClick={() => navigate("/admin")}
                        className="text-sm text-slate-400 hover:text-white hover:underline">← Dashboard</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ── Compose panel ── */}
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700/60">
                        <p className="text-white font-semibold">Compose Message</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 font-medium block mb-1.5">Title</label>
                            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                                   placeholder="e.g. Market Update — Important"
                                   className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5
                                              text-white text-sm focus:outline-none focus:border-amber-500" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-medium block mb-1.5">Message</label>
                            <textarea value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))}
                                      placeholder="Write your message here…"
                                      rows={5}
                                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5
                                                 text-white text-sm focus:outline-none focus:border-amber-500 resize-none" />
                        </div>

                        {/* Acknowledgment toggle */}
                        <div className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3">
                            <div>
                                <p className="text-white text-sm font-medium">Require Acknowledgment</p>
                                <p className="text-slate-500 text-xs mt-0.5">Client can't use app until they accept</p>
                            </div>
                            <button onClick={() => setForm(f => ({...f, requiresAck: !f.requiresAck}))}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center
                                                ${form.requiresAck ? "bg-amber-500" : "bg-slate-600"}`}>
                                <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform
                                                 ${form.requiresAck ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Recipients */}
                        <div>
                            <label className="text-xs text-slate-400 font-medium block mb-1.5">Send To</label>
                            <div className="flex gap-2 mb-3">
                                {["ALL", "SELECTED"].map(t => (
                                    <button key={t} onClick={() => setForm(f => ({...f, recipientType: t}))}
                                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors
                                                       ${form.recipientType === t
                                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                : "bg-slate-700 text-slate-400 border border-slate-600"}`}>
                                        {t === "ALL" ? `All ${clients.length} Clients` : "Selected Clients"}
                                    </button>
                                ))}
                            </div>
                            {form.recipientType === "SELECTED" && (
                                <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-900/60 rounded-xl p-2">
                                    {clients.map(c => (
                                        <label key={c.id}
                                               className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/40 cursor-pointer">
                                            <input type="checkbox"
                                                   checked={form.selectedIds.includes(c.id)}
                                                   onChange={() => toggleClient(c.id)}
                                                   className="accent-amber-500" />
                                            <span className="text-white text-sm">{c.fullName || c.username}</span>
                                            <span className="text-slate-500 text-xs">{c.email}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Reminder Schedule ── */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3">
                                <div>
                                    <p className="text-white text-sm font-medium">Scheduled Reminders</p>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        Re-show to clients at set intervals even if acknowledged
                                    </p>
                                </div>
                                <button onClick={() => setForm(f => ({...f, enableReminders: !f.enableReminders}))}
                                        className={`w-12 h-6 rounded-full transition-colors flex items-center
                                                    ${form.enableReminders ? "bg-blue-600" : "bg-slate-600"}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform
                                                     ${form.enableReminders ? "translate-x-6" : "translate-x-0"}`} />
                                </button>
                            </div>

                            {form.enableReminders && (
                                <div className="bg-slate-900/40 rounded-xl p-4 space-y-3">
                                    <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                                        Reminder Schedule
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Start Time (IST)</label>
                                            <input
                                                type="time"
                                                value={form.reminderStartTime}
                                                onChange={e => setForm(f => ({...f, reminderStartTime: e.target.value}))}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg
                                                           px-3 py-2 text-white text-sm focus:outline-none
                                                           focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">No. of Reminders</label>
                                            <input
                                                type="number" min={1} max={10}
                                                value={form.reminderCount}
                                                onChange={e => setForm(f => ({...f, reminderCount: parseInt(e.target.value)||1}))}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg
                                                           px-3 py-2 text-white text-sm focus:outline-none
                                                           focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Interval (mins)</label>
                                            <input
                                                type="number" min={1} max={120}
                                                value={form.reminderIntervalMinutes}
                                                onChange={e => setForm(f => ({...f, reminderIntervalMinutes: parseInt(e.target.value)||5}))}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg
                                                           px-3 py-2 text-white text-sm focus:outline-none
                                                           focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    {/* Preview */}
                                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2">
                                        <p className="text-blue-400 text-xs">
                                            📅 Will resend {form.reminderCount}× starting at {form.reminderStartTime} IST,
                                            every {form.reminderIntervalMinutes} min
                                            — last reminder at {(() => {
                                            const [h,m] = form.reminderStartTime.split(":").map(Number);
                                            const endMin = h*60 + m + (form.reminderCount-1)*form.reminderIntervalMinutes;
                                            return `${String(Math.floor(endMin/60)).padStart(2,"0")}:${String(endMin%60).padStart(2,"0")}`;
                                        })()} IST
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleSend}
                                disabled={sending || !form.title.trim() || !form.message.trim() || recipientCount === 0}
                                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40
                                           disabled:cursor-not-allowed text-slate-900 font-bold text-sm
                                           rounded-xl transition-colors">
                            {sending
                                ? "Sending…"
                                : `📢 Send to ${recipientCount} client${recipientCount !== 1 ? "s" : ""}`}
                        </button>
                    </div>
                </div>

                {/* ── Sent history ── */}
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700/60">
                        <p className="text-white font-semibold">Sent Messages ({sent.length})</p>
                    </div>
                    {loading ? (
                        <div className="h-32 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : sent.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <p className="text-4xl mb-2">📭</p>
                            <p className="text-slate-500 text-sm">No messages sent yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700/40 max-h-[560px] overflow-y-auto">
                            {sent.map(n => {
                                const pct = n.totalRecipients > 0
                                    ? Math.round(n.acknowledgedCount / n.totalRecipients * 100) : 0;
                                return (
                                    <div key={n.id} className="px-5 py-4 hover:bg-slate-700/20">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-semibold text-sm">{n.title}</p>
                                                <p className="text-slate-500 text-xs mt-0.5 truncate">{n.message}</p>
                                                <p className="text-slate-600 text-xs mt-1">{fmtDate(n.createdAt)}</p>
                                            </div>
                                            <button onClick={() => setViewId(n.id)}
                                                    className="flex-shrink-0 text-xs text-amber-400 hover:text-amber-300 hover:underline">
                                                View status →
                                            </button>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span>{n.acknowledgedCount}/{n.totalRecipients} acknowledged</span>
                                                <span>{pct}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 rounded-full transition-all"
                                                     style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {viewId && (
                <ReadStatusModal notifId={viewId} onClose={() => setViewId(null)} />
            )}
        </div>
    );
}