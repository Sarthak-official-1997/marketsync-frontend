import { useState, useEffect } from "react";
import { getSummary } from "../api/portfolio";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(val);

export default function NavPortfolioValue() {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        getSummary().then(res => setSummary(res.data)).catch(() => {});
    }, []);

    if (!summary || summary.totalHoldings === 0)
        return null;

    const pl  = parseFloat(summary.unrealizedPL);
    const pct = parseFloat(summary.unrealizedPLPercent);

    return (
        <div className="hidden md:flex items-center gap-3 px-4 py-1.5
                        bg-slate-700/50 rounded-lg border border-slate-600 flex-shrink-0">

            <div>
                <p className="text-xs text-slate-400">Portfolio</p>
                <p className="text-sm font-bold text-white">{fmt(summary.currentValue)}</p>
            </div>
            <div className={`text-right ${pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                <p className="text-xs">P&amp;L</p>
                <p className="text-sm font-medium">
                    {pl >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </p>
            </div>
        </div>
    );
}