import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "ms_token";
const USER_KEY  = "ms_user";

const readToken = () =>
    localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

const readUser = () => {
    try {
        const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
};

export function AuthProvider({ children }) {
    const [token, setToken] = useState(readToken);
    const [user,  setUser]  = useState(readUser);

    useEffect(() => {
        const sync = () => { setToken(readToken()); setUser(readUser()); };
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    const login = (newToken, userInfo, rememberMe = false) => {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEY, newToken);
        storage.setItem(USER_KEY, JSON.stringify(userInfo));
        setToken(newToken);
        setUser(userInfo);
    };

    const logout = () => {
        clearAuth();
        setToken(null);
        setUser(null);
    };

    const isAuthenticated = !!token;
    const isAdmin         = user?.role === "ADMIN"   || user?.role === "CREATOR";
    const isCreator       = user?.role === "CREATOR";

    return (
        <AuthContext.Provider value={{
            token, user, isAuthenticated,
            isAdmin,    // true for both ADMIN and CREATOR — can see admin portal
            isCreator,  // true only for CREATOR — can manage users
            login, logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
};