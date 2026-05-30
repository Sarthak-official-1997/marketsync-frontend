import { useState, useEffect, useRef } from "react";
import { revealPassword } from "../api/user";

const PASSKEY_REGEX = /^[0-9]{10}[a-z]{5}[0-9]{4}[a-z]{1}$/;

export default function RevealPasswordModal({ onClose }) {
    const [passkey,   setPasskey]   = useState("");
    const [loading,   setLoading]   = useState(false);
    const [revealed,  setRevealed]  = useState(null);
    const [countdown, setCountdown] = useState(20);
    const [copied,    setCopied]    = useState(false);
    const [error,     setError]     = useState("");
    const timerRef = useRef(null);

    // -- Real-time passkey format validation ----------------------------------
    const getPasskeyHint = () => {
        if (passkey.length === 0) return null;
        const p1 = passkey.slice(0, 10);
        const p2 = passkey.slice(10, 15);
        const p3 = passkey.slice(15, 19);
        const p4 = passkey.slice(19, 20);

        const d1ok = /^[0-9]{10}$/.test(p1);
        const d2ok = /^[a-z]{5}$/.test(p2);
        const d3ok = /^[0-9]{4}$/.test(p3);
        const d4ok = /^[a-z]{1}$/.test(p4);

        if (PASSKEY_REGEX.test(passkey)) return { valid: true, msg: "✓ Valid passkey format" };

        if (!d1ok) return {
            valid: false,
            msg: `First 10 characters must be digits (you have: ${p1.length}/10)`,
        };
        if (!d2ok) return {
            valid: false,
            msg: `Characters 11–15 must be lowercase letters (you have: ${p2.length}/5)`,
        };
        if (!d3ok) return {
            valid: false,
            msg: `Characters 16–19 must be digits (you have: ${p3.length}/4)`,
        };
        if (!d4ok) return {
            valid: false,
            msg: `Last character must be a lowercase letter`,
        };
        return null;
    };

    const hint = getPasskeyHint();

    // -- Countdown once revealed ----------------------------------------------
    useEffect(() => {
        if (!revealed) return;
        setCountdown(20);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [revealed]);

    const handleReveal = async () => {
        if (!PASSKEY_REGEX.test(passkey)) {
            setError("Passkey format is incorrect — check the format hint below");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await revealPassword(passkey);
            setRevealed(res.data.temporaryPassword);
        } catch (err) {
            setError(err.response?.data?.message || "Incorrect passkey");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard?.writeText(revealed).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700
                            rounded-2xl shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔓</span>
                        <div>
                            <h2 className="text-white font-bold">Reveal Password</h2>
                            <p className="text-slate-500 text-xs">
                                Verify passkey to get a new password
                            </p>
                        </div>
                    </div>
                    {!revealed && (
                        <button onClick={onClose}
                                className="text-slate-500 hover:text-white text-xl">
                            ✕
                        </button>
                    )}
                </div>

                <div className="p-6 space-y-4">

                    {!revealed ? (
                        <>
                            <div className="bg-amber-900/20 border border-amber-700/40
                                            rounded-xl p-3 text-amber-200 text-xs leading-relaxed">
                                Enter your passkey to receive a new temporary password.
                                Your account password will be reset to it — copy it
                                immediately as it disappears in <strong>20 seconds</strong>.
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 block mb-1.5">
                                    Your Passkey
                                </label>
                                <input
                                    type="text"
                                    value={passkey}
                                    onChange={e => {
                                        setError("");
                                        setPasskey(
                                            e.target.value.toLowerCase()
                                                .replace(/[^a-z0-9]/g, "").slice(0, 20)
                                        );
                                    }}
                                    placeholder="10digits + 5alpha + 4digits + 1alpha"
                                    className={`w-full bg-slate-800 border rounded-xl px-4 py-3
                                               text-white font-mono text-sm tracking-widest
                                               focus:outline-none transition-colors ${
                                        passkey.length === 0
                                            ? "border-slate-600 focus:border-blue-500"
                                            : PASSKEY_REGEX.test(passkey)
                                                ? "border-green-500 focus:border-green-500"
                                                : "border-amber-500/60 focus:border-amber-500"
                                    }`}
                                />

                                {/* Real-time format hint */}
                                {hint && (
                                    <p className={`text-xs mt-1.5 flex items-center gap-1 ${
                                        hint.valid ? "text-green-400" : "text-amber-400"
                                    }`}>
                                        {hint.valid ? "✓" : "⚠"} {hint.msg}
                                    </p>
                                )}

                                {/* Visual segment breakdown */}
                                {passkey.length > 0 && (
                                    <div className="flex items-center gap-1 mt-2 bg-slate-800
                                                    rounded-lg px-3 py-1.5 border border-slate-700
                                                    font-mono text-[11px]">
                                        <span className={passkey.slice(0,10).length === 10 && /^[0-9]{10}$/.test(passkey.slice(0,10)) ? "text-green-400" : "text-slate-500"}>
                                            {(passkey.slice(0,10) + "·".repeat(Math.max(0, 10 - passkey.slice(0,10).length))).slice(0,10)}
                                        </span>
                                        <span className="text-slate-700 mx-0.5">│</span>
                                        <span className={passkey.slice(10,15).length === 5 && /^[a-z]{5}$/.test(passkey.slice(10,15)) ? "text-blue-400" : "text-slate-500"}>
                                            {(passkey.slice(10,15) + "·".repeat(Math.max(0, 5 - passkey.slice(10,15).length))).slice(0,5)}
                                        </span>
                                        <span className="text-slate-700 mx-0.5">│</span>
                                        <span className={passkey.slice(15,19).length === 4 && /^[0-9]{4}$/.test(passkey.slice(15,19)) ? "text-green-400" : "text-slate-500"}>
                                            {(passkey.slice(15,19) + "·".repeat(Math.max(0, 4 - passkey.slice(15,19).length))).slice(0,4)}
                                        </span>
                                        <span className="text-slate-700 mx-0.5">│</span>
                                        <span className={passkey.slice(19,20).length === 1 && /^[a-z]$/.test(passkey.slice(19,20)) ? "text-blue-400" : "text-slate-500"}>
                                            {passkey.slice(19,20) || "·"}
                                        </span>
                                        <span className="ml-auto text-slate-600">
                                            {passkey.length}/20
                                        </span>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <p className="text-red-400 text-sm bg-red-900/20
                                              border border-red-700/40 rounded-xl px-3 py-2">
                                    {error}
                                </p>
                            )}

                            <button
                                onClick={handleReveal}
                                disabled={loading || !PASSKEY_REGEX.test(passkey)}
                                className="w-full py-3 bg-amber-600 hover:bg-amber-700
                                           disabled:opacity-40 disabled:cursor-not-allowed
                                           text-white font-bold rounded-xl transition-colors">
                                {loading ? "Verifying…" : "Reveal My Password"}
                            </button>
                        </>
                    ) : (
                        <div className="text-center space-y-4">

                            {/* Countdown ring — now out of 20 */}
                            <div className="relative mx-auto w-20 h-20">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9"
                                            fill="none" stroke="#1e293b" strokeWidth="3"/>
                                    <circle cx="18" cy="18" r="15.9"
                                            fill="none"
                                            stroke={countdown > 5 ? "#f59e0b" : "#ef4444"}
                                            strokeWidth="3"
                                            strokeDasharray={`${(countdown / 20) * 100} 100`}
                                            strokeLinecap="round"/>
                                </svg>
                                <div className="absolute inset-0 flex items-center
                                                justify-center">
                                    <span className={`text-2xl font-bold ${
                                        countdown > 5 ? "text-amber-400" : "text-red-400"
                                    }`}>{countdown}</span>
                                </div>
                            </div>

                            <p className="text-slate-400 text-sm">
                                Your temporary password — copy it now!
                            </p>

                            {/* Password display */}
                            <div className="bg-slate-800 border border-amber-500/50
                                            rounded-xl px-6 py-4">
                                <p className="text-amber-300 font-mono text-2xl
                                              font-bold tracking-widest select-all">
                                    {revealed}
                                </p>
                            </div>

                            {/* Copy button with glow + copied feedback */}
                            <button
                                onClick={handleCopy}
                                className={`w-full py-2.5 text-sm font-bold rounded-xl
                                           transition-all duration-200 border
                                           ${copied
                                    ? "bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                                    : "bg-slate-700 border-slate-600 text-white hover:bg-blue-600 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] active:scale-95"
                                }`}>
                                {copied ? "✓ Copied!" : "📋 Copy to Clipboard"}
                            </button>

                            <p className="text-slate-600 text-xs">
                                Use this password to log in, then change it immediately
                                from your profile settings.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}