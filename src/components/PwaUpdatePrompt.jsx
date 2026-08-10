// src/components/PwaUpdatePrompt.jsx
// Surfaces service-worker updates so a fresh deploy never sits invisibly behind a
// stale cached build. Shows a "New version — Refresh" toast the moment a new SW is
// waiting, and polls for new deploys every 60s so a long-open PWA session catches
// them too. Pairs with BuildBadge (which confirms which build is actually live).
//
// Render <PwaUpdatePrompt /> once in App.jsx, outside Layout.
import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const POLL_MS = 60 * 1000;
// If the SW handoff hasn't reloaded the page within this window, something
// stalled (stuck fetch, a second open tab holding the old SW active, etc.)
// — force a hard reload rather than leaving the button looking clicked but
// dead with no way out for the user.
const UPDATE_TIMEOUT_MS = 6000;

export default function PwaUpdatePrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh:  [needRefresh,  setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_swUrl, r) {
            // Poll for a newer build periodically — deploy-gap killer for sessions
            // that stay open (installed PWAs often do).
            if (r) setInterval(() => { r.update().catch(() => {}); }, POLL_MS);
        },
    });
    const [updating, setUpdating] = useState(false);

    if (!offlineReady && !needRefresh) return null;

    const dismiss = () => { setOfflineReady(false); setNeedRefresh(false); };

    // BUG FIXED HERE: previously this called updateServiceWorker(true) with
    // no loading state and no fallback. Normally that call reloads the page
    // itself once the new SW takes over — but if that handoff stalls for
    // any reason (another open tab still holding the old SW active is the
    // common one), the click just silently did nothing: no spinner, no
    // error, no way to tell if it even registered. Two fixes: (1) immediate
    // loading feedback so the click visibly registers, (2) a hard
    // window.location.reload() fallback if the SW-driven reload hasn't
    // happened within UPDATE_TIMEOUT_MS — guarantees SOME resolution
    // instead of a button that can hang forever.
    const handleRefresh = () => {
        if (updating) return;
        setUpdating(true);
        // Stashed here, read back by a mount-once effect in App.jsx — see
        // that effect's comment for why this exists: a plain reload was
        // sometimes landing on Home instead of staying on the current page.
        sessionStorage.setItem(
            "ms_pwa_return_path",
            window.location.pathname + window.location.search + window.location.hash
        );
        const fallback = setTimeout(() => window.location.reload(), UPDATE_TIMEOUT_MS);
        updateServiceWorker(true).catch(() => {
            clearTimeout(fallback);
            window.location.reload();
        });
        // No success-path cleanup needed — updateServiceWorker(true)
        // navigates the page away on success, unmounting this component
        // before `updating` would ever need to reset.
    };

    return (
        <div style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
            zIndex: 9999,
            maxWidth: "92vw",
        }}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl
                            bg-slate-900/95 border border-[#863bff]/50 backdrop-blur">
                {needRefresh ? (
                    <>
                        <span className="text-sm text-slate-200 whitespace-nowrap">
                            {updating ? "Updating…" : "🚀 New version available"}
                        </span>
                        <button
                            onClick={handleRefresh}
                            disabled={updating}
                            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg
                                       bg-[#863bff] hover:bg-[#7c3aed] disabled:opacity-70 disabled:cursor-wait
                                       text-white transition-colors">
                            {updating && (
                                <span className="w-3 h-3 border-2 border-white/40 border-t-white
                                                 rounded-full animate-spin flex-shrink-0" />
                            )}
                            {updating ? "Refreshing" : "Refresh"}
                        </button>
                        {!updating && (
                            <button onClick={dismiss}
                                    className="text-slate-500 hover:text-slate-300 px-1 leading-none">
                                ✕
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <span className="text-sm text-slate-300 whitespace-nowrap">
                            ✓ Ready to work offline
                        </span>
                        <button onClick={dismiss}
                                className="text-slate-500 hover:text-slate-300 px-1 leading-none">
                            ✕
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}