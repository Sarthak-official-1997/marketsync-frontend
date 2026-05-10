import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem("theme") !== "light";
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.remove("light-mode");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.add("light-mode");
            localStorage.setItem("theme", "light");
        }
    }, [isDark]);

    const toggle = () => setIsDark(prev => !prev);

    return (
        <ThemeContext.Provider value={{ isDark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);