import { useState, useEffect, useCallback } from "react";
import { getIndices } from "../api/portfolio";

const isMarketHours = () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const h   = ist.getHours();
    const m   = ist.getMinutes();
    const day = ist.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 9 * 60 && mins <= 15 * 60 + 30;
};

const fmtVal = (v) => {
    if (v == null) return "—";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v);
};

export default function IndexTicker() {
    const [indices, setIndices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(() => {
        getIndices()
            .then(res => setIndices(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetch();
        // Poll every 60s during market hours, every 5min outside
        const interval = setInterval(
            fetch,
            isMarketHours() ? 60_000 : 300_000
        );
        return () => clearInterval(interval);
    }, [fetch]);

    if (loading) {
        return (
            <div className="flex gap-6">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i}
                         className="h-8 w-24 bg-slate-700 rounded animate-pulse" />
                ))}
            </div>
        );
    }

    if (indices.length === 0) return null;

    return (
        <div className="flex items-center gap-1">
            {indices.map((idx, i) => {
                const up = parseFloat(idx.changePercent || 0) >= 0;
                return (
                    <div key={idx.symbol}
                         className={
                             "flex flex-col items-center px-3 py-1 rounded-lg " +
                             (i < indices.length - 1
                                 ? "border-r border-slate-700" : "")
                         }>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-300">
                                {idx.displayName}
                            </span>
                            <span className="text-xs font-bold text-white">
                                {fmtVal(idx.value)}
                            </span>
                        </div>
                        <span className={
                            "text-xs font-medium " +
                            (up ? "text-green-400" : "text-red-400")
                        }>
                            {up ? "▲" : "▼"}{" "}
                            {Math.abs(parseFloat(idx.changePercent || 0)).toFixed(2)}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
}