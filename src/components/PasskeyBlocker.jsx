import { useState, useEffect, useRef } from "react";
import { getPasskeyStatus } from "../api/user";
import PasskeySetupModal from "./PasskeySetupModal";
import { useAuth } from "../context/AuthContext";

export default function PasskeyBlocker({ children }) {
    const { user, isCreator } = useAuth();
    // CREATOR is exempt on any device — Sarthak needs to freely test as
    // himself without setup nudges ever appearing. Everyone else keeps the
    // normal, per-device passkey banner behavior.
    const [checked,        setChecked]        = useState(false);
    const [needsPasskey,   setNeedsPasskey]   = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(false);

    // Measure the banner's REAL rendered height and use that as the content's
    // top padding — a hardcoded guess doesn't account for the description
    // wrapping to 2-3 lines on narrower/mobile screens, which was causing the
    // header/search bar to render partly underneath the banner.
    const bannerRef = useRef(null);
    const [bannerHeight, setBannerHeight] = useState(0);

    useEffect(() => {
        if (!user || isCreator) { setChecked(true); return; }

        getPasskeyStatus()
            .then(res => {
                if (!res.data.passkeySetupDone) {
                    setNeedsPasskey(true);
                }
                setChecked(true);
            })
            .catch(() => setChecked(true));
    }, [user, isCreator]);

    useEffect(() => {
        if (!needsPasskey || !bannerRef.current) return;
        const el = bannerRef.current;
        const measure = () => setBannerHeight(el.offsetHeight);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener("resize", measure);
        return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
    }, [needsPasskey]);

    if (!checked) return null;

    if (!needsPasskey) return children;

    // Passkey not set up yet — for CLIENT/ADMIN we show a persistent (but
    // non-blocking) top banner instead of forcing setup. The user can skip and
    // keep using the app; the banner returns on every load until the passkey
    // is set up, then disappears for good. CREATOR never sees this at all.
    return (
        <>
            {/* Persistent banner — no close button, no dismiss, EXCEPT while the
                setup modal itself is open. The modal renders at z-[70], below
                this banner's z-[80] — with the banner still visible, its top
                edge sat directly on top of the modal's own heading and
                instructions, cutting them off exactly like the screenshot
                showed. The banner's whole job is "get the user into the setup
                modal" — once they're in it, hiding it removes the stacking
                conflict entirely rather than trying to out-z-index the modal
                every place a modal like this might ever be triggered from. */}
            {!showSetupModal && (
                <div ref={bannerRef}
                     className="fixed top-0 left-0 right-0 z-[80]
                            bg-amber-600 border-b border-amber-500
                            shadow-lg">
                    <div className="max-w-4xl mx-auto px-4 py-3
                                flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
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
                        </div>
                        <button
                            onClick={() => setShowSetupModal(true)}
                            className="flex-shrink-0 w-full sm:w-auto px-5 py-2 bg-slate-900
                                   hover:bg-slate-800 text-amber-400 text-sm
                                   font-bold rounded-xl transition-colors
                                   whitespace-nowrap">
                            Set Up Now →
                        </button>
                    </div>
                </div>
            )}

            {/* Push content down by the banner's ACTUAL measured height, not a
                guessed constant — guarantees no overlap on any screen size.
                While the modal is open the banner is hidden, so this padding
                naturally has no visible effect (the modal covers everything
                as a full-screen overlay anyway) — no special-casing needed. */}
            <div style={{ paddingTop: showSetupModal ? 0 : (bannerHeight || 56) }}>
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