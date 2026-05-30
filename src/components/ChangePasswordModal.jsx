import { useState } from "react";
import { api } from "../api/portfolio";

const PASSKEY_REGEX = /^[0-9]{10}[a-z]{5}[0-9]{4}[a-z]{1}$/;

export default function ChangePasswordModal({ onClose }) {
    const [mode,    setMode]    = useState("current"); // "current" | "passkey"
    const [form,    setForm]    = useState({
        currentPassword: "",
        passkey:         "",
        newPassword:     "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const [success, setSuccess] = useState(false);

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Validate new password
        if (form.newPassword !== form.confirmPassword) {
            setError("New passwords don't match"); return;
        }
        if (form.newPassword.length < 6) {
            setError("New password must be at least 6 characters"); return;
        }

        // Validate the chosen verification method
        if (mode === "current" && !form.currentPassword) {
            setError("Enter your current password"); return;
        }
        if (mode === "passkey" && !PASSKEY_REGEX.test(form.passkey)) {
            setError("Passkey format incorrect (10digits+5alpha+4digits+1alpha)"); return;
        }

        setLoading(true);
        try {
            await api.post("/user/change-password", {
                currentPassword: mode === "current" ? form.currentPassword : null,
                passkey:         mode === "passkey"  ? form.passkey         : null,
                newPassword:     form.newPassword,
            });
            setSuccess(true);
            setTimeout(onClose, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to change password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700
                            rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🔑</span>
                        <h2 className="text-white font-bold">Change Password</h2>
                    </div>
                    <button onClick={onClose}
                            className="text-slate-500 hover:text-white transition-colors
                                       text-xl leading-none">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    {success ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-3">✅</div>
                            <p className="text-green-400 font-semibold">Password changed!</p>
                            <p className="text-slate-400 text-sm mt-1">Closing in a moment...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* -- Verification mode toggle -- */}
                            <div>
                                <p className="text-xs text-slate-400 font-medium mb-2">
                                    Verify identity using:
                                </p>
                                <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => { setMode("current"); setError(""); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold
                                                   transition-colors ${
                                            mode === "current"
                                                ? "bg-blue-600 text-white"
                                                : "text-slate-400 hover:text-white"
                                        }`}>
                                        🔒 Current Password
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setMode("passkey"); setError(""); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold
                                                   transition-colors ${
                                            mode === "passkey"
                                                ? "bg-blue-600 text-white"
                                                : "text-slate-400 hover:text-white"
                                        }`}>
                                        🔑 Passkey
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-900/30 border border-red-700/50
                                                rounded-xl px-4 py-3 text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* -- Current password field OR passkey field -- */}
                            {mode === "current" ? (
                                <div>
                                    <label className="text-xs text-slate-400 font-medium
                                                      block mb-1.5">
                                        Current Password
                                    </label>
                                    <input
                                        type="password"
                                        value={form.currentPassword}
                                        onChange={set("currentPassword")}
                                        placeholder="Enter current password"
                                        className="w-full bg-slate-800 border border-slate-700
                                                   rounded-xl px-4 py-2.5 text-white text-sm
                                                   focus:outline-none focus:border-blue-500
                                                   transition-colors"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs text-slate-400 font-medium
                                                      block mb-1.5">
                                        Your Passkey
                                        <span className="text-slate-600 ml-1 font-normal">
                                            (10digits+5alpha+4digits+1alpha)
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.passkey}
                                        onChange={e => setForm({
                                            ...form,
                                            passkey: e.target.value.toLowerCase()
                                                .replace(/[^a-z0-9]/g, "").slice(0, 20)
                                        })}
                                        placeholder="e.g. 9876543210abcde7890m"
                                        className="w-full bg-slate-800 border border-slate-700
                                                   rounded-xl px-4 py-2.5 text-white text-sm
                                                   font-mono tracking-widest focus:outline-none
                                                   focus:border-blue-500 transition-colors"
                                    />
                                    {form.passkey.length > 0 && (
                                        <p className={`text-xs mt-1 ${
                                            PASSKEY_REGEX.test(form.passkey)
                                                ? "text-green-400"
                                                : "text-slate-500"
                                        }`}>
                                            {form.passkey.length}/20
                                            {PASSKEY_REGEX.test(form.passkey) ? " ✓ Valid" : ""}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* -- New password -- */}
                            <div>
                                <label className="text-xs text-slate-400 font-medium
                                                  block mb-1.5">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={form.newPassword}
                                    onChange={set("newPassword")}
                                    placeholder="Min. 6 characters"
                                    className="w-full bg-slate-800 border border-slate-700
                                               rounded-xl px-4 py-2.5 text-white text-sm
                                               focus:outline-none focus:border-blue-500
                                               transition-colors"
                                />
                            </div>

                            {/* -- Confirm password -- */}
                            <div>
                                <label className="text-xs text-slate-400 font-medium
                                                  block mb-1.5">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={form.confirmPassword}
                                    onChange={set("confirmPassword")}
                                    placeholder="Repeat new password"
                                    className={`w-full bg-slate-800 border rounded-xl px-4
                                               py-2.5 text-white text-sm focus:outline-none
                                               transition-colors ${
                                        form.confirmPassword.length > 0
                                            ? form.newPassword === form.confirmPassword
                                                ? "border-green-500 focus:border-green-500"
                                                : "border-red-500 focus:border-red-500"
                                            : "border-slate-700 focus:border-blue-500"
                                    }`}
                                />
                                {form.confirmPassword.length > 0 && (
                                    <p className={`text-xs mt-1 ${
                                        form.newPassword === form.confirmPassword
                                            ? "text-green-400"
                                            : "text-red-400"
                                    }`}>
                                        {form.newPassword === form.confirmPassword
                                            ? "✓ Passwords match"
                                            : "✗ Passwords do not match"}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={onClose}
                                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700
                                                   text-slate-300 text-sm font-medium rounded-xl
                                                   border border-slate-700 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={loading}
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700
                                                   disabled:opacity-50 text-white text-sm
                                                   font-bold rounded-xl transition-colors">
                                    {loading ? "Saving..." : "Change Password"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}