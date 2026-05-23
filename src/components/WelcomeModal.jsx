import { useState } from "react";

export default function WelcomeModal({ user, onClose }) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            icon: "📈",
            title: `Welcome to 915 CLUB, ${user?.fullName?.split(" ")[0] || user?.username}!`,
            body: "You now have access to professional-grade stock and mutual fund portfolio tracking — built exclusively for 915 CLUB members.",
        },
        {
            icon: "🏦",
            title: "Track Stocks & Mutual Funds",
            body: "Search from 4,900+ NSE/BSE stocks and 37,600+ mutual fund schemes. Add transactions, track holdings, and monitor your real-time P&L in one place.",
        },
        {
            icon: "📊",
            title: "Your Personal Market Board",
            body: "Pin any stock to your Market Board for live prices and sparkline charts at a glance. Add from the top search bar or the + Add Stock button.",
        },
        {
            icon: "🔔",
            title: "Alerts & Watchlist",
            body: "Set price alerts so you never miss an entry point. Build watchlists to track stocks you're researching before investing.",
        },
        {
            icon: "🚀",
            title: "You're all set!",
            body: "Start by adding your first stock or mutual fund transaction. Your portfolio dashboard will come alive as you build your positions. Welcome aboard.",
        },
    ];

    const current = steps[step];
    const isLast  = step === steps.length - 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>

            <div className="w-full max-w-md bg-slate-900 border border-slate-700
                            rounded-2xl shadow-2xl overflow-hidden">

                {/* Gold accent header */}
                <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

                {/* Brand */}
                <div className="flex items-center gap-3 px-6 pt-6 pb-2">
                    <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/40
                                    rounded-xl flex items-center justify-center">
                        <span className="text-amber-400 font-black text-sm">915</span>
                    </div>
                    <div>
                        <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                            915 CLUB
                        </p>
                        <p className="text-slate-500 text-xs">MarketSync</p>
                    </div>
                    <div className="ml-auto flex gap-1">
                        {steps.map((_, i) => (
                            <div key={i}
                                 className={"h-1 rounded-full transition-all duration-300 " +
                                 (i === step
                                     ? "w-6 bg-amber-400"
                                     : i < step
                                         ? "w-2 bg-amber-600"
                                         : "w-2 bg-slate-700")} />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">{current.icon}</div>
                        <h2 className="text-white text-xl font-bold mb-3 leading-snug">
                            {current.title}
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            {current.body}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        {step > 0 && (
                            <button
                                onClick={() => setStep(s => s - 1)}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700
                                           text-slate-300 text-sm font-medium rounded-xl
                                           border border-slate-700 transition-colors">
                                ← Back
                            </button>
                        )}
                        <button
                            onClick={() => isLast ? onClose() : setStep(s => s + 1)}
                            className={"flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors " +
                            (isLast
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
                                : "bg-blue-600 hover:bg-blue-500 text-white")}>
                            {isLast ? "🚀 Start Tracking" : "Next →"}
                        </button>
                    </div>

                    {/* Skip */}
                    {!isLast && (
                        <button
                            onClick={onClose}
                            className="w-full mt-3 text-xs text-slate-600
                                       hover:text-slate-400 transition-colors">
                            Skip intro
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}