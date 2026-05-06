const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444",
    "#8b5cf6","#06b6d4","#ec4899","#84cc16"];

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(val);

export default function SectorExposureCard({ bySector }) {
    if (!bySector || bySector.length === 0) return null;

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-base font-semibold text-white mb-4">Sector Exposure</h2>
            <div className="space-y-3">
                {bySector.map((sector, i) => (
                    <div key={sector.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full"
                                     style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-white">{sector.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 text-xs">{fmt(sector.value)}</span>
                                <span className="text-white font-medium w-12 text-right">
                                    {parseFloat(sector.percentage).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all duration-500"
                                 style={{ width: `${sector.percentage}%`,
                                     backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}