// src/components/PwaInstallPrompt.jsx
//
// Shows a custom "Add to Home Screen" banner when the browser fires
// the beforeinstallprompt event (Android Chrome / Edge).
// On iOS Safari it shows manual instructions since iOS doesn't support
// the install event.
//
// Usage: render <PwaInstallPrompt /> once in App.jsx outside the Layout.

import { useState, useEffect } from "react";

const IOS_KEY     = "folyo_ios_install_dismissed";
const ANDROID_KEY = "folyo_android_install_dismissed";

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
}

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showAndroid,    setShowAndroid]    = useState(false);
    const [showIos,        setShowIos]        = useState(false);

    useEffect(() => {
        // Already installed — don't show
        if (isInStandaloneMode()) return;

        // iOS — show manual instructions once
        if (isIos() && !localStorage.getItem(IOS_KEY)) {
            setTimeout(() => setShowIos(true), 3000);
        }

        // Android/Chrome — listen for browser install event
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!localStorage.getItem(ANDROID_KEY)) {
                setTimeout(() => setShowAndroid(true), 2000);
            }
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleAndroidInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            localStorage.setItem(ANDROID_KEY, "1");
        }
        setShowAndroid(false);
        setDeferredPrompt(null);
    };

    const dismissAndroid = () => {
        localStorage.setItem(ANDROID_KEY, "1");
        setShowAndroid(false);
    };

    const dismissIos = () => {
        localStorage.setItem(IOS_KEY, "1");
        setShowIos(false);
    };

    // Android install banner — slides up from bottom
    if (showAndroid) return (
        <div className="fixed bottom-0 left-0 right-0 z-[9998]
                        animate-[slideUp_0.3s_ease-out]">
            <div className="m-3 bg-slate-900 border border-purple-500/30
                            rounded-2xl shadow-2xl overflow-hidden">
                {/* Purple accent line */}
                <div className="h-0.5 w-full bg-gradient-to-r
                                from-purple-600 via-purple-400 to-purple-600" />
                <div className="flex items-center gap-3 p-4">
                    <img src="/icons/icon-72.png" alt="FOLYO"
                         className="w-12 h-12 rounded-xl flex-shrink-0
                                    ring-1 ring-purple-500/30" />
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">
                            Add FOLYO to Home Screen
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Access your portfolio instantly — no browser needed
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                    <button
                        onClick={dismissAndroid}
                        className="flex-1 py-2.5 bg-slate-800 border border-slate-700
                                   text-slate-400 text-sm rounded-xl transition-colors
                                   hover:bg-slate-700">
                        Not now
                    </button>
                    <button
                        onClick={handleAndroidInstall}
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500
                                   text-white text-sm font-bold rounded-xl
                                   transition-colors">
                        ✨ Install
                    </button>
                </div>
            </div>
        </div>
    );

    // iOS manual instructions
    if (showIos) return (
        <div className="fixed bottom-0 left-0 right-0 z-[9998]">
            <div className="m-3 bg-slate-900 border border-purple-500/30
                            rounded-2xl shadow-2xl overflow-hidden">
                <div className="h-0.5 w-full bg-gradient-to-r
                                from-purple-600 via-purple-400 to-purple-600" />
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <img src="/icons/icon-72.png" alt="FOLYO"
                                 className="w-8 h-8 rounded-lg ring-1 ring-purple-500/30" />
                            <p className="text-white font-bold text-sm">
                                Install FOLYO on iPhone
                            </p>
                        </div>
                        <button onClick={dismissIos}
                                className="text-slate-500 hover:text-white text-lg">✕</button>
                    </div>
                    <div className="space-y-2">
                        {[
                            { step: "1", icon: "⬆️", text: 'Tap the Share button at the bottom of Safari' },
                            { step: "2", icon: "➕", text: 'Tap "Add to Home Screen"' },
                            { step: "3", icon: "✅", text: 'Tap "Add" — FOLYO opens like a native app' },
                        ].map(s => (
                            <div key={s.step} className="flex items-center gap-3
                                                          bg-slate-800 rounded-xl px-3 py-2.5">
                                <span className="text-lg flex-shrink-0">{s.icon}</span>
                                <p className="text-slate-300 text-xs leading-relaxed">{s.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return null;
}