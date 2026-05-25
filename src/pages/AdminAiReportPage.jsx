import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { useToast }            from "../context/ToastContext";
import {
    getAiReport, getUserChatSessions, getUserChatSession,
    getAiConfig, updateAiConfig,
} from "../api/admin";

const fmt = v => `Rs.${parseFloat(v || 0).toLocaleString("en-IN",
    { maximumFractionDigits: 2 })}`;

export default function AdminAiReportPage() {
    const [report,        setReport]        = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [config,        setConfig]        = useState(null);
    const [configSaving,  setConfigSaving]  = useState(false);
    const [expanded,      setExpanded]      = useState(null);
    const [sessions,      setSessions]      = useState({});
    const [activeSession, setActiveSession] = useState(null);
    const [messages,      setMessages]      = useState([]);
    const [msgLoading,    setMsgLoading]    = useState(false);
    const navigate = useNavigate();
    const toast    = useToast();

    useEffect(() => {
        Promise.allSettled([
            getAiReport(),
            getAiConfig(),
        ]).then(([reportRes, configRes]) => {
            if (reportRes.status === "fulfilled") setReport(reportRes.value);
            if (configRes.status  === "fulfilled") setConfig(configRes.value);
        }).finally(() => setLoading(false));
    }, []);

    const handleConfigChange = async (key, value) => {
        setConfigSaving(true);
        try {
            const updated = await updateAiConfig(key, value);
            setConfig(updated);
            toast.success("Setting saved");
        } catch { toast.error("Failed to save setting"); }
        finally  { setConfigSaving(false); }
    };

    const toggleUser = async (userId) => {
        if (expanded === userId) { setExpanded(null); return; }
        setExpanded(userId);
        if (!sessions[userId]) {
            try {
                const data = await getUserChatSessions(userId);
                setSessions(prev => ({ ...prev, [userId]: data }));
            } catch { setSessions(prev => ({ ...prev, [userId]: [] })); }
        }
    };

    const loadSession = async (userId, sessionId) => {
        if (activeSession?.sessionId === sessionId) {
            setActiveSession(null); setMessages([]); return;
        }
        setActiveSession({ userId, sessionId });
        setMsgLoading(true);
        try {
            const data = await getUserChatSession(userId, sessionId);
            setMessages(data);
        } catch { setMessages([]); }
        finally  { setMsgLoading(false); }
    };

    if (loading) return (
        <div className="space-y-3">
            {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse"/>
            ))}
        </div>
    );

    const {
        todayCostInr = 0, totalCostInr = 0,
        todayRequests = 0, totalRequests = 0,
        dailyUsage = [], perUserUsage = [],
    } = report || {};

    // Build chart data — last 14 days
    const dailyMap = {};
    dailyUsage.forEach(d => {
        if (!dailyMap[d.date]) dailyMap[d.date] = { chat: 0, image: 0, totalCostInr: 0 };
        if (d.type === "CHAT")          dailyMap[d.date].chat  += d.requests;
        if (d.type === "IMAGE_EXTRACT") dailyMap[d.date].image += d.requests;
        dailyMap[d.date].totalCostInr += parseFloat(d.costInr || 0);
    });
    const dailyDates = Object.keys(dailyMap).sort().slice(-14);
    const maxReqs    = Math.max(...dailyDates.map(
        d => dailyMap[d].chat + dailyMap[d].image), 1);

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">AI Usage Report</h1>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border
                                         border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            👑 CREATOR
                        </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                        Live cost tracking · Chat history · Config controls
                    </p>
                </div>
                <button onClick={() => navigate("/admin")}
                        className="text-sm text-slate-400 hover:text-white hover:underline">
                    ← Dashboard
                </button>
            </div>

            {/* ── AI Controls Panel ── */}
            {config && (
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-5">
                        <span className="text-xl">⚙️</span>
                        <div>
                            <p className="text-white font-bold text-sm">AI Controls</p>
                            <p className="text-slate-500 text-xs">
                                Changes apply within 60 seconds · Users are not notified
                            </p>
                        </div>
                        {configSaving && (
                            <div className="ml-auto w-4 h-4 border-2 border-purple-400
                                            border-t-transparent rounded-full animate-spin"/>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Chat toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-900/40
                                        rounded-xl border border-slate-700/40">
                            <div>
                                <p className="text-white text-sm font-semibold">AI Chat</p>
                                <p className="text-slate-500 text-xs">Enable for all users</p>
                            </div>
                            <button
                                onClick={() => handleConfigChange("chat.enabled",
                                    config["chat.enabled"] === "true" ? "false" : "true")}
                                className={`w-12 h-6 rounded-full transition-colors relative ${
                                    config["chat.enabled"] === "true"
                                        ? "bg-green-600" : "bg-slate-600"
                                }`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full
                                                transition-transform ${
                                    config["chat.enabled"] === "true"
                                        ? "translate-x-7" : "translate-x-1"
                                }`}/>
                            </button>
                        </div>

                        {/* Extract toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-900/40
                                        rounded-xl border border-slate-700/40">
                            <div>
                                <p className="text-white text-sm font-semibold">AI Image Import</p>
                                <p className="text-slate-500 text-xs">Enable for all users</p>
                            </div>
                            <button
                                onClick={() => handleConfigChange("extract.enabled",
                                    config["extract.enabled"] === "true" ? "false" : "true")}
                                className={`w-12 h-6 rounded-full transition-colors relative ${
                                    config["extract.enabled"] === "true"
                                        ? "bg-green-600" : "bg-slate-600"
                                }`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full
                                                transition-transform ${
                                    config["extract.enabled"] === "true"
                                        ? "translate-x-7" : "translate-x-1"
                                }`}/>
                            </button>
                        </div>

                        {/* History depth slider */}
                        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-white text-sm font-semibold">
                                        Chat History Depth
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        Messages sent to Gemini as context
                                    </p>
                                </div>
                                <span className={`text-lg font-bold ${
                                    parseInt(config["chat.history_limit"]) === 0
                                        ? "text-amber-400" : "text-blue-400"
                                }`}>
                                    {config["chat.history_limit"] === "0"
                                        ? "Off" : config["chat.history_limit"]}
                                </span>
                            </div>
                            <input type="range" min="0" max="30" step="2"
                                   value={config["chat.history_limit"]}
                                   onChange={e => setConfig(p => ({
                                       ...p, "chat.history_limit": e.target.value
                                   }))}
                                   onMouseUp={e => handleConfigChange(
                                       "chat.history_limit", e.target.value)}
                                   onTouchEnd={e => handleConfigChange(
                                       "chat.history_limit", e.target.value)}
                                   className="w-full h-2 bg-slate-600 rounded-lg
                                              appearance-none cursor-pointer accent-blue-500"/>
                            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                                <span>0 (stateless)</span>
                                <span>10 (recommended)</span>
                                <span>30 (expensive)</span>
                            </div>
                        </div>

                        {/* Chat daily limit */}
                        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
                            <p className="text-white text-sm font-semibold mb-0.5">
                                Chat Daily Limit / User
                            </p>
                            <p className="text-slate-500 text-xs mb-3">0 = unlimited</p>
                            <div className="flex gap-2">
                                <input type="number" min="0" max="200"
                                       value={config["chat.daily_limit_per_user"]}
                                       onChange={e => setConfig(p => ({
                                           ...p, "chat.daily_limit_per_user": e.target.value
                                       }))}
                                       className="flex-1 bg-slate-700 border border-slate-600
                                                  rounded-lg px-3 py-2 text-white text-sm
                                                  focus:outline-none focus:border-blue-500"/>
                                <button
                                    onClick={() => handleConfigChange(
                                        "chat.daily_limit_per_user",
                                        config["chat.daily_limit_per_user"])}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700
                                               text-white text-xs font-semibold rounded-lg
                                               transition-colors">
                                    Save
                                </button>
                            </div>
                        </div>

                        {/* Extract daily limit */}
                        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/40">
                            <p className="text-white text-sm font-semibold mb-0.5">
                                Image Import Limit / User / Day
                            </p>
                            <p className="text-slate-500 text-xs mb-3">
                                0 = unlimited · Stock + MF combined
                            </p>
                            <div className="flex gap-2">
                                <input type="number" min="0" max="50"
                                       value={config["extract.daily_limit_per_user"]}
                                       onChange={e => setConfig(p => ({
                                           ...p, "extract.daily_limit_per_user": e.target.value
                                       }))}
                                       className="flex-1 bg-slate-700 border border-slate-600
                                                  rounded-lg px-3 py-2 text-white text-sm
                                                  focus:outline-none focus:border-blue-500"/>
                                <button
                                    onClick={() => handleConfigChange(
                                        "extract.daily_limit_per_user",
                                        config["extract.daily_limit_per_user"])}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700
                                               text-white text-xs font-semibold rounded-lg
                                               transition-colors">
                                    Save
                                </button>
                            </div>
                        </div>

                    </div>

                    <p className="text-slate-600 text-xs mt-4 leading-relaxed">
                        History depth directly affects token cost — lower = cheaper.
                        At current scale total AI cost is typically under Rs.200/month.
                    </p>
                </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Today's Cost",    value: fmt(todayCostInr),
                        color: "text-amber-400",  bg: "bg-amber-900/20 border-amber-500/20"  },
                    { label: "Total Cost",       value: fmt(totalCostInr),
                        color: "text-red-400",    bg: "bg-red-900/20 border-red-500/20"      },
                    { label: "Today's Requests", value: todayRequests,
                        color: "text-blue-400",   bg: "bg-blue-900/20 border-blue-500/20"    },
                    { label: "Total Requests",   value: totalRequests,
                        color: "text-green-400",  bg: "bg-green-900/20 border-green-500/20"  },
                ].map((c, i) => (
                    <div key={i} className={`${c.bg} border rounded-2xl p-4`}>
                        <p className="text-slate-500 text-xs mb-1">{c.label}</p>
                        <p className={`${c.color} font-bold text-xl`}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Daily usage chart */}
            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm mb-4">
                    Daily Usage — Last 14 Days
                </p>
                {dailyDates.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">
                        No usage data yet
                    </p>
                ) : (
                    <div className="flex items-end gap-2 h-32">
                        {dailyDates.map(date => {
                            const d     = dailyMap[date];
                            const total = d.chat + d.image;
                            return (
                                <div key={date}
                                     className="flex-1 flex flex-col items-center gap-1">
                                    <p className="text-slate-500 text-[9px]">
                                        Rs.{d.totalCostInr.toFixed(1)}
                                    </p>
                                    <div className="w-full flex flex-col gap-0.5 justify-end"
                                         style={{ height: "80px" }}>
                                        {d.chat > 0 && (
                                            <div className="w-full bg-blue-500 rounded-t"
                                                 style={{
                                                     height: `${(d.chat / maxReqs) * 80}px`
                                                 }}
                                                 title={`${d.chat} chat`}/>
                                        )}
                                        {d.image > 0 && (
                                            <div className="w-full bg-purple-500 rounded-b"
                                                 style={{
                                                     height: `${(d.image / maxReqs) * 80}px`
                                                 }}
                                                 title={`${d.image} extractions`}/>
                                        )}
                                        {total === 0 && (
                                            <div className="w-full bg-slate-700 rounded"
                                                 style={{ height: "4px" }}/>
                                        )}
                                    </div>
                                    <p className="text-slate-600 text-[9px]">
                                        {date.slice(5)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-blue-500 rounded"/>
                        <span className="text-xs text-slate-500">Chat</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-purple-500 rounded"/>
                        <span className="text-xs text-slate-500">Image Extraction</span>
                    </div>
                </div>
            </div>

            {/* Per-user breakdown */}
            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/60">
                    <p className="text-white font-semibold text-sm">Per-User Breakdown</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                        Click a user to view their chat history
                    </p>
                </div>

                {perUserUsage.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">
                        No user activity yet
                    </p>
                ) : perUserUsage.map((u, i) => (
                    <div key={i}>
                        {/* User row */}
                        <div onClick={() => toggleUser(u.userId)}
                             className="flex items-center justify-between px-5 py-4
                                        border-b border-slate-700/30 hover:bg-slate-700/30
                                        cursor-pointer transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30
                                                rounded-full flex items-center justify-center
                                                text-blue-300 text-xs font-bold">
                                    {(u.username || "?")[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-white text-sm font-semibold">
                                        {u.fullName || u.username}
                                        <span className="text-slate-500 font-normal ml-1">
                                            (@{u.username})
                                        </span>
                                    </p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-blue-400 text-xs">
                                            💬 {u.chatRequests} chats
                                        </span>
                                        <span className="text-purple-400 text-xs">
                                            📸 {u.imageExtractions} scans
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-amber-400 font-bold text-sm">
                                        {fmt(u.totalCostInr)}
                                    </p>
                                    <p className="text-slate-600 text-xs">total cost</p>
                                </div>
                                <span className={`text-slate-500 transition-transform text-xs ${
                                    expanded === u.userId ? "rotate-180" : ""
                                }`}>▼</span>
                            </div>
                        </div>

                        {/* Expanded sessions */}
                        {expanded === u.userId && (
                            <div className="bg-slate-900/40 border-b border-slate-700/30">
                                {!sessions[u.userId] ? (
                                    <p className="text-slate-500 text-xs text-center py-4">
                                        Loading…
                                    </p>
                                ) : sessions[u.userId].length === 0 ? (
                                    <p className="text-slate-500 text-xs text-center py-4">
                                        No chat sessions
                                    </p>
                                ) : sessions[u.userId].map((s, si) => (
                                    <div key={si}>
                                        <button
                                            onClick={() => loadSession(u.userId, s.sessionId)}
                                            className="w-full text-left px-8 py-3
                                                       hover:bg-slate-700/40 transition-colors
                                                       border-b border-slate-700/20 last:border-0
                                                       flex items-center justify-between">
                                            <div>
                                                <p className="text-slate-300 text-xs font-medium">
                                                    {s.preview || "Session"}
                                                </p>
                                                <p className="text-slate-600 text-[10px] mt-0.5">
                                                    {s.messageCount} messages
                                                </p>
                                            </div>
                                            <span className="text-slate-600 text-[10px]">
                                                {activeSession?.sessionId === s.sessionId
                                                    ? "▲ Hide" : "▼ View"}
                                            </span>
                                        </button>

                                        {/* Inline transcript */}
                                        {activeSession?.sessionId === s.sessionId && (
                                            <div className="px-8 py-3 space-y-2
                                                            border-b border-slate-700/20
                                                            bg-slate-900/60 max-h-80
                                                            overflow-y-auto">
                                                {msgLoading ? (
                                                    <p className="text-slate-500 text-xs
                                                                  text-center py-2">
                                                        Loading…
                                                    </p>
                                                ) : messages.map((m, mi) => (
                                                    <div key={mi}
                                                         className={`flex ${
                                                             m.role === "user"
                                                                 ? "justify-end"
                                                                 : "justify-start"
                                                         }`}>
                                                        <div className={`max-w-[85%] rounded-xl
                                                            px-3 py-2 text-xs ${
                                                            m.role === "user"
                                                                ? "bg-blue-600/30 text-blue-200 border border-blue-500/20"
                                                                : "bg-slate-700/60 text-slate-300 border border-slate-600/30"
                                                        }`}>
                                                            <span className="font-semibold mr-1">
                                                                {m.role === "user" ? "User:" : "AI:"}
                                                            </span>
                                                            {(m.content || "").length > 300
                                                                ? m.content.slice(0, 300) + "…"
                                                                : m.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}