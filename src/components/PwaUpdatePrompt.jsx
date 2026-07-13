// src/components/PwaUpdatePrompt.jsx
// Surfaces service-worker updates so a fresh deploy never sits invisibly behind a
// stale cached build. Shows a "New version — Refresh" toast the moment a new SW is
// waiting, and polls for new deploys every 60s so a long-open PWA session catches
// them too. Pairs with BuildBadge (which confirms which build is actually live).
//
// Render <PwaUpdatePrompt /> once in App.jsx, outside Layout.
import { useRegisterSW } from "virtual:pwa-register/react";

const POLL_MS = 60 * 1000;

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

    if (!offlineReady && !needRefresh) return null;

    const dismiss = () => { setOfflineReady(false); setNeedRefresh(false); };

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
                            🚀 New version available
                        </span>
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="text-sm font-semibold px-3 py-1.5 rounded-lg
                                       bg-[#863bff] hover:bg-[#7c3aed] text-white transition-colors">
                            Refresh
                        </button>
                        <button onClick={dismiss}
                                className="text-slate-500 hover:text-slate-300 px-1 leading-none">
                            ✕
                        </button>
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
