// src/components/HoldingSparkline.jsx
// Extracted from HoldingsPage.jsx, where it was a page-local function only
// that page could use. Pulled out shared so the Client Tracker Performance
// table (and anywhere else stocks are listed) can show the same mini chart
// instead of duplicating the fetch-and-render logic per page.

import { useState, useEffect } from "react";
import { getStockChart } from "../api/portfolio";

export default function HoldingSparkline({ symbol, exchange }) {
    const [points, setPoints] = useState([]);
    const [up,     setUp]     = useState(true);

    useEffect(() => {
        const parse = (res) =>
            (res?.dataPoints || [])
                .filter(p => p.close != null)
                .map(p => parseFloat(p.close))
                .filter(v => v > 0);

        getStockChart(symbol, exchange || "NSE", "5m", "1d")
            .then(res => {
                const pts = parse(res.data);
                if (pts.length > 3) {
                    setPoints(pts);
                    setUp(pts[pts.length - 1] >= pts[0]);
                } else {
                    return getStockChart(symbol, exchange || "NSE", "1d", "5d")
                        .then(r => {
                            const p2 = parse(r.data);
                            setPoints(p2);
                            if (p2.length > 1) setUp(p2[p2.length - 1] >= p2[0]);
                        });
                }
            })
            .catch(() => {});
    }, [symbol]);

    if (points.length < 2) {
        return <div className="w-24 h-10 bg-slate-700/30 rounded animate-pulse" />;
    }

    const W = 96, H = 40;
    const color  = up ? "#22c55e" : "#ef4444";
    const fillId = `hs_${symbol.replace(/[^a-z0-9]/gi, "_")}`;
    const min = Math.min(...points), max = Math.max(...points);
    const range = max - min || 1;
    const pad = H * 0.1;
    const toX = i  => (i  / (points.length - 1)) * W;
    const toY = v  => pad + ((max - v) / range) * (H - pad * 2);

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