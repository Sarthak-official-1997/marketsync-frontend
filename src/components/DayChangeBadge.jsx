// src/components/DayChangeBadge.jsx
// Reusable 1-day change badge — use everywhere a stock is shown.
// Props: change (price diff), changePercent (%), size ("sm"|"md")

export default function DayChangeBadge({ change, changePercent, size = "sm", showPrice = false }) {
    if (changePercent == null && change == null) return null;

    const pct   = parseFloat(changePercent ?? 0);
    const chg   = parseFloat(change ?? 0);
    const isPos = pct >= 0;
    const isZero = pct === 0;

    const arrow = isZero ? "—" : isPos ? "▲" : "▼";
    const color = isZero ? "text-slate-400" : isPos ? "text-green-400" : "text-red-400";
    const bg    = isZero ? "bg-slate-700/40" : isPos ? "bg-green-500/10" : "bg-red-500/10";
    const border = isZero ? "border-slate-600/30" : isPos ? "border-green-500/20" : "border-red-500/20";

    const textSize = size === "md" ? "text-sm" : "text-xs";
    const padding  = size === "md" ? "px-2 py-1" : "px-1.5 py-0.5";

    return (
        <span className={`inline-flex items-center gap-1 rounded-md font-semibold border
                         ${bg} ${color} ${border} ${textSize} ${padding} whitespace-nowrap`}>
            <span className="text-[10px] leading-none">{arrow}</span>
            <span>{Math.abs(pct).toFixed(2)}%</span>
            {showPrice && change != null && (
                <span className="opacity-70">
                    ({isPos ? "+" : ""}{chg.toFixed(2)})
                </span>
            )}
        </span>
    );
}