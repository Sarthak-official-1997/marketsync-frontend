import { useState } from "react";
import { setupPasskey } from "../api/user";
import { useToast } from "../context/ToastContext";

const PASSKEY_REGEX = /^[0-9]{10}[a-z]{5}[0-9]{4}[a-z]{1}$/;

// Visual breakdown of passkey input
function PasskeyInput({ value, onChange }) {
    const part1 = value.slice(0, 10);   // 10 digits
    const part2 = value.slice(10, 15);  // 5 alpha
    const part3 = value.slice(15, 19);  // 4 digits
    const part4 = value.slice(19, 20);  // 1 alpha

    const seg = (text, max, type, color) => (
        <span className={`font-mono text-sm ${color}`}>
            {text || <span className="opacity-30">{"_".repeat(max - text.length) + text}</span>}
        </span>
    );

    return (
        <div className="space-y-2">
            <input
                type="text"
                value={value}
                onChange={e => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
                    if (v.length <= 20) onChange(v);
                }}
                maxLength={20}
                placeholder="Enter your passkey (20 characters)"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl
                           px-4 py-3 text-white font-mono text-sm tracking-widest
                           focus:outline-none focus:border-blue-500"
            />
            {/* Visual segment breakdown */}
            <div className="flex items-center gap-1 bg-slate-900 rounded-lg px-3 py-2
                            border border-slate-700 font-mono text-xs">
                <span className={`${part1.length === 10 ? "text-green-400" : "text-slate-500"}`}>
                    {(part1 + "·".repeat(10 - part1.length)).slice(0, 10)}
                </span>
                <span className="text-slate-700 mx-0.5">│</span>
                <span className={`${part2.length === 5 ? "text-blue-400" : "text-slate-500"}`}>
                    {(part2 + "·".repeat(5 - part2.length)).slice(0, 5)}
                </span>
                <span className="text-slate-700 mx-0.5">│</span>
                <span className={`${part3.length === 4 ? "text-green-400" : "text-slate-500"}`}>
                    {(part3 + "·".repeat(4 - part3.length)).slice(0, 4)}
                </span>
                <span className="text-slate-700 mx-0.5">│</span>
                <span className={`${part4.length === 1 ? "text-blue-400" : "text-slate-500"}`}>
                    {part4 || "·"}
                </span>
                <span className="ml-auto text-slate-600 text-[10px]">{value.length}/20</span>
            </div>
            {/* Legend */}
            <div className="flex gap-3 text-[10px]">
                <span className="text-green-400">■ digits</span>
                <span className="text-blue-400">■ letters</span>
            </div>
        </div>
    );
}

export default function PasskeySetupModal({ onClose, onDone, isBlocking = false }) {
    const [passkey,  setPasskey]  = useState("");
    const [confirm,  setConfirm]  = useState("");
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState("");
    const toast = useToast();

    const isValid = PASSKEY_REGEX.test(passkey);
    const matches = passkey === confirm;

    const handleSubmit = async () => {
        if (!isValid) {
            setError("Passkey format incorrect. Check the guide below.");
            return;
        }
        if (!matches) {
            setError("Passkeys do not match.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await setupPasskey(passkey);
            toast.success("Passkey set up successfully!");
            onDone?.();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to set passkey");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
            <div className="w-full max-w-md bg-slate-900 border border-slate-700
                            rounded-2xl shadow-2xl">

                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-5
                                border-b border-slate-700">
                    <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30
                                    rounded-xl flex items-center justify-center text-xl">
                        🔑
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">Set Up Your Passkey</h2>
                        <p className="text-slate-400 text-xs mt-0.5">
                            One-time setup · Used to recover your password
                        </p>
                    </div>
                    {!isBlocking && (
                        <button onClick={onClose}
                                className="ml-auto text-slate-500 hover:text-white text-xl">
                            ✕
                        </button>
                    )}
                </div>

                <div className="p-6 space-y-5">

                    {/* What is a passkey */}
                    <div className="bg-blue-900/20 border border-blue-700/40
                                    rounded-xl p-4 text-sm text-blue-200 space-y-2">
                        <p className="font-semibold text-blue-300">What is a passkey?</p>
                        <p className="text-xs text-blue-300/80 leading-relaxed">
                            A 20-character code you'll use to recover your password if
                            you ever forget it. We recommend using your mobile number
                            + PAN card number — things you already know by heart.
                        </p>
                        <div className="bg-slate-900/60 rounded-lg px-3 py-2 font-mono text-xs
                                        text-slate-300 space-y-1">
                            <p>Format: <span className="text-green-400">9876543210</span><span className="text-blue-400">abcde</span><span className="text-green-400">7890</span><span className="text-blue-400">m</span></p>
                            <p className="text-slate-500">
                                <span className="text-green-400">10-digit mobile</span>
                                {" + "}
                                <span className="text-blue-400">PAN letters (abc de)</span>
                                {" + "}
                                <span className="text-green-400">PAN digits (7890)</span>
                                {" + "}
                                <span className="text-blue-400">last PAN letter (m)</span>
                            </p>
                            <p className="text-amber-400/80 text-[10px]">
                                All lowercase · No spaces · No special characters
                            </p>
                        </div>
                    </div>

                    {/* Passkey input */}
                    <div>
                        <label className="text-xs text-slate-400 font-medium block mb-2">
                            Enter Passkey *
                        </label>
                        <PasskeyInput value={passkey} onChange={setPasskey} />
                    </div>

                    {/* Confirm */}
                    <div>
                        <label className="text-xs text-slate-400 font-medium block mb-1.5">
                            Confirm Passkey *
                        </label>
                        <input
                            type="text"
                            value={confirm}
                            onChange={e => setConfirm(
                                e.target.value.toLowerCase()
                                    .replace(/[^a-z0-9]/g, "").slice(0, 20)
                            )}
                            placeholder="Re-enter passkey"
                            className={"w-full bg-slate-800 border rounded-xl px-4 py-3 " +
                            "text-white font-mono text-sm tracking-widest " +
                            "focus:outline-none " +
                            (confirm.length > 0
                                ? matches
                                    ? "border-green-500 focus:border-green-500"
                                    : "border-red-500 focus:border-red-500"
                                : "border-slate-600 focus:border-blue-500")}
                        />
                        {confirm.length > 0 && (
                            <p className={`text-xs mt-1 ${matches ? "text-green-400" : "text-red-400"}`}>
                                {matches ? "✓ Passkeys match" : "✗ Passkeys do not match"}
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-900/30 border border-red-700/50
                                        rounded-xl px-4 py-3 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={saving || !isValid || !matches}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700
                                   disabled:opacity-40 disabled:cursor-not-allowed
                                   text-white font-bold rounded-xl transition-colors">
                        {saving ? "Setting up…" : "✓ Passkey Setup Done"}
                    </button>

                    {isBlocking && (
                        <p className="text-center text-slate-600 text-xs">
                            This is a one-time setup. You can't skip this step.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}