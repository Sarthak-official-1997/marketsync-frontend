import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { register as registerApi } from "../api/auth";

export default function RegisterPage() {
    const [form, setForm] = useState({
        username: "", email: "", password: "", fullName: ""
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        setLoading(true);
        try {
            const { data } = await registerApi(form);
            login(data.token, data.user);
            navigate("/dashboard");
        } catch (err) {
            const resp = err.response?.data;
            if (resp?.errors) {
                // Map field-level validation errors from Spring Boot
                const map = {};
                resp.errors.forEach(fe => { map[fe.field] = fe.message; });
                setErrors(map);
            } else {
                setErrors({ general: resp?.message || "Registration failed" });
            }
        } finally {
            setLoading(false);
        }
    };

    const field = (label, name, type = "text", placeholder = "") => (
        <div>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <input
                type={type}
                value={form[name]}
                onChange={set(name)}
                className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white
                            text-sm focus:outline-none focus:border-blue-500 ${
                    errors[name] ? "border-red-500" : "border-slate-600"
                }`}
                placeholder={placeholder}
                required
            />
            {errors[name] && (
                <p className="text-red-400 text-xs mt-1">{errors[name]}</p>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-8
                            border border-slate-700 shadow-2xl">
                <h1 className="text-2xl font-bold text-white mb-1">📈 MarketSync</h1>
                <p className="text-slate-400 text-sm mb-6">Create your account</p>

                {errors.general && (
                    <div className="bg-red-900/30 border border-red-500/50
                                    text-red-300 rounded-lg p-3 text-sm mb-4">
                        {errors.general}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {field("Full Name", "fullName", "text", "Sarthak Parashar")}
                    {field("Username", "username", "text", "sarthak")}
                    {field("Email", "email", "email", "sarthak@test.com")}
                    {field("Password", "password", "password", "••••••••")}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                   text-white font-medium py-2.5 rounded-lg text-sm
                                   transition-colors"
                    >
                        {loading ? "Creating account..." : "Register"}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-400 mt-4">
                    Have an account?{" "}
                    <Link to="/login" className="text-blue-400 hover:text-blue-300">
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}