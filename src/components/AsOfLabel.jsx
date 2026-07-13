// src/components/AsOfLabel.jsx
// Shows "as of HH:MM" for the last successful data fetch. Makes it clear the
// numbers may be a cached/last-known snapshot rather than this-instant live —
// important trust signal now that the app caches aggressively.
import { useLastUpdated, formatAsOf } from "../utils/freshness";

export default function AsOfLabel({ prefix = "as of", className = "" }) {
    const ts = useLastUpdated();
    if (!ts) return null;
    return (
        <span className={"text-slate-500 " + className}>
            {prefix} {formatAsOf(ts)}
        </span>
    );
}
