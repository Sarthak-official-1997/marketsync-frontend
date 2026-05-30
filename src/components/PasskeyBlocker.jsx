import { useState, useEffect } from "react";
import { getPasskeyStatus } from "../api/user";
import PasskeySetupModal from "./PasskeySetupModal";
import { useAuth } from "../context/AuthContext";

export default function PasskeyBlocker({ children }) {
    const { user } = useAuth();
    const [checked,        setChecked]        = useState(false);
    const [needsPasskey,   setNeedsPasskey]   = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(false);

    useEffect(() => {
        if (!user) { setChecked(true); return; }

        getPasskeyStatus()
            .then(res => {
                if (!res.data.passkeySetupDone) {
                    setNeedsPasskey(true);
                }
                setChecked(true);
            })
            .catch(() => setChecked(true));
    }, [user]);

    if (!checked) return null;

    if (!needsPasskey) return children;

    // -- CLIENT: hard block — blurred app, cannot dismiss ------------------
    if (user?.role === "CLIENT") {
        return (
            <>
                <div className="pointer-events-none select-none"
                     style={{ filter: "blur(4px)", opacity: 0.3 }}>
                    {children}
                </div>
                <PasskeySetupModal
                    isBlocking={true}
                    onDone={() => setNeedsPasskey(false)}
                />
            </>
        );
    }

    // -- CREATOR / ADMIN: sticky banner — no dismiss, app still usable ----─
    return (
        <>
            {/* Persistent banner — no close button, no dismiss */}
            <div className="fixed top-0 left-0 right-0 z-[80]
                            bg-amber-600 border-b border-amber-500
                            shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-3
                                flex items-center gap-4">
                    <span className="text-xl flex-shrink-0">🔑</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-900 font-bold text-sm">
                            Passkey not set up
                        </p>
                        <p className="text-slate-800 text-xs mt-0.5">
                            Without a passkey you cannot recover your password
                            if you forget it — and you'll have to ask Sarthak
                            every time. Takes 30 seconds to set up.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowSetupModal(true)}
                        className="flex-shrink-0 px-5 py-2 bg-slate-900
                                   hover:bg-slate-800 text-amber-400 text-sm
                                   font-bold rounded-xl transition-colors
                                   whitespace-nowrap">
                        Set Up Now →
                    </button>
                </div>
            </div>

            {/* Push content down so banner doesn't overlap */}
            <div className="pt-14">
                {children}
            </div>

            {showSetupModal && (
                <PasskeySetupModal
                    isBlocking={false}
                    onClose={() => setShowSetupModal(false)}
                    onDone={() => {
                        setShowSetupModal(false);
                        setNeedsPasskey(false);
                    }}
                />
            )}
        </>
    );
}