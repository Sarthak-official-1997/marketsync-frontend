import { useState, useEffect } from "react";
import { useNavigate, Link }   from "react-router-dom";
import { useAuth }             from "../context/AuthContext";
import { loginApi }            from "../api/portfolio";
import { forgotPasswordWithPasskey } from "../api/user";
import AppLogo from "../components/AppLogo";
import FolyoBrand from "../components/FolyoBrand";
import ContactAdminModal from "../components/ContactAdminModal";

const SESSION_EXPIRED_KEY = "ms_session_expired";
const PASSKEY_REGEX = /^[0-9]{10}[a-z]{5}[0-9]{4}[a-z]{1}$/;


function ForgotPasswordPanel({ onCancel, onContactAdmin }) {
    const [mode,        setMode]        = useState("choose");
    // modes: "choose" | "passkey" | "contact" | "done"
    const [username,    setUsername]    = useState("");
    const [passkey,     setPasskey]     = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm,     setConfirm]     = useState("");
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState("");

    const handleReset = async () => {
        if (!username.trim()) {
            setError("Enter your username or email"); return;
        }
        if (!PASSKEY_REGEX.test(passkey)) {
            setError("Passkey format is incorrect (20 characters: 10digits+5alpha+4digits+1alpha)"); return;
        }
        if (newPassword.length < 6) {
            setError("New password must be at least 6 characters"); return;
        }
        if (newPassword !== confirm) {
            setError("Passwords do not match"); return;
        }
        setLoading(true);
        setError("");
        try {
            await forgotPasswordWithPasskey(username, passkey, newPassword);
            setMode("done");
        } catch (err) {
            setError(err.response?.data?.message || "Reset failed. Check your passkey.");
        } finally {
            setLoading(false);
        }
    };

    // -- Choose mode ------------------------------------------------------─
    if (mode === "choose") {
        return (
            <div className="mt-3 bg-slate-800 border border-slate-700
                            rounded-xl p-4 text-left space-y-3">
                <p className="text-slate-300 text-sm font-semibold">
                    🔒 How would you like to reset?
                </p>
                <button
                    onClick={() => setMode("passkey")}
                    className="w-full flex items-center gap-3 bg-slate-700
                               hover:bg-slate-600 rounded-xl px-4 py-3
                               text-left transition-colors">
                    <span className="text-2xl">🔑</span>
                    <div>
                        <p className="text-white text-sm font-semibold">
                            Use my Passkey
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Reset instantly using your 20-character passkey
                        </p>
                    </div>
                </button>
                <button
                    onClick={() => setMode("contact")}
                    className="w-full flex items-center gap-3 bg-slate-700
                               hover:bg-slate-600 rounded-xl px-4 py-3
                               text-left transition-colors">
                    <span className="text-2xl">📧</span>
                    <div>
                        <p className="text-white text-sm font-semibold">
                            I forgot my passkey too
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Contact administrator for manual reset
                        </p>
                    </div>
                </button>
            </div>
        );
    }

    // -- Passkey reset form ------------------------------------------------
    if (mode === "passkey") {
        return (
            <div className="mt-3 bg-slate-800 border border-slate-700
                            rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-slate-300 text-sm font-semibold">
                        🔑 Reset with Passkey
                    </p>
                    <button onClick={() => setMode("choose")}
                            className="text-slate-500 hover:text-white text-xs">
                        ← Back
                    </button>
                </div>

                {/* Username */}
                <div>
                    <label className="text-xs text-slate-400 block mb-1">
                        Username or Email
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Your username or email"
                        className="w-full bg-slate-700 border border-slate-600
                                   rounded-lg px-3 py-2 text-white text-sm
                                   focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Passkey */}
                <div>
                    <label className="text-xs text-slate-400 block mb-1">
                        Your Passkey
                        <span className="text-slate-600 ml-1">
                            (10digits+5alpha+4digits+1alpha)
                        </span>
                    </label>
                    <input
                        type="text"
                        value={passkey}
                        onChange={e => setPasskey(
                            e.target.value.toLowerCase()
                                .replace(/[^a-z0-9]/g, "").slice(0, 20)
                        )}
                        placeholder="e.g. 9876543210abcde7890m"
                        className="w-full bg-slate-700 border border-slate-600
                                   rounded-lg px-3 py-2 text-white text-sm
                                   font-mono tracking-widest focus:outline-none
                                   focus:border-blue-500"
                    />
                    {passkey.length > 0 && (
                        <p className={`text-xs mt-1 ${
                            PASSKEY_REGEX.test(passkey)
                                ? "text-green-400" : "text-slate-500"
                        }`}>
                            {passkey.length}/20
                            {PASSKEY_REGEX.test(passkey) ? " ✓ Valid format" : ""}
                        </p>
                    )}
                </div>

                {/* New password */}
                <div>
                    <label className="text-xs text-slate-400 block mb-1">
                        New Password
                    </label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-slate-700 border border-slate-600
                                   rounded-lg px-3 py-2 text-white text-sm
                                   focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Confirm */}
                <div>
                    <label className="text-xs text-slate-400 block mb-1">
                        Confirm New Password
                    </label>
                    <input
                        type="password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Re-enter new password"
                        className={`w-full bg-slate-700 border rounded-lg px-3
                                   py-2 text-white text-sm focus:outline-none
                                   ${confirm.length > 0
                            ? newPassword === confirm
                                ? "border-green-500"
                                : "border-red-500"
                            : "border-slate-600 focus:border-blue-500"}`}
                    />
                </div>

                {error && (
                    <p className="text-red-400 text-xs">{error}</p>
                )}

                <button
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700
                               disabled:opacity-40 disabled:cursor-not-allowed
                               text-white font-bold rounded-xl text-sm
                               transition-colors">
                    {loading ? "Resetting…" : "Reset Password"}
                </button>
            </div>
        );
    }

    // -- Contact admin ----------------------------------------------------─
    if (mode === "contact") {
        return (
            <div className="mt-3 bg-slate-800 border border-slate-700
                            rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-slate-300 text-sm font-semibold">
                        📧 Contact Administrator
                    </p>
                    <button onClick={() => setMode("choose")}
                            className="text-slate-500 hover:text-white text-xs">
                        ← Back
                    </button>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                    Both your password and passkey will be reset by the administrator.
                    Contact{" "}
                    <span className="text-amber-400 font-semibold">
                        915 CLUB Support
                    </span>{" "}
                    — you'll receive a temporary password and be prompted to set
                    a new passkey on next login.
                </p>
                <button
                    onClick={onContactAdmin}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold
                            bg-blue-600 hover:bg-blue-700 text-white
                            px-4 py-2.5 rounded-xl transition-colors">
                    ✉️ Message Sarthak directly
                </button>
            </div>
        );
    }

    // -- Done --------------------------------------------------------------
    if (mode === "done") {
        return (
            <div className="mt-3 bg-green-900/30 border border-green-700/50
                            rounded-xl p-4 text-center space-y-2">
                <p className="text-3xl">✅</p>
                <p className="text-green-300 font-semibold text-sm">
                    Password reset successfully!
                </p>
                <p className="text-slate-400 text-xs">
                    You can now sign in with your new password.
                </p>
                <button
                    onClick={onCancel}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300
                               underline transition-colors">
                    Back to Sign In
                </button>
            </div>
        );
    }
}

