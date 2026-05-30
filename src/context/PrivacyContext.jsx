import { createContext, useContext, useState, useCallback } from "react";

const PrivacyContext = createContext(null);
const STORAGE_KEY = "ms_privacy_hidden";

export function PrivacyProvider({ children }) {
    const [hidden, setHidden] = useState(
        () => localStorage.getItem(STORAGE_KEY) === "true"
    );
    const toggle = useCallback(() => {
        setHidden(prev => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    }, []);
    return (
        <PrivacyContext.Provider value={{ hidden, toggle }}>
            {children}
        </PrivacyContext.Provider>
    );
}

export function usePrivacy() {
    const ctx = useContext(PrivacyContext);
    if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
    return ctx;
}