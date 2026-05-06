import { useState, useEffect } from "react";
import { getTransactions } from "../api/portfolio";

export default function PLCalendar() {
    const [weeks, setWeeks]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTransactions(0, 100).then(res => {
            const txns = res.data.content || [];

            const byDate = {};
            txns.forEach(t => {
                const date = t.transactionDate;
                if (!byDate[date]) byDate[date] = 0;
                const amount = parseFloat(t.totalAmount);
                byDate[date] += t.type === "SELL" ? amount : -amount;
            });

            const today = new Date();
            const grid  = [];
            for (let w = 11; w >= 0; w--) {
                const week = [];
                for (let d = 6; d >= 0; d--) {
                    const date = new Date(today);
                    date.setDate(today.getDate() - (w * 7 + d));
                    const key = date.toISOString().split("T")[0];
                    week.push({
                        date: key,
                        value: byDate[key] || 0,
                        isToday: key === today.toISOString().split("T")[0],
                    });
                }
                grid.push(week);
            }
            setWeeks(grid);
        }).catch(() => setWeeks([]))
            .finally(() => setLoading(false));
    }, []);

    const getColor = (value) => {
        if (value === 0)     return "bg-slate-700";
        if (value > 5000)    return "bg-green-500";
        if (value > 1000)    return "bg-green-600";
        if (value > 0)       return "bg-green-800";
        if (value > -1000)   return "bg-red-800";
        if (value > -5000)   return "bg-red-600";
        return "bg-red-500";
    };

    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].reverse();

    if (loading || weeks.length === 0) return null;

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Activity Calendar</h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Less</span>
                    {["bg-slate-700","bg-green-800","bg-green-600","bg-green-500"].map(c => (
                        <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
                    ))}
                    <span>More</span>
                </div>
            </div>

            <div className="flex gap-1">
                <div className="flex flex-col gap-1 mr-1">
                    {days.map(d => (
                        <div key={d} className="h-3 text-[9px] text-slate-500 w-6 flex items-center">
                            {d}
                        </div>
                    ))}
                </div>
                {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                        {week.map((cell, di) => (
                            <div key={di}
                                 className={`w-3 h-3 rounded-sm cursor-default
                                             transition-transform hover:scale-125
                                             ${getColor(cell.value)}
                                             ${cell.isToday ? "ring-1 ring-blue-400" : ""}`}
                                 title={`${cell.date}: ${cell.value === 0
                                     ? "No activity"
                                     : `₹${cell.value.toLocaleString("en-IN")}`}`} />
                        ))}
                    </div>
                ))}
            </div>

            <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>🟩 Profitable day</span>
                <span>🟥 Loss day</span>
                <span>⬜ No activity</span>
            </div>
        </div>
    );
}