export default function LoginPage() {
    const [usernameOrEmail, setUsernameOrEmail] = useState("");
    const [password,        setPassword]        = useState("");
    const [showPassword,    setShowPassword]    = useState(false);
    const [rememberMe,      setRememberMe]      = useState(false);
    const [loading,         setLoading]         = useState(false);
    const [error,           setError]           = useState("");
    const [sessionExpired,  setSessionExpired]  = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [showContact, setShowContact] = useState(false);

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
        <>
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">

                    {/* Logo Section */}
                    <div className="text-center mb-12">
                        <div className="flex flex-col items-center">

                            {/* Big Premium Logo */}
                            <div className="relative mb-8">
                                {/* Glow */}
                                <div className="absolute inset-0 bg-amber-500/10 blur-2xl rounded-full scale-110" />

                                {/* Logo */}
                                <AppLogo
                                    className="relative w-24 h-24 md:w-28 md:h-28
                                      rounded-2xl
                                      border border-amber-500/30
                                      shadow-[0_0_60px_rgba(251,191,36,0.2)]"
                                />
                            </div>

                            {/*/!* Main Title *!/*/}
                            {/*<h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">*/}
                            {/*    915 CLUB*/}
                            {/*</h1>*/}

                            {/* FOLYO wordmark with 915 superscript */}
                            <div className="mt-4">
                                <FolyoBrand size="xl" showTagline={true} />
                            </div>
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
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl
                                               px-4 py-3 pr-11 text-white text-sm focus:outline-none
                                               focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        tabIndex={-1}
                                        title={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-0 top-0 bottom-0 w-11 flex items-center
                                               justify-center text-slate-500 hover:text-slate-300
                                               transition-colors">
                                        {showPassword ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                                 stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                                            </svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                                 stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>
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

                        {/* Forgot password */}
                        <div className="mt-4 pt-4 border-t border-slate-800 text-center">
                            <button
                                onClick={() => setShowForgot(true)}
                                className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                                Forgot your password?
                            </button>
                        </div>
                    </div>
                </div>
                {/* -- Forgot Password — full-screen overlay (PWA-friendly) -- */}
                {showForgot && (
                    <div
                        className="fixed inset-0 z-[300] flex flex-col items-center
                           justify-end sm:justify-center px-4 pb-0 sm:pb-4"
                        style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
                        onClick={() => setShowForgot(false)}
                    >
                        <div
                            className="w-full max-w-md bg-slate-900 border border-slate-700
                               rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Drag handle — mobile PWA feel */}
                            <div className="flex justify-center pt-3 pb-1 sm:hidden">
                                <div className="w-10 h-1 bg-slate-600 rounded-full" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4
                                    border-b border-slate-700/60">
                                <h2 className="text-white font-bold text-base">
                                    🔒 Reset Password
                                </h2>
                                <button
                                    onClick={() => setShowForgot(false)}
                                    className="w-8 h-8 flex items-center justify-center
                                       text-slate-400 hover:text-white
                                       hover:bg-slate-700 rounded-lg transition-colors text-lg">
                                    ✕
                                </button>
                            </div>

                            {/* Content */}
                            <div className="px-5 py-4 overflow-y-auto"
                                 style={{ maxHeight: "80vh" }}>
                                <ForgotPasswordPanel
                                    onCancel={() => setShowForgot(false)}
                                    onContactAdmin={() => { setShowForgot(false); setShowContact(true); }}
                                />
                            </div>

                            {/* Footer motto */}
                            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40">
                                <p className="text-slate-600 text-xs text-center italic">
                                    Portfolio tracking, the way it should be.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {showContact && (
                <ContactAdminModal
                    source="LOGIN_PAGE"
                    onClose={() => setShowContact(false)}
                />
            )}
        </>
    );
}