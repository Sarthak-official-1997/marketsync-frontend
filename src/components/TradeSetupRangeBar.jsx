// src/components/TradeSetupRangeBar.jsx
// The visual you asked for — a horizontal price range showing the red zone
// (stop-loss → entry), the green zone (entry → furthest target), each
// target marked individually (supports multiple targets), and a dashed
// marker for the current live price. Shown when a Quick Trade group is
// expanded in the Alerts list.
//
// This lives IN THE APP, not inside the actual push notification — native
// browser/phone notifications can only show plain text + a small icon, they
// cannot render custom graphics. Tapping the notification opens the app to
// this same visual instead.

export default function TradeSetupRangeBar({ alertsForSetup, currentPrice }) {
    const entry    = alertsForSetup.find(a => a.level === "ENTRY");
    const stopLoss = alertsForSetup.find(a => a.level === "STOP_LOSS");
    const targets   = alertsForSetup
        .filter(a => a.level === "TARGET")
        .sort((a, b) => (a.targetIndex || 0) - (b.targetIndex || 0));

    if (!entry || !stopLoss || targets.length === 0) return null;

    const entryV    = parseFloat(entry.computedTarget);
    const stopV     = parseFloat(stopLoss.computedTarget);
    const targetVs  = targets.map(t => parseFloat(t.computedTarget));
    const cp        = currentPrice != null ? parseFloat(currentPrice) : null;

    const allValues = [entryV, stopV, ...targetVs, ...(cp != null ? [cp] : [])];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const pct = (v) => ((v - min) / range) * 100;

    const redFrom  = Math.min(pct(stopV), pct(entryV));
    const redTo    = Math.max(pct(stopV), pct(entryV));
    const greenFrom = Math.min(pct(entryV), ...targetVs.map(pct));
    const greenTo   = Math.max(pct(entryV), ...targetVs.map(pct));

    return (
        <div className="bg-slate-900/60 rounded-xl px-3 py-3 mt-1">
            <div className="relative h-9 rounded-lg bg-slate-800 overflow-visible">
                {/* Red zone: stop-loss → entry */}
                <div className="absolute top-0 bottom-0 bg-red-500/40 rounded-l-lg"
                     style={{ left: `${redFrom}%`, width: `${redTo - redFrom}%` }} />
                {/* Green zone: entry → furthest target */}
                <div className="absolute top-0 bottom-0 bg-green-500/40 rounded-r-lg"
                     style={{ left: `${greenFrom}%`, width: `${greenTo - greenFrom}%` }} />

                {/* Entry marker */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${pct(entryV)}%` }} />

                {/* Target tick marks */}
                {targets.map((t, i) => (
                    <div key={t.id} className="absolute top-0 bottom-0 w-0.5 bg-green-300"
                         style={{ left: `${pct(targetVs[i])}%` }} />
                ))}

                {/* Stop-loss marker */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-300" style={{ left: `${pct(stopV)}%` }} />

                {/* Current price — dashed vertical line, clamped within the bar */}
                {cp != null && (
                    <div className="absolute top-[-4px] bottom-[-4px] w-0.5 border-l-2 border-dashed border-white"
                         style={{ left: `${Math.max(0, Math.min(100, pct(cp)))}%` }} />
                )}
            </div>

            {/* Labels below the bar, positioned under their marker */}
            <div className="relative h-8 mt-1 text-[10px]">
                <div className="absolute -translate-x-1/2 text-red-300 text-center" style={{ left: `${pct(stopV)}%` }}>
                    <p className="font-semibold">SL</p>
                    <p>₹{stopV.toLocaleString("en-IN")}</p>
                </div>
                <div className="absolute -translate-x-1/2 text-blue-300 text-center" style={{ left: `${pct(entryV)}%` }}>
                    <p className="font-semibold">Entry</p>
                    <p>₹{entryV.toLocaleString("en-IN")}</p>
                </div>
                {targets.map((t, i) => (
                    <div key={t.id} className="absolute -translate-x-1/2 text-green-300 text-center"
                         style={{ left: `${pct(targetVs[i])}%` }}>
                        <p className="font-semibold">T{t.targetIndex || i + 1}</p>
                        <p>₹{targetVs[i].toLocaleString("en-IN")}</p>
                    </div>
                ))}
            </div>

            {cp != null && (
                <p className="text-center text-[10px] text-slate-400 mt-1">
                    Current: <span className="text-white font-semibold">₹{cp.toLocaleString("en-IN")}</span>
                </p>
            )}
        </div>
    );
}