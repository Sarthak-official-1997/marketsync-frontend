import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login as loginApi } from "../api/auth";

export default function LoginPage() {
    const [form, setForm]       = useState({ usernameOrEmail: "", password: "" });
    const [error, setError]     = useState("");
    const [loading, setLoading] = useState(false);
    const { login }             = useAuth();
    const navigate              = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { data } = await loginApi(form);
            login(data.token, data.user);
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-8
                            border border-slate-700 shadow-2xl">
                <h1 className="text-2xl font-bold text-white mb-1">📈 MarketSync</h1>
                <p className="text-slate-400 text-sm mb-6">Sign in to your account</p>

                {error && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300
                                    rounded-lg p-3 text-sm mb-4">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Username or Email</label>
                        <input type="text" value={form.usernameOrEmail}
                               onChange={e => setForm({ ...form, usernameOrEmail: e.target.value })}
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2 text-white text-sm focus:outline-none
                                          focus:border-blue-500"
                               placeholder="" required />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input type="password" value={form.password}
                               onChange={e => setForm({ ...form, password: e.target.value })}
                               className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                          px-3 py-2 text-white text-sm focus:outline-none
                                          focus:border-blue-500"
                               placeholder="" required />
                    </div>
                    <button type="submit" disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                       text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-400 mt-4">
                    No account?{" "}
                    <Link to="/register" className="text-blue-400 hover:text-blue-300">Register</Link>
                </p>
            </div>
        </div>
    );
}