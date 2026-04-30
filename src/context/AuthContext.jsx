import { createContext, useContext, useState, useEffect } from "react";

// 1. Create the context (like a global store)
const AuthContext = createContext(null);

// 2. The Provider wraps your whole app and makes the data available everywhere
export function AuthProvider({ children }) {
    const [token, setToken] = useState(() =>
        localStorage.getItem("token") || null
    );
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem("user");
        return saved ? JSON.parse(saved) : null;
    });

    const login = (tokenValue, userData) => {
        setToken(tokenValue);
        setUser(userData);
        localStorage.setItem("token", tokenValue);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    };

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
}

// 3. Custom hook — any component calls useAuth() to get the token
export function useAuth() {
    return useContext(AuthContext);
}