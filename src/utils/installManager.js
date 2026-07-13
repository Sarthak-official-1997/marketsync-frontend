// src/utils/installManager.js
// Global capture of the PWA install lifecycle. The browser fires
// `beforeinstallprompt` once, early in page load — we stash that event here so a
// LATER user action (e.g. tapping "Install App" in the More menu) can still call
// prompt(). Import this once at startup (main.jsx) so we don't miss the event.

let deferredPrompt = null;
const listeners = new Set();

export function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
}
export function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function notify() { listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } }); }

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();        // suppress the mini-infobar; we drive install ourselves
        deferredPrompt = e;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;     // consumed / installed
        notify();
    });
}

export function getInstallState() {
    return {
        installed:  isStandalone(),
        canInstall: deferredPrompt !== null,
        isIos:      isIos(),
    };
}

// Resolves to "accepted" | "dismissed" | "unavailable".
export async function promptInstall() {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    let outcome = "dismissed";
    try { outcome = (await deferredPrompt.userChoice).outcome; } catch { /* ignore */ }
    deferredPrompt = null;
    notify();
    return outcome;
}

export function subscribeInstall(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}