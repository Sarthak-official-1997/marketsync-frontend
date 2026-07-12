// src/utils/haptics.js
// Tiny haptic feedback helper. navigator.vibrate works on Android/Chrome; iOS
// Safari ignores it, so every call is a safe no-op there (progressive enhancement).
// Keep buzzes short — they should feel like a tick, never a rumble.

function buzz(pattern) {
    try {
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(pattern);
        }
    } catch { /* ignore — unsupported */ }
}

export const haptics = {
    tap:     () => buzz(10),           // light tick: taps, tab switches, toggles
    success: () => buzz([12, 40, 12]), // double tick: trade done, alert set
    warn:    () => buzz([0, 30, 20, 30]),
    error:   () => buzz(60),           // one firmer buzz: failed action
};

export default haptics;