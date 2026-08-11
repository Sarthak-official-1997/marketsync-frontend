const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444",
    "#8b5cf6","#06b6d4","#ec4899","#84cc16"];

// Small up/down triangle next to each row's weight % — deliberately a
// DIFFERENT signal than the weight bar itself: the bar shows how much of
// the portfolio this stock IS (a slow-moving allocation fact), the
// triangle shows whether it's up or down from YESTERDAY's close right now
// (a live, today-only fact). A stock can be a huge, stable chunk of the
// portfolio (long bar) while also being red today (down triangle) — the
// two numbers answer different questions, neither substitutes for the
// other.
function DayChangeTriangle({ pct }) {
    if (pct == null || isNaN(pct)) return null;
    const isUp = parseFloat(pct) >= 0;
    return (
        <svg width="8" height="8" viewBox="0 0 10 10" className="flex-shrink-0"
             style={{ display: "inline-block" }}
             title={isUp ? "Up today" : "Down today"}>
            {isUp
                ? <polygon points="5,1 9,8 1,8" fill="#22c55e" />
                : <polygon points="1,2 9,2 5,9" fill="#ef4444" />}
        </svg>
    );
}

export default function HoldingsBreakdownBar({ byStock }) {
    if (!byStock || byStock.length === 0) return null;

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-base font-semibold text-white mb-4">Portfolio Breakdown</h2>

            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden mb-5">
                {byStock.map((item, i) => (
                    <div key={item.label}
                         style={{ width: `${item.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                         title={`${item.label}: ${item.percentage}%`} />
                ))}
            </div>

            {/* Legend */}
            <div className="space-y-2">
                {byStock.map((item, i) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                 style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-white font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-32 bg-slate-700 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full"
                                     style={{ width: `${item.percentage}%`,
                                         backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="text-slate-400 w-10 text-right text-xs">
                                {parseFloat(item.percentage).toFixed(1)}%
                            </span>
                            {/* Deliberately separated from the weight % with a divider —
                                this is a DIFFERENT fact (today's direction, not portfolio
                                weight), and sitting right next to the number read as
                                "▼16.0%" = "down 16% today," which is backwards. */}
                            <span className="w-4 flex items-center justify-center
                                             border-l border-slate-700 pl-2.5">
                                <DayChangeTriangle pct={item.dayChangePercent} />
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}