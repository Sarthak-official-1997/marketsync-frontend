import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUsers, changeUserRole, blockUser, unblockUser, deleteUser, resetUserPassword, createUser } from "../api/admin";
import { resetUserPasskey } from "../api/admin";


const fmtDate = (d) => {
    if (!d) return "—";
    try { const [y,m,day] = d.toString().split("T")[0].split("-"); return `${day}/${m}/${y}`; }
    catch { return "—"; }
};

const ROLE_STYLES = {
    CLIENT:  "bg-blue-900/30 text-blue-400 border-blue-500/30",
    ADMIN:   "bg-purple-900/30 text-purple-400 border-purple-500/30",
    CREATOR: "bg-amber-900/30 text-amber-400 border-amber-500/30",
};

function ConfirmModal({ message, onConfirm, onCancel, danger = false }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50
                        flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl
                            p-6 w-full max-w-sm shadow-2xl">
                <p className="text-white font-semibold mb-2">Are you sure?</p>
                <p className="text-slate-400 text-sm mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white
                                       bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors
                                       text-white ${danger
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-blue-600 hover:bg-blue-700"}`}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

function genPassword() {
    // Readable temp password: no ambiguous chars, easy to dictate over a call.
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
}

function CreateUserModal({ onClose, onCreated }) {
    const [form, setForm] = useState({
        fullName: "", username: "", password: genPassword(), email: "", role: "CLIENT",
    });
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState("");
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async () => {
        setError("");
        if (form.username.trim().length < 3) { setError("Username must be at least 3 characters."); return; }
        if (form.password.length < 8)        { setError("Password must be at least 8 characters."); return; }
        setBusy(true);
        try {
            const created = await createUser({
                username: form.username.trim(),
                password: form.password,
                fullName: form.fullName.trim() || null,
                email:    form.email.trim() || null,
                role:     form.role,
            });
            // Hand the plaintext password back up so the creator can copy/share it;
            // the server never returns it, so we surface what was just set.
            onCreated({ ...created, sharedPassword: form.password });
        } catch (e) {
            setError(e?.response?.data?.message || e?.response?.data?.error || "Could not create account.");
        } finally {
            setBusy(false);
        }
    };

    const field = "w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-xl " +
        "px-3 py-2.5 focus:outline-none focus:border-blue-500 placeholder:text-slate-600";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl
                            max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-white font-bold">Create account</p>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
                </div>
                <p className="text-slate-500 text-xs mb-4">
                    You'll share the username &amp; password with them yourself.
                </p>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 font-semibold">Full name</label>
                        <input className={field} value={form.fullName} placeholder="e.g. Ramesh Gupta"
                               onChange={e => set("fullName", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-semibold">Username <span className="text-red-400">*</span></label>
                        <input className={field} value={form.username} placeholder="login id, 3+ chars"
                               autoCapitalize="none" autoCorrect="off"
                               onChange={e => set("username", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-semibold">Password <span className="text-red-400">*</span></label>
                        <div className="flex gap-2">
                            <input className={field} value={form.password}
                                   onChange={e => set("password", e.target.value)} />
                            <button type="button" onClick={() => set("password", genPassword())}
                                    className="flex-shrink-0 px-3 rounded-xl bg-slate-700 hover:bg-slate-600
                                               text-slate-200 text-xs font-semibold">
                                New
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-semibold">Email <span className="text-slate-600">(optional)</span></label>
                        <input className={field} value={form.email} placeholder="blank = auto-generated"
                               autoCapitalize="none" autoCorrect="off"
                               onChange={e => set("email", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-semibold">Role</label>
                        <div className="flex gap-2 mt-1">
                            {["CLIENT", "ADMIN"].map(r => (
                                <button key={r} type="button" onClick={() => set("role", r)}
                                        className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors " +
                                        (form.role === r
                                            ? "bg-blue-600 text-white border-blue-500"
                                            : "bg-slate-900 text-slate-400 border-slate-700")}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}

                    <button onClick={submit} disabled={busy}
                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                       text-white text-sm font-semibold transition-colors">
                        {busy ? "Creating…" : "Create account"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUserManagementPage() {
    const [users,   setUsers]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy,    setBusy]    = useState(null);  // userId currently being acted on
    const [confirm, setConfirm] = useState(null);  // { type, userId, username }
    const [search,  setSearch]  = useState("");
    const [resetResult,     setResetResult]     = useState(null); // { username, tempPassword }
    const [passkeyResetDone,setPasskeyResetDone]= useState(null); // username
    const [showCreate,      setShowCreate]      = useState(false);
    const [createdCreds,    setCreatedCreds]    = useState(null); // { username, sharedPassword, fullName }
    const navigate = useNavigate();

    useEffect(() => {
        getAllUsers().then(setUsers).finally(() => setLoading(false));
    }, []);

    const refresh = () => getAllUsers().then(setUsers);

    const handleResetPassword = async (userId, username) => {
        setConfirm(null);
        setBusy(userId);
        try {
            const res = await resetUserPassword(userId);
            setResetResult({ username, tempPassword: res.tempPassword });
        } finally { setBusy(null); }
    };

    const handleResetPasskey = async (userId, username) => {
        setConfirm(null);
        setBusy(userId);
        try {
            await resetUserPasskey(userId);
            setPasskeyResetDone(username);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to reset passkey");
        } finally {
            setBusy(null);
        }
    };

    const handleRoleChange = async (userId, currentRole) => {
        const newRole = currentRole === "CLIENT" ? "ADMIN" : "CLIENT";
        setBusy(userId);
        try {
            const updated = await changeUserRole(userId, newRole);
            setUsers(prev => prev.map(u => u.id === userId ? updated : u));
        } finally { setBusy(null); }
    };

    const handleBlock = async (userId, currentlyBlocked) => {
        setBusy(userId);
        try {
            const updated = currentlyBlocked
                ? await unblockUser(userId)
                : await blockUser(userId);
            setUsers(prev => prev.map(u => u.id === userId ? updated : u));
        } finally { setBusy(null); }
    };

    const handleDelete = async (userId) => {
        setConfirm(null);
        setBusy(userId);
        try {
            await deleteUser(userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
        } finally { setBusy(null); }
    };

    const filtered = users.filter(u => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (u.fullName||"").toLowerCase().includes(q)
            || u.username.toLowerCase().includes(q)
            || u.email.toLowerCase().includes(q);
    });

    const adminCount  = users.filter(u => u.role === "ADMIN").length;
    const clientCount = users.filter(u => u.role === "CLIENT").length;
    const blockedCount = users.filter(u => u.blocked).length;

    // Shared so the desktop table and the mobile cards render identical actions.
    const renderActions = (u) => {
        const isBusy = busy === u.id;
        return (
            <div className="flex items-center gap-2 flex-wrap justify-end">
                <button disabled={isBusy} onClick={() => handleRoleChange(u.id, u.role)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors
                                    disabled:opacity-40 disabled:cursor-not-allowed ${u.role === "CLIENT"
                            ? "bg-purple-900/40 text-purple-400 hover:bg-purple-900/70 border border-purple-500/30"
                            : "bg-blue-900/40 text-blue-400 hover:bg-blue-900/70 border border-blue-500/30"}`}
                        title={u.role === "CLIENT" ? "Promote to Admin" : "Demote to Client"}>
                    {isBusy ? "…" : u.role === "CLIENT" ? "↑ Make Admin" : "↓ Make Client"}
                </button>
                <button disabled={isBusy}
                        onClick={() => { if (!u.blocked) { setConfirm({ type: "block", userId: u.id, username: u.username }); } else { handleBlock(u.id, true); } }}
                        className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors
                                    disabled:opacity-40 disabled:cursor-not-allowed ${u.blocked
                            ? "bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-500/30"
                            : "bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 border border-amber-500/30"}`}
                        title={u.blocked ? "Unblock user" : "Block user"}>
                    {isBusy ? "…" : u.blocked ? "✓ Unblock" : "🚫 Block"}
                </button>
                <button disabled={isBusy}
                        onClick={() => setConfirm({ type: "delete", userId: u.id, username: u.username })}
                        className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors
                                   bg-red-900/30 text-red-400 hover:bg-red-900/60 border border-red-500/30
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete account permanently">
                    🗑 Delete
                </button>
                <button disabled={isBusy}
                        onClick={() => setConfirm({ type: "resetPassword", userId: u.id, username: u.username })}
                        className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors
                                   bg-slate-700/60 text-slate-400 hover:bg-slate-700 border border-slate-600
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Generate a temporary password">
                    🔑 Reset PW
                </button>
                <button disabled={isBusy}
                        onClick={() => setConfirm({ type: "resetPasskey", userId: u.id, username: u.username })}
                        className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors
                                   bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 border border-amber-500/30
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Reset passkey — user will be forced to set a new one">
                    🔑 Reset Key
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">User Management</h1>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border
                                         border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
                            👑 CREATOR
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {adminCount} admins · {clientCount} clients · {blockedCount} blocked
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                                       text-white text-sm font-semibold rounded-xl transition-colors">
                        + Create account
                    </button>
                    <button onClick={() => navigate("/admin")}
                            className="text-sm text-slate-400 hover:text-white hover:underline">
                        ← Dashboard
                    </button>
                </div>
            </div>

            {/* Legend + search */}
            <div className="flex items-center gap-3 flex-wrap">
                {[
                    ["CLIENT", "Regular user"],
                    ["ADMIN",  "Can view all portfolios"],
                ].map(([role, desc]) => (
                    <div key={role} className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border
                                          ${ROLE_STYLES[role]}`}>
                            {role}
                        </span>
                        <span className="text-slate-500 text-xs">{desc}</span>
                    </div>
                ))}
                <div className="ml-auto">
                    <input value={search} onChange={e => setSearch(e.target.value)}
                           placeholder="Search users…"
                           className="w-52 bg-slate-800 border border-slate-700 text-slate-300
                                      text-xs rounded-xl px-3 py-2 focus:outline-none
                                      focus:border-blue-500 placeholder:text-slate-600" />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-2">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-slate-800 rounded-2xl border border-slate-700/60 p-12 text-center">
                    <p className="text-slate-400">No users found</p>
                </div>
            ) : (
                <>
                    {/* Mobile: card layout (the table cuts off Status/Actions on small screens) */}
                    <div className="md:hidden space-y-2">
                        {filtered.map(u => (
                            <div key={u.id}
                                 className={"bg-slate-800 rounded-2xl border border-slate-700/60 p-3.5 " +
                                 (u.blocked ? "opacity-60" : "")}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold text-sm truncate">
                                            {u.fullName || u.username}
                                        </p>
                                        <p className="text-slate-500 text-xs truncate">{u.email}</p>
                                        <p className="text-slate-600 text-xs truncate">@{u.username}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full border " +
                                        (ROLE_STYLES[u.role] || "")}>
                                            {u.role}
                                        </span>
                                        {u.blocked ? (
                                            <span className="text-[10px] bg-red-900/40 text-red-400 border
                                                             border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
                                                🚫 Blocked
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-green-900/20 text-green-500 border
                                                             border-green-500/20 px-2 py-0.5 rounded-full">
                                                ✓ Active
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-2">
                                    {u.holdingCount} holdings · {u.transactionCount} txns · joined {fmtDate(u.createdAt)}
                                </div>
                                <div className="mt-3 border-t border-slate-700/50 pt-3">
                                    {renderActions(u)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden md:block bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-slate-700 bg-slate-900/30 text-xs
                                       text-slate-400 uppercase tracking-wide">
                                <th className="text-left px-5 py-3">User</th>
                                <th className="text-center px-4 py-3">Role</th>
                                <th className="text-center px-4 py-3">Status</th>
                                <th className="text-right px-4 py-3 hidden md:table-cell">Holdings</th>
                                <th className="text-right px-4 py-3 hidden md:table-cell">Joined</th>
                                <th className="text-right px-5 py-3">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map(u => {
                                const isBusy = busy === u.id;
                                return (
                                    <tr key={u.id}
                                        className={"border-b border-slate-700/40 last:border-0 " +
                                        (u.blocked ? "opacity-60" : "")}>

                                        {/* User info */}
                                        <td className="px-5 py-4">
                                            <p className="text-white font-semibold text-sm">
                                                {u.fullName || u.username}
                                            </p>
                                            <p className="text-slate-500 text-xs">{u.email}</p>
                                            <p className="text-slate-600 text-xs">@{u.username}</p>
                                        </td>

                                        {/* Role badge */}
                                        <td className="text-center px-4 py-4">
                                        <span className={`text-xs font-bold px-2.5 py-1
                                                          rounded-full border ${ROLE_STYLES[u.role] || ""}`}>
                                            {u.role}
                                        </span>
                                        </td>

                                        {/* Blocked status */}
                                        <td className="text-center px-4 py-4">
                                            {u.blocked ? (
                                                <span className="text-xs bg-red-900/40 text-red-400
                                                             border border-red-500/30 px-2 py-0.5
                                                             rounded-full font-semibold">
                                                🚫 Blocked
                                            </span>
                                            ) : (
                                                <span className="text-xs bg-green-900/20 text-green-500
                                                             border border-green-500/20 px-2 py-0.5
                                                             rounded-full">
                                                ✓ Active
                                            </span>
                                            )}
                                        </td>

                                        {/* Holdings + joined */}
                                        <td className="text-right px-4 py-4 hidden md:table-cell">
                                            <p className="text-slate-300 text-xs">
                                                {u.holdingCount} holdings
                                            </p>
                                            <p className="text-slate-600 text-xs">
                                                {u.transactionCount} txns
                                            </p>
                                        </td>
                                        <td className="text-right px-4 py-4 hidden md:table-cell">
                                            <p className="text-slate-400 text-xs">
                                                {fmtDate(u.createdAt)}
                                            </p>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-4">
                                            {renderActions(u)}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Confirmation modals */}
            {confirm?.type === "block" && (
                <ConfirmModal
                    message={`Block @${confirm.username}? They will be kicked out immediately — even if they have a remember-me session.`}
                    onConfirm={() => { setConfirm(null); handleBlock(confirm.userId, false); }}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm?.type === "delete" && (
                <ConfirmModal
                    danger
                    message={`Permanently delete @${confirm.username} and ALL their data (holdings, transactions, watchlist)? This cannot be undone.`}
                    onConfirm={() => handleDelete(confirm.userId)}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {confirm?.type === "resetPassword" && (
                <ConfirmModal
                    message={`Reset @${confirm.username}'s password? A temporary password will be generated for you to share with them.`}
                    onConfirm={() => handleResetPassword(confirm.userId, confirm.username)}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {confirm?.type === "resetPasskey" && (
                <ConfirmModal
                    message={`Reset passkey for @${confirm.username}? They will be forced to set a new passkey on next login.`}
                    onConfirm={() => handleResetPasskey(confirm.userId, confirm.username)}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {/* Show generated temp password */}
            {resetResult && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50
                    flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl
                        p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">✅</span>
                            <h3 className="text-white font-bold">Password Reset</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">
                            Share this temporary password with
                            <span className="text-white font-semibold"> @{resetResult.username}</span>.
                            They should change it after logging in.
                        </p>
                        <div className="bg-slate-900 border border-slate-600 rounded-xl
                            px-4 py-3 flex items-center justify-between">
                            <code className="text-amber-400 font-bold text-lg tracking-wider">
                                {resetResult.tempPassword}
                            </code>
                            <button
                                onClick={() => navigator.clipboard.writeText(resetResult.tempPassword)}
                                className="text-xs text-slate-400 hover:text-white
                               transition-colors ml-3 flex-shrink-0">
                                📋 Copy
                            </button>
                        </div>
                        <p className="text-slate-600 text-xs mt-3">
                            ⚠️ This password is shown only once. Copy it now.
                        </p>
                        <button
                            onClick={() => setResetResult(null)}
                            className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700
                           text-white font-semibold rounded-xl text-sm transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            )}
            {passkeyResetDone && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50
                    flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl
                        p-6 w-full max-w-sm shadow-2xl text-center">
                        <p className="text-3xl mb-3">🔑</p>
                        <h3 className="text-white font-bold mb-2">Passkey Reset</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Passkey for{" "}
                            <span className="text-white font-semibold">
                    @{passkeyResetDone}
                </span>{" "}
                            has been cleared. They will be prompted to set a new passkey
                            on their next login.
                        </p>
                        <button
                            onClick={() => setPasskeyResetDone(null)}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700
                           text-white font-semibold rounded-xl text-sm
                           transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            )}
            {showCreate && (
                <CreateUserModal
                    onClose={() => setShowCreate(false)}
                    onCreated={(u) => { setShowCreate(false); setCreatedCreds(u); refresh(); }}
                />
            )}
            {createdCreds && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50
                    flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl
                        p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">✅</span>
                            <h3 className="text-white font-bold">Account created</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">
                            Share these credentials with
                            <span className="text-white font-semibold"> {createdCreds.fullName || createdCreds.username}</span> yourself.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-3
                                            flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-[10px] uppercase font-semibold">Username</p>
                                    <code className="text-white font-bold tracking-wide">{createdCreds.username}</code>
                                </div>
                                <button onClick={() => navigator.clipboard.writeText(createdCreds.username)}
                                        className="text-xs text-slate-400 hover:text-white ml-3 flex-shrink-0">📋</button>
                            </div>
                            <div className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-3
                                            flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-[10px] uppercase font-semibold">Password</p>
                                    <code className="text-amber-400 font-bold text-lg tracking-wider">
                                        {createdCreds.sharedPassword}
                                    </code>
                                </div>
                                <button onClick={() => navigator.clipboard.writeText(createdCreds.sharedPassword)}
                                        className="text-xs text-slate-400 hover:text-white ml-3 flex-shrink-0">📋</button>
                            </div>
                        </div>
                        <button
                            onClick={() => navigator.clipboard.writeText(
                                `Username: ${createdCreds.username}\nPassword: ${createdCreds.sharedPassword}`)}
                            className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200
                                       text-xs font-semibold rounded-xl transition-colors">
                            📋 Copy both
                        </button>
                        <p className="text-slate-600 text-xs mt-3">
                            ⚠️ The password is shown only once. Copy it now.
                        </p>
                        <button
                            onClick={() => setCreatedCreds(null)}
                            className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700
                           text-white font-semibold rounded-xl text-sm transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}