import { useState } from "react";
import { api } from "../api/portfolio";

export default function ChangePasswordModal({ onClose }) {
    const [form,    setForm]    = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const [success, setSuccess] = useState(false);

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (form.newPassword !== form.confirmPassword) {
            setError("New passwords don't match"); return;
        }
        if (form.newPassword.length < 8) {
            setError("New password must be at least 8 characters"); return;
        }

        setLoading(true);
        try {
            await api.put("/users/change-password", {
                currentPassword: form.currentPassword,
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
                            className="text-slate-500 hover:text-white transition-colors text-xl
                                       leading-none">
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
                            {error && (
                                <div className="bg-red-900/30 border border-red-700/50
                                                rounded-xl px-4 py-3 text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            {[
                                { label: "Current Password",  field: "currentPassword",  placeholder: "Enter current password"  },
                                { label: "New Password",      field: "newPassword",       placeholder: "Min. 8 characters"       },
                                { label: "Confirm Password",  field: "confirmPassword",   placeholder: "Repeat new password"     },
                            ].map(({ label, field, placeholder }) => (
                                <div key={field}>
                                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                                        {label}
                                    </label>
                                    <input
                                        type="password"
                                        value={form[field]}
                                        onChange={set(field)}
                                        placeholder={placeholder}
                                        required
                                        className="w-full bg-slate-800 border border-slate-700
                                                   rounded-xl px-4 py-2.5 text-white text-sm
                                                   focus:outline-none focus:border-blue-500
                                                   transition-colors"
                                    />
                                </div>
                            ))}

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