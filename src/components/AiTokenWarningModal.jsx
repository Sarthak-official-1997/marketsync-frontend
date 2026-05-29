const LEVELS = {
    1: {
        threshold:   12000,
        color:       "amber",
        icon:        "⚠️",
        title:       "High Token Usage Detected",
        borderClass: "border-amber-500/50",
        bgClass:     "bg-amber-900/20",
        badgeClass:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
        barClass:    "bg-amber-500",
        btnClass:    "bg-amber-600 hover:bg-amber-700",
    },
    2: {
        threshold:   20000,
        color:       "orange",
        icon:        "🔥",
        title:       "Very High Token Usage",
        borderClass: "border-orange-500/50",
        bgClass:     "bg-orange-900/20",
        badgeClass:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
        barClass:    "bg-orange-500",
        btnClass:    "bg-orange-600 hover:bg-orange-700",
    },
    3: {
        threshold:   25000,
        color:       "red",
        icon:        "🚨",
        title:       "Extremely High Token Usage",
        borderClass: "border-red-500/50",
        bgClass:     "bg-red-900/20",
        badgeClass:  "bg-red-500/20 text-red-300 border-red-500/30",
        barClass:    "bg-red-500",
        btnClass:    "bg-red-600 hover:bg-red-700",
    },
};

const USD_TO_INR      = 85;
const COST_INPUT_PER_M = 0.15;
const MAX_TOKEN_DISPLAY = 30000;

function estimateCost(tokens) {
    // Input cost only (thinking is unknown upfront, so show as "+ thinking cost")
    const usd = (tokens / 1_000_000) * COST_INPUT_PER_M;
    return (usd * USD_TO_INR).toFixed(3);
}

export default function AiTokenWarningModal({ level, estimatedTokens, onContinue, onStop }) {
    const cfg = LEVELS[level];
    if (!cfg) return null;

    const pct = Math.min(100, Math.round((estimatedTokens / MAX_TOKEN_DISPLAY) * 100));

    const costMin = estimateCost(estimatedTokens);
    const costMax = (parseFloat(costMin) * 8).toFixed(2); // thinking tokens can 8x the cost

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
            <div className={`w-full max-w-md bg-slate-900 border rounded-2xl
                             shadow-2xl overflow-hidden ${cfg.borderClass}`}>

                {/* Top accent bar */}
                <div className={`h-1 w-full ${cfg.barClass}`} />

                <div className="p-6 space-y-5">

                    {/* Header */}
                    <div className="flex items-start gap-4">
                        <span className="text-4xl flex-shrink-0">{cfg.icon}</span>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-white font-bold text-base">
                                    {cfg.title}
                                </h2>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full
                                                  border font-bold ${cfg.badgeClass}`}>
                                    Level {level}/3
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                The data you're sending to AI is very large.
                                This may result in a high token bill for this single request.
                            </p>
                        </div>
                    </div>

                    {/* Token stats */}
                    <div className={`rounded-xl p-4 border space-y-3 ${cfg.bgClass} ${cfg.borderClass}`}>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                                Estimated Input Tokens
                            </span>
                            <span className="text-white font-bold text-lg">
                                ~{estimatedTokens.toLocaleString("en-IN")}
                            </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${cfg.barClass}`}
                                 style={{ width: pct + "%" }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600">
                            <span>0</span>
                            <span>10k</span>
                            <span>20k</span>
                            <span>30k+</span>
                        </div>

                        {/* Cost estimate */}
                        <div className="flex items-center justify-between pt-1
                                        border-t border-slate-700/60">
                            <span className="text-slate-400 text-xs">
                                Estimated cost range
                            </span>
                            <span className="text-white text-sm font-semibold">
                                Rs {costMin} – Rs {costMax}
                                <span className="text-slate-500 text-[10px] ml-1">
                                    (incl. thinking)
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Context message by level */}
                    <div className="bg-slate-800/60 rounded-xl p-3">
                        <p className="text-slate-400 text-xs leading-relaxed">
                            {level === 1 && "💡 Tip: If your CSV/Excel has many rows not related to trades, consider trimming it to just the transactions section before uploading."}
                            {level === 2 && "💡 Tip: Consider splitting the file into smaller parts — upload one page or one month at a time for better accuracy and lower cost."}
                            {level === 3 && "⛔ This is a very large input. Gemini may still truncate the response. Consider processing this file in smaller batches for reliable results."}
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onStop}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600
                                       text-white font-semibold rounded-xl text-sm
                                       transition-colors">
                            Stop & Go Back
                        </button>
                        <button
                            onClick={onContinue}
                            className={`flex-1 py-3 text-white font-bold
                                        rounded-xl text-sm transition-colors
                                        ${cfg.btnClass}`}>
                            Continue Anyway →
                        </button>
                    </div>

                    <p className="text-slate-600 text-[10px] text-center">
                        This warning only appears for CREATOR account · FOLYO
                    </p>
                </div>
            </div>
        </div>
    );
}