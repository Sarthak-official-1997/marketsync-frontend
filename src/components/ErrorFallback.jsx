// src/components/ErrorFallback.jsx
//
// The "Sorry" page shown by ErrorBoundary when a component crashes.
// Also exported as a standalone page component for use in routes (404, etc.)
//
// Design goals:
//   - Branded and calm — doesn't look like a dev error dump
//   - Actionable — gives user clear next steps
//   - Shows technical details only in development (import.meta.env.DEV)

import { useState } from "react";

export default function ErrorFallback({ error, errorInfo, onReset, title }) {
    const [showDetails, setShowDetails] = useState(false);
    const isDev = import.meta.env.DEV;

    const handleGoHome = () => {
        window.location.href = "/";
    };

    const handleReload = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">

                {/* Brand mark */}
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center
                                    justify-center text-white font-bold text-sm">
                        M
                    </div>
                    <span className="text-white font-bold text-lg">915 CLUB MarketSync</span>
                </div>

                {/* Main card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">

                    {/* Icon */}
                    <div className="w-16 h-16 bg-red-900/20 border border-red-500/20
                                    rounded-2xl flex items-center justify-center mb-6">
                        <span className="text-3xl">⚠️</span>
                    </div>

                    {/* Heading */}
                    <h1 className="text-white text-2xl font-bold mb-2">
                        {title || "Something went wrong"}
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        This part of the app ran into an unexpected error.
                        Your portfolio data is safe — this is a display issue only.
                        Try the options below to get back on track.
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-8">

                        {/* Primary — try again (resets the error boundary) */}
                        {onReset && (
                            <button
                                onClick={onReset}
                                className="flex-1 flex items-center justify-center gap-2
                                           py-3 bg-blue-600 hover:bg-blue-700 text-white
                                           font-semibold rounded-xl transition-colors text-sm">
                                <span>🔄</span> Try again
                            </button>
                        )}

                        {/* Reload the page */}
                        <button
                            onClick={handleReload}
                            className="flex-1 flex items-center justify-center gap-2
                                       py-3 bg-slate-800 hover:bg-slate-700 text-white
                                       font-semibold rounded-xl transition-colors text-sm border
                                       border-slate-700">
                            <span>↺</span> Reload page
                        </button>

                        {/* Go home */}
                        <button
                            onClick={handleGoHome}
                            className="flex-1 flex items-center justify-center gap-2
                                       py-3 bg-slate-800 hover:bg-slate-700 text-slate-300
                                       font-semibold rounded-xl transition-colors text-sm border
                                       border-slate-700">
                            <span>🏠</span> Go to Market
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-800 pt-6">
                        <div className="flex items-start gap-3">
                            <span className="text-slate-600 text-lg mt-0.5">💡</span>
                            <p className="text-slate-600 text-xs leading-relaxed">
                                If this keeps happening, try clearing your browser cache
                                or opening in a new tab. Your holdings and transactions
                                are stored securely on the server and won't be affected.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Technical details — dev only */}
                {isDev && error && (
                    <div className="mt-4">
                        <button
                            onClick={() => setShowDetails(v => !v)}
                            className="text-xs text-slate-600 hover:text-slate-400
                                       transition-colors flex items-center gap-1.5">
                            <span>{showDetails ? "▼" : "▶"}</span>
                            {showDetails ? "Hide" : "Show"} error details (dev only)
                        </button>

                        {showDetails && (
                            <div className="mt-3 bg-slate-900 border border-slate-800
                                            rounded-xl p-4 overflow-auto max-h-64">
                                {/* Error message */}
                                <p className="text-red-400 text-xs font-bold mb-2 font-mono">
                                    {error.name}: {error.message}
                                </p>
                                {/* Stack trace */}
                                {error.stack && (
                                    <pre className="text-slate-500 text-xs font-mono
                                                    whitespace-pre-wrap leading-relaxed">
                                        {error.stack}
                                    </pre>
                                )}
                                {/* Component stack */}
                                {errorInfo?.componentStack && (
                                    <>
                                        <p className="text-slate-600 text-xs font-bold mt-3 mb-1">
                                            Component stack:
                                        </p>
                                        <pre className="text-slate-600 text-xs font-mono
                                                        whitespace-pre-wrap leading-relaxed">
                                            {errorInfo.componentStack}
                                        </pre>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}

// ── Standalone page variants ──────────────────────────────────────────────────

export function NotFoundPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-lg text-center">

                <div className="flex items-center gap-3 justify-center mb-10">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center
                                    justify-center text-white font-bold text-sm">M</div>
                    <span className="text-white font-bold text-lg">915 CLUB MarketSync</span>
                </div>

                <p className="text-8xl font-black text-slate-800 mb-4 select-none">404</p>
                <h1 className="text-white text-2xl font-bold mb-3">Page not found</h1>
                <p className="text-slate-500 text-sm mb-8">
                    The page you're looking for doesn't exist or was moved.
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => window.location.href = "/stocks/market"}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white
                                   font-semibold rounded-xl transition-colors text-sm">
                        Go to Market
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300
                                   font-semibold rounded-xl transition-colors text-sm border
                                   border-slate-700">
                        ← Go back
                    </button>
                </div>
            </div>
        </div>
    );
}

export function NetworkErrorPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="w-full max-w-lg text-center">
                <div className="flex items-center gap-3 justify-center mb-10">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center
                                    justify-center text-white font-bold text-sm">M</div>
                    <span className="text-white font-bold text-lg">915 CLUB MarketSync</span>
                </div>
                <div className="text-6xl mb-6">📡</div>
                <h1 className="text-white text-2xl font-bold mb-3">
                    Can't reach the server
                </h1>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                    The 915 CLUB MarketSync backend isn't responding. Make sure the server
                    is running on port 8080, then try again.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white
                               font-semibold rounded-xl transition-colors text-sm">
                    🔄 Retry
                </button>
            </div>
        </div>
    );
}