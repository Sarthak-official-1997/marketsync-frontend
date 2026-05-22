// src/components/ErrorBoundary.jsx
//
// React Error Boundaries must be CLASS components — hooks cannot catch render errors.
// Wrap any subtree: if a child throws during render/lifecycle, this catches it and
// shows the ErrorFallback instead of crashing the whole app.
//
// Usage:
//   <ErrorBoundary>               ← catches everything inside
//       <Routes>...</Routes>
//   </ErrorBoundary>
//
//   <ErrorBoundary fallbackTitle="Holdings failed to load">
//       <HoldingsPage />
//   </ErrorBoundary>

import { Component } from "react";
import ErrorFallback from "./ErrorFallback";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
        this.handleReset = this.handleReset.bind(this);
    }

    // Called during render when a descendant throws.
    // Must return the new state — cannot have side effects here.
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    // Called after the error is committed to state.
    // Safe for logging/side effects.
    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // In production you would send this to an error tracking service
        // e.g. Sentry.captureException(error, { extra: errorInfo });
        console.error("[ErrorBoundary] Caught error:", error);
        console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    }

    handleReset() {
        this.setState({ hasError: false, error: null, errorInfo: null });
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorFallback
                    error={this.state.error}
                    errorInfo={this.state.errorInfo}
                    onReset={this.handleReset}
                    title={this.props.fallbackTitle}
                />
            );
        }
        return this.props.children;
    }
}