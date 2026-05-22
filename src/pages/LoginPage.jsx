import { useState, useEffect } from "react";
import { useNavigate, Link }   from "react-router-dom";
import { useAuth }             from "../context/AuthContext";
import { loginApi }            from "../api/portfolio";
import AppLogo from "../components/AppLogo";

const SESSION_EXPIRED_KEY = "ms_session_expired";

export default function LoginPage() {
    const [usernameOrEmail, setUsernameOrEmail] = useState("");
    const [password,        setPassword]        = useState("");
    const [rememberMe,      setRememberMe]      = useState(false);
    const [loading,         setLoading]         = useState(false);
    const [error,           setError]           = useState("");
    const [sessionExpired,  setSessionExpired]  = useState(false);

    const auth     = useAuth();
    const navigate = useNavigate();

    // Redirect if already logged in
    useEffect(() => {
        if (auth.isAuthenticated) navigate("/", { replace: true });
    }, [auth.isAuthenticated]);

    // Show session expired banner if redirected from 401/403
    useEffect(() => {
        if (sessionStorage.getItem(SESSION_EXPIRED_KEY)) {
            setSessionExpired(true);
            sessionStorage.removeItem(SESSION_EXPIRED_KEY);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!usernameOrEmail || !password) {
            setError("Please enter your username/email and password");
            return;
        }
        setLoading(true);
        setError("");

        try {
            // Backend field is "usernameOrEmail" — matches LoginRequest record
            const res = await loginApi(usernameOrEmail, password, rememberMe);
            const { token, user } = res.data;

            // AuthContext stores token in localStorage (rememberMe) or sessionStorage
            auth.login(token, user, rememberMe);
            navigate("/", { replace: true });

        } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                setError("Invalid username/email or password");
            } else {
                setError(err.userMessage || err.response?.data?.message || "Login failed — please try again");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">

                {/* Logo Section */}
                <div className="text-center mb-12">
                    <div className="flex flex-col items-center">

                        {/* Big Premium Logo */}
                        <div className="relative mb-8">
                            {/* Glow */}
                            <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full scale-125" />

                            {/* Logo */}
                            <AppLogo
                                className="relative w-40 h-40 md:w-48 md:h-48
                           rounded-[2rem]
                           border border-amber-500/30
                           shadow-[0_0_80px_rgba(251,191,36,0.25)]"
                            />
                        </div>

                        {/*/!* Main Title *!/*/}
                        {/*<h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">*/}
                        {/*    915 CLUB*/}
                        {/*</h1>*/}

                        {/* Subtitle */}
                        <p className="text-2xl md:text-3xl text-amber-300 font-bold mt-2">
                            MarketSync
                        </p>

                        {/* Description */}
                        <p className="text-slate-400 text-sm md:text-base mt-4 max-w-md leading-relaxed">
                            Professional Stock & Mutual Fund Portfolio Tracking Platform
                        </p>
                    </div>
                </div>

                {/* Session expired banner */}
                {sessionExpired && (
                    <div className="flex items-center gap-3 bg-amber-900/30 border
                                    border-amber-700/50 rounded-xl px-4 py-3 mb-4">
                        <span className="text-amber-400 text-lg flex-shrink-0">⏱</span>
                        <div>
                            <p className="text-amber-300 text-sm font-semibold">
                                Session expired
                            </p>
                            <p className="text-amber-400/80 text-xs mt-0.5">
                                Your session timed out. Please log in again to continue.
                            </p>
                        </div>
                    </div>
                )}

                {/* Card */}
                <div className="bg-slate-900 rounded-2xl border border-slate-700
                                shadow-2xl p-8">
                    <h1 className="text-xl font-bold text-white mb-6">Sign In</h1>

                    {error && (
                        <div className="bg-red-900/30 border border-red-700/50 rounded-xl
                                        px-4 py-3 mb-4 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 font-medium block mb-1.5">
                                Username or Email
                            </label>
                            <input
                                type="text"
                                value={usernameOrEmail}
                                onChange={e => setUsernameOrEmail(e.target.value)}
                                placeholder="Name or Email-ID"
                                autoFocus
                                autoComplete="username"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl
                                           px-4 py-3 text-white text-sm focus:outline-none
                                           focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 font-medium block mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl
                                           px-4 py-3 text-white text-sm focus:outline-none
                                           focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Remember Me checkbox */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800
                                               accent-blue-500 cursor-pointer"
                                />
                                <span className="text-sm text-slate-400 group-hover:text-slate-300
                                                 transition-colors select-none">
                                    Remember me for 30 days
                                </span>
                            </label>
                            {/*<span className="text-xs text-slate-600">Admin only</span>*/}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                       text-white font-bold rounded-xl transition-colors text-sm
                                       disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30
                                                     border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : "Sign In"}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-sm mt-5">
                        Don't have an account?{" "}
                        <Link to="/register"
                              className="text-blue-400 hover:text-blue-300 font-medium
                                         hover:underline transition-colors">
                            Register
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}