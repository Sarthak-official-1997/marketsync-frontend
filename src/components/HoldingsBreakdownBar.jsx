const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444",
    "#8b5cf6","#06b6d4","#ec4899","#84cc16"];

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
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}