import { useState, useEffect, useRef } from "react";
import { useNavigate }         from "react-router-dom";
import { useToast }            from "../context/ToastContext";
import {
    getAiReport, getUserChatSessions, getUserChatSession,
    getAiConfig, updateAiConfig,
} from "../api/admin";

import AiChatViewerModal from "../components/AiChatViewerModal";

const fmt = v => `Rs.${parseFloat(v || 0).toLocaleString("en-IN",
    { maximumFractionDigits: 2 })}`;

// ── Token limit slider config ─────────────────────────────────────────────────
// Default (global) is 26000 tokens. Per-user overrides are stored as:
//   extract.max_tokens.user.{userId}  → string number
// 0 = use global default
const GLOBAL_DEFAULT_TOKENS = 26000;
const TOKEN_SLIDER_MIN  = 4000;
const TOKEN_SLIDER_MAX  = 60000;
const TOKEN_SLIDER_STEP = 1000;

// Nice markers on the slider track
const TOKEN_MARKERS = [4000, 8000, 12000, 16000, 20000, 26000, 32000, 40000, 50000, 60000];

function tokenLabel(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return String(v);
}

function tokenColor(v) {
    if (v <= 10000) return "text-green-400";
    if (v <= 20000) return "text-amber-400";
    if (v <= 30000) return "text-orange-400";
    return "text-red-400";
}

function tokenBarColor(v) {
    if (v <= 10000) return "#22c55e";
    if (v <= 20000) return "#f59e0b";
    if (v <= 30000) return "#f97316";
    return "#ef4444";
}

// ── Median calculation ────────────────────────────────────────────────────────
function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// ── Token Usage Graph component ───────────────────────────────────────────────
// Shows a horizontal distribution of per-user token usage buckets
// with median line and the current slider value overlaid
function TokenUsageGraph({ usages, sliderValue, medianValue }) {
    if (!usages || usages.length === 0) return (
        <div className="flex items-center justify-center h-20 text-slate-600 text-xs">
            No token usage data yet
        </div>
    );

    // Build buckets: 0-5k, 5-10k, 10-15k, 15-20k, 20-26k, 26-35k, 35k+
    const buckets = [
        { label: "0–5k",   min: 0,     max: 5000  },
        { label: "5–10k",  min: 5000,  max: 10000 },
        { label: "10–15k", min: 10000, max: 15000 },
        { label: "15–20k", min: 15000, max: 20000 },
        { label: "20–26k", min: 20000, max: 26000 },
        { label: "26–35k", min: 26000, max: 35000 },
        { label: "35k+",   min: 35000, max: Infinity },
    ];

    const counts = buckets.map(b =>
        usages.filter(v => v >= b.min && v < b.max).length
    );
    const maxCount = Math.max(...counts, 1);

    // Where does sliderValue and medianValue fall (0–100% of total range 0–60k)?
    const totalRange = 60000;
    const sliderPct  = Math.min(100, (sliderValue / totalRange) * 100);
    const medianPct  = Math.min(100, (medianValue / totalRange) * 100);

    return (
        <div className="relative">
            {/* Bars */}
            <div className="flex items-end gap-1 h-20 relative">
                {buckets.map((b, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-slate-600 text-[9px]">
                            {counts[i] > 0 ? counts[i] : ""}
                        </span>
                        <div
                            className="w-full rounded-sm transition-all"
                            style={{
                                height: `${Math.max(4, (counts[i] / maxCount) * 52)}px`,
                                backgroundColor: counts[i] > 0
                                    ? tokenBarColor((b.min + (b.max === Infinity ? 50000 : b.max)) / 2)
                                    : "#1e293b",
                                opacity: counts[i] > 0 ? 0.8 : 0.3,
                            }}
                        />
                        <span className="text-slate-600 text-[8px] leading-none text-center">
                            {b.label}
                        </span>
                    </div>
                ))}

                {/* Median line */}
                <div
                    className="absolute bottom-5 w-px bg-blue-400 opacity-80"
                    style={{
                        left:   `${medianPct}%`,
                        top:    0,
                        bottom: "18px",
                    }}
                    title={`Median: ~${tokenLabel(medianValue)} tokens`}
                />

                {/* Slider position line */}
                <div
                    className="absolute bottom-5 w-0.5 rounded-full"
                    style={{
                        left:            `${sliderPct}%`,
                        top:             0,
                        bottom:          "18px",
                        backgroundColor: tokenBarColor(sliderValue),
                        opacity:         0.9,
                    }}
                    title={`Limit: ${tokenLabel(sliderValue)} tokens`}
                />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-px h-3 bg-blue-400"/>
                    <span className="text-[10px] text-blue-400">
                        Median ~{tokenLabel(medianValue)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3 rounded-full"
                         style={{ backgroundColor: tokenBarColor(sliderValue) }}/>
                    <span className="text-[10px]" style={{ color: tokenBarColor(sliderValue) }}>
                        Limit {tokenLabel(sliderValue)}
                    </span>
                </div>
                <span className="text-[10px] text-slate-600 ml-auto">
                    {usages.length} user{usages.length !== 1 ? "s" : ""} with data
                </span>
            </div>
        </div>
    );
}

// ── Per-user token limit row ──────────────────────────────────────────────────
function UserTokenLimitRow({ u, config, configSaving, onSaveLimit, allUsages, medianTokens }) {
    const configKey    = `extract.max_tokens.user.${u.userId}`;
    const savedValue   = parseInt(config[configKey] || "0");
    const displayValue = savedValue > 0 ? savedValue : GLOBAL_DEFAULT_TOKENS;

    const [localValue, setLocalValue] = useState(displayValue);
    const [dirty,      setDirty]      = useState(false);
    const saveTimerRef = useRef(null);

    useEffect(() => {
        const v = parseInt(config[configKey] || "0");
        setLocalValue(v > 0 ? v : GLOBAL_DEFAULT_TOKENS);
        setDirty(false);
    }, [config[configKey]]);

    const handleSlider = (val) => {
        setLocalValue(val);
        setDirty(val !== displayValue);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            onSaveLimit(configKey, val);
            setDirty(false);
        }, 800);
    };

    const isAboveMedian = localValue > medianTokens * 1.5;
    const isDefault     = localValue === GLOBAL_DEFAULT_TOKENS;

    // Percentage position on the track (0–100)
    const pct = ((localValue - TOKEN_SLIDER_MIN) / (TOKEN_SLIDER_MAX - TOKEN_SLIDER_MIN)) * 100;
    const color = tokenBarColor(localValue);

    return (
        <div className="px-5 py-4 bg-slate-900/30 border-b border-slate-700/20 last:border-0">

            {/* ── User header ── */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-purple-600/20 border border-purple-500/30
                                    rounded-full flex items-center justify-center
                                    text-purple-300 text-[10px] font-bold flex-shrink-0">
                        {(u.username || "?")[0].toUpperCase()}
                    </div>
                    <span className="text-slate-300 text-sm font-medium">
                        {u.fullName || u.username}
                    </span>
                    <span className="text-slate-600 text-xs">@{u.username}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isDefault && (
                        <span className="text-[10px] text-slate-600 border border-slate-700
                                         px-2 py-0.5 rounded-full">
                            global default
                        </span>
                    )}
                    {dirty && (
                        <span className="text-[10px] text-amber-400 animate-pulse">saving...</span>
                    )}
                    <span className="text-base font-bold" style={{ color }}>
                        {tokenLabel(localValue)}
                    </span>
                </div>
            </div>

            {/* ── Custom slider track ── */}
            <div className="relative mb-1">

                {/* Track background */}
                <div className="relative h-2 bg-slate-700 rounded-full border border-slate-600/60">

                    {/* Filled portion */}
                    <div
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-75"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                    />

                    {/* Thumb */}
                    <div
                        className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-slate-900
                                   shadow-lg pointer-events-none transition-all duration-75"
                        style={{
                            left:            `${pct}%`,
                            transform:       "translate(-50%, -50%)",
                            backgroundColor: color,
                            boxShadow:       `0 0 0 3px ${color}33`,
                        }}
                    />

                    {/* Default marker line on track */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-blue-500/70 pointer-events-none"
                        style={{
                            left: `${((GLOBAL_DEFAULT_TOKENS - TOKEN_SLIDER_MIN) /
                                (TOKEN_SLIDER_MAX - TOKEN_SLIDER_MIN)) * 100}%`,
                        }}
                    />
                </div>

                {/* Invisible native input — handles all mouse/touch interaction */}
                <input
                    type="range"
                    min={TOKEN_SLIDER_MIN}
                    max={TOKEN_SLIDER_MAX}
                    step={TOKEN_SLIDER_STEP}
                    value={localValue}
                    onChange={e => handleSlider(parseInt(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    style={{ height: "8px", top: "50%", transform: "translateY(-50%)" }}
                />
            </div>

            {/* ── Tick marks ── */}
            <div className="relative h-5 mt-1">
                {TOKEN_MARKERS.map(m => {
                    const tickPct        = ((m - TOKEN_SLIDER_MIN) /
                        (TOKEN_SLIDER_MAX - TOKEN_SLIDER_MIN)) * 100;
                    const isGlobalDefault = m === GLOBAL_DEFAULT_TOKENS;
                    return (
                        <div
                            key={m}
                            className="absolute flex flex-col items-center"
                            style={{ left: `${tickPct}%`, transform: "translateX(-50%)" }}>
                            <div
                                className="mb-0.5"
                                style={{
                                    width:           "1px",
                                    height:          isGlobalDefault ? "6px" : "4px",
                                    backgroundColor: isGlobalDefault
                                        ? "#3b82f6"
                                        : localValue >= m ? color : "#475569",
                                }}
                            />
                            <span
                                className="text-[9px] whitespace-nowrap leading-none"
                                style={{
                                    color:      isGlobalDefault ? "#60a5fa"
                                        : localValue >= m ? color : "#475569",
                                    fontWeight: isGlobalDefault ? 600 : 400,
                                }}>
                                {isGlobalDefault ? "default" : tokenLabel(m)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* ── Range endpoints label ── */}
            <div className="flex justify-between text-[9px] text-slate-700 mt-1 px-0.5">
                <span>{tokenLabel(TOKEN_SLIDER_MIN)}</span>
                <span>{tokenLabel(TOKEN_SLIDER_MAX)}</span>
            </div>

            {/* ── Warning ── */}
            {isAboveMedian && localValue > 30000 && (
                <p className="text-amber-400/70 text-[10px] mt-2">
                    ⚠ This is {Math.round(localValue / medianTokens)}× the median usage —
                    consider if this user actually needs it
                </p>
            )}

            {/* ── Reset link ── */}
            {!isDefault && (
                <button
                    onClick={() => {
                        setLocalValue(GLOBAL_DEFAULT_TOKENS);
                        setDirty(false);
                        onSaveLimit(configKey, GLOBAL_DEFAULT_TOKENS);
                    }}
                    className="text-[10px] text-slate-600 hover:text-slate-400
                               transition-colors mt-1.5 block">
                    Reset to global default ({tokenLabel(GLOBAL_DEFAULT_TOKENS)})
                </button>
            )}
        </div>
    );
}

export default function AdminAiReportPage() {
    const [report,        setReport]        = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [config,        setConfig]        = useState(null);
    const [configSaving,  setConfigSaving]  = useState(false);
    const [expanded,      setExpanded]      = useState(null);
    const [tokenPanel,    setTokenPanel]    = useState(false); // show/hide token limits panel
    const [sessions,      setSessions]      = useState({});
    const [chatViewer,    setChatViewer]    = useState(null);
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

    // Silent save — no toast, used by per-user slider debounce
    const handleSilentConfigChange = async (key, value) => {
        try {
            const updated = await updateAiConfig(key, value);
            setConfig(updated);
        } catch { toast.error("Failed to save token limit"); }
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

    // ── Token stats from per-user data ────────────────────────────────────────
    // We use imageExtractions as a proxy for "heavy users" of the extract feature.
    // If the backend provides avgInputTokens per user, use that; otherwise estimate.
    // For the distribution graph we use u.avgInputTokens if available, else
    // a rough estimate from cost: cost_inr / (USD_to_INR * cost_per_token)
    const INR_PER_TOKEN = (85 * 0.15) / 1_000_000; // Rs per input token
    const allTokenUsages = perUserUsage
        .map(u => {
            // Use real field if backend exposes it, otherwise estimate from cost
            if (u.avgInputTokens) return u.avgInputTokens;
            if (u.imageExtractions > 0 && u.totalCostInr > 0) {
                // Rough per-request average
                return Math.round((parseFloat(u.totalCostInr) / u.imageExtractions) / INR_PER_TOKEN);
            }
            return 0;
        })
        .filter(v => v > 0);

    const medianTokens = median(allTokenUsages) || GLOBAL_DEFAULT_TOKENS;

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

            {/* ── Per-User Token Limit Panel ── */}
            {config && perUserUsage.length > 0 && (
                <div className="bg-slate-800 border border-purple-500/20 rounded-2xl overflow-hidden">

                    {/* Panel header — click to expand/collapse */}
                    <button
                        onClick={() => setTokenPanel(p => !p)}
                        className="w-full flex items-center justify-between px-5 py-4
                                   hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">🎛️</span>
                            <div className="text-left">
                                <p className="text-white font-bold text-sm">
                                    Per-Client Token Limits
                                </p>
                                <p className="text-slate-500 text-xs">
                                    Override the AI extraction token cap per user ·
                                    Global default: {tokenLabel(GLOBAL_DEFAULT_TOKENS)} tokens
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">
                                {perUserUsage.filter(u =>
                                    parseInt(config[`extract.max_tokens.user.${u.userId}`] || "0") > 0
                                ).length} overrides active
                            </span>
                            <span className={`text-slate-400 text-xs transition-transform ${
                                tokenPanel ? "rotate-180" : ""}`}>▼</span>
                        </div>
                    </button>

                    {tokenPanel && (
                        <div className="border-t border-slate-700/40">

                            {/* Distribution graph — always shown at top of panel */}
                            <div className="px-5 py-4 bg-slate-900/30 border-b border-slate-700/30">
                                <p className="text-white text-xs font-semibold mb-1">
                                    Token Usage Distribution — All Users
                                </p>
                                <p className="text-slate-600 text-[10px] mb-3">
                                    Estimated input tokens per extraction request.
                                    Use this to decide where to set limits.
                                </p>
                                <TokenUsageGraph
                                    usages={allTokenUsages}
                                    sliderValue={parseInt(
                                        config[`extract.max_tokens.user.${
                                            perUserUsage[0]?.userId}`] || "0"
                                    ) || GLOBAL_DEFAULT_TOKENS}
                                    medianValue={medianTokens}
                                />
                                <div className="mt-3 grid grid-cols-3 gap-3">
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <p className="text-blue-400 font-bold text-sm">
                                            ~{tokenLabel(medianTokens)}
                                        </p>
                                        <p className="text-slate-600 text-[10px]">median usage</p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <p className="text-green-400 font-bold text-sm">
                                            {tokenLabel(GLOBAL_DEFAULT_TOKENS)}
                                        </p>
                                        <p className="text-slate-600 text-[10px]">global default</p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <p className="text-amber-400 font-bold text-sm">
                                            ~{tokenLabel(Math.round(medianTokens * 1.5))}
                                        </p>
                                        <p className="text-slate-600 text-[10px]">suggested max</p>
                                    </div>
                                </div>
                                <p className="text-slate-700 text-[10px] mt-2 leading-relaxed">
                                    💡 Setting the limit just above the median ensures
                                    normal users are unaffected while preventing runaway costs
                                    from unusually large uploads.
                                </p>
                            </div>

                            {/* Per-user sliders */}
                            {perUserUsage.map((u, i) => (
                                <UserTokenLimitRow
                                    key={u.userId}
                                    u={u}
                                    config={config}
                                    configSaving={configSaving}
                                    onSaveLimit={handleSilentConfigChange}
                                    allUsages={allTokenUsages}
                                    medianTokens={medianTokens}
                                />
                            ))}
                        </div>
                    )}
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
                                <div key={date} className="flex-1 flex flex-col items-center gap-1">
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
                        Click a user to expand · Click a session to read full chat
                    </p>
                </div>

                {perUserUsage.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">
                        No user activity yet
                    </p>
                ) : perUserUsage.map((u, i) => (
                    <div key={i}>
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
                                        {/* Show per-user token limit badge if overridden */}
                                        {parseInt(config?.[`extract.max_tokens.user.${u.userId}`] || "0") > 0 && (
                                            <span className="text-orange-400 text-xs">
                                                🎛 {tokenLabel(parseInt(config[`extract.max_tokens.user.${u.userId}`]))} limit
                                            </span>
                                        )}
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

                        {expanded === u.userId && (
                            <div className="bg-slate-900/40 border-b border-slate-700/30">
                                {!sessions[u.userId] ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="w-4 h-4 border-2 border-blue-400
                                                        border-t-transparent rounded-full
                                                        animate-spin"/>
                                    </div>
                                ) : sessions[u.userId].length === 0 ? (
                                    <p className="text-slate-500 text-xs text-center py-6">
                                        No chat sessions yet
                                    </p>
                                ) : sessions[u.userId].map((s, si) => (
                                    <button
                                        key={si}
                                        onClick={() => setChatViewer({
                                            userId:    u.userId,
                                            sessionId: s.sessionId,
                                            username:  u.username,
                                        })}
                                        className="w-full flex items-center justify-between
                                                   px-8 py-3 hover:bg-slate-700/40
                                                   transition-colors text-left
                                                   border-b border-slate-700/20 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-300 text-sm font-medium truncate">
                                                {s.preview || "Chat session"}
                                            </p>
                                            <p className="text-slate-600 text-[10px] mt-0.5">
                                                {s.messageCount} message{s.messageCount !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        <span className="text-xs text-blue-400 font-medium
                                                         flex-shrink-0 ml-4">
                                            Read chat →
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {chatViewer && (
                <AiChatViewerModal
                    userId={chatViewer.userId}
                    sessionId={chatViewer.sessionId}
                    username={chatViewer.username}
                    onClose={() => setChatViewer(null)}
                />
            )}

        </div>
    );
}