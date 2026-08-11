// src/components/MfSparkline.jsx
// Same visual pattern as HoldingSparkline (stocks), built on NAV history
// instead of stock price ticks. MF NAV only updates once a day (published
// by AMFI, not live-traded), so this naturally shows daily-resolution
// movement over the last month rather than an intraday shape — that's a
// real difference from stocks, not a bug.

import { useState, useEffect } from "react";
import { getMfNavHistory } from "../api/portfolio";

export default function MfSparkline({ schemeCode }) {
    const [points, setPoints] = useState([]);
    const [up, setUp] = useState(true);

    useEffect(() => {
        if (!schemeCode) return;
        getMfNavHistory(schemeCode, "1M")
            .then(res => {
                const navs = (res?.data?.navHistory || [])
                    .map(p => parseFloat(p.nav))
                    .filter(v => v > 0);
                if (navs.length > 1) {
                    setPoints(navs);
                    setUp(navs[navs.length - 1] >= navs[0]);
                }
            })
            .catch(() => {});
    }, [schemeCode]);

    if (points.length < 2) {
        return <div className="w-24 h-10 bg-slate-700/30 rounded animate-pulse" />;
    }

    const W = 96, H = 40;
    const color  = up ? "#22c55e" : "#ef4444";
    const fillId = `ms_${schemeCode}`;
    const min = Math.min(...points), max = Math.max(...points);
    const range = max - min || 1;
    const pad = H * 0.1;
    const toX = i => (i / (points.length - 1)) * W;
    const toY = v => pad + ((max - v) / range) * (H - pad * 2);

    const linePts = points.map((v, i) =>
        `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
    const areaPath =
        `M ${toX(0).toFixed(1)},${toY(points[0]).toFixed(1)} ` +
        points.slice(1).map((v, i) =>
            `L ${toX(i + 1).toFixed(1)},${toY(v).toFixed(1)}`).join(" ") +
        ` L ${W},${H} L 0,${H} Z`;

    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
             preserveAspectRatio="none" style={{ display: "block" }}>
            <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${fillId})`} />
            <polyline points={linePts} fill="none" stroke={color}
                      strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}