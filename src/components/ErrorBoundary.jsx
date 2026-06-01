// src/components/ErrorBoundary.jsx
//
// Per-route error isolation. Each route has its own boundary so one broken
// page never kills the sidebar, header, or other routes.
//
// Key behaviors:
// 1. Resets automatically when the URL changes (navigate away + back = fresh start)
// 2. Shows a contained error card inside the layout — NOT a full-screen takeover
// 3. "Try again" resets state; if the error was transient it recovers cleanly

import { Component } from "react";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
        this.handleReset = this.handleReset.bind(this);
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[ErrorBoundary] Caught:", error);
        console.error("[ErrorBoundary] Stack:", errorInfo?.componentStack);
    }

    // Reset when the URL changes so navigating away + back gives a clean slate
    componentDidUpdate(prevProps) {
        if (this.state.hasError && prevProps.locationKey !== this.props.locationKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    handleReset() {
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
        const title = this.props.fallbackTitle || "Something went wrong";
        const err   = this.state.error;

        return (
            <div className="flex items-center justify-center min-h-[60vh] p-6">
                <div className="w-full max-w-md">
                    <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-8">

                        <div className="w-12 h-12 bg-red-900/20 border border-red-500/20
                                        rounded-xl flex items-center justify-center mb-5">
                            <span className="text-2xl">⚠️</span>
                        </div>

                        <h2 className="text-white text-xl font-bold mb-2">{title}</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            This page ran into an error. The rest of the app is still working —
                            use the sidebar to navigate to another section.
                        </p>

                        <div className="flex flex-col gap-2.5 mb-6">
                            {/* Try again — resets boundary, works for transient errors */}
                            <button
                                onClick={this.handleReset}
                                className="flex items-center justify-center gap-2 py-2.5
                                           bg-blue-600 hover:bg-blue-700 text-white
                                           font-semibold rounded-xl transition-colors text-sm">
                                🔄 Try again
                            </button>

                            {/* Navigate away — uses React Router, no full page reload */}
                            <div className="grid grid-cols-2 gap-2">
                                <a href="/stocks"
                                   className="flex items-center justify-center gap-1.5 py-2.5
                                              bg-slate-800 hover:bg-slate-700 text-slate-300
                                              font-medium rounded-xl transition-colors text-sm
                                              border border-slate-700">
                                    📈 Market
                                </a>
                                <a href="/stocks/holdings"
                                   className="flex items-center justify-center gap-1.5 py-2.5
                                              bg-slate-800 hover:bg-slate-700 text-slate-300
                                              font-medium rounded-xl transition-colors text-sm
                                              border border-slate-700">
                                    💼 Holdings
                                </a>
                            </div>
                        </div>

                        <p className="text-slate-600 text-xs leading-relaxed">
                            💡 Your data is safe on the server. This is a display error only.
                        </p>

                        {/* Technical details — dev only */}
                        {isDev && err && (
                            <details className="mt-4">
                                <summary className="text-xs text-slate-600 hover:text-slate-400
                                                    cursor-pointer transition-colors">
                                    Error details (dev only)
                                </summary>
                                <div className="mt-2 bg-slate-800 rounded-xl p-3 overflow-auto
                                                max-h-48">
                                    <p className="text-red-400 text-xs font-mono font-bold mb-1">
                                        {err.name}: {err.message}
                                    </p>
                                    {err.stack && (
                                        <pre className="text-slate-500 text-[10px] font-mono
                                                        whitespace-pre-wrap leading-relaxed">
                                            {err.stack}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}