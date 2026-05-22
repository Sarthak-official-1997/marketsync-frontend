import { createContext, useContext, useState, useEffect } from "react";

export const THEMES = [
    // ── Dark themes ────────────────────────────────────────────────────────────
    {
        id:      "midnight-slate",
        name:    "Midnight Slate",
        type:    "dark",
        emoji:   "🌑",
        desc:    "Default — dark navy-grey",
        preview: ["#020617", "#0f172a", "#1e293b", "#2563eb"],
    },
    {
        id:      "catppuccin-mocha",
        name:    "Catppuccin Mocha",
        type:    "dark",
        emoji:   "🐱",
        desc:    "Soft pastel dark — very popular",
        preview: ["#1e1e2e", "#181825", "#313244", "#cba6f7"],
    },
    {
        id:      "dracula",
        name:    "Dracula",
        type:    "dark",
        emoji:   "🧛",
        desc:    "Classic dark purple",
        preview: ["#282a36", "#1e1f29", "#44475a", "#bd93f9"],
    },
    {
        id:      "nord",
        name:    "Nord",
        type:    "dark",
        emoji:   "🧊",
        desc:    "Arctic blue-grey",
        preview: ["#2e3440", "#242933", "#3b4252", "#88c0d0"],
    },
    {
        id:      "tokyo-night",
        name:    "Tokyo Night",
        type:    "dark",
        emoji:   "🗼",
        desc:    "Deep navy inspired by Tokyo",
        preview: ["#1a1b26", "#16161e", "#24283b", "#7aa2f7"],
    },
    {
        id:      "rose-pine",
        name:    "Rosé Pine",
        type:    "dark",
        emoji:   "🌿",
        desc:    "Elegant muted botanical",
        preview: ["#191724", "#1f1d2e", "#26233a", "#c4a7e7"],
    },
    {
        id:      "gruvbox",
        name:    "Gruvbox",
        type:    "dark",
        emoji:   "🪵",
        desc:    "Warm retro earth tones",
        preview: ["#282828", "#1d2021", "#3c3836", "#fabd2f"],
    },
    {
        id:      "deep-ocean",
        name:    "Deep Ocean",
        type:    "dark",
        emoji:   "🌊",
        desc:    "Navy blue with cyan",
        preview: ["#010c1e", "#041628", "#0a2240", "#06b6d4"],
    },
    {
        id:      "onyx-rose",
        name:    "Onyx Rose",
        type:    "dark",
        emoji:   "🌹",
        desc:    "Dark charcoal with rose",
        preview: ["#100a0c", "#1c1116", "#2c1822", "#f43f5e"],
    },
    // ── Light themes ───────────────────────────────────────────────────────────
    {
        id:      "daylight",
        name:    "Daylight",
        type:    "light",
        emoji:   "☀️",
        desc:    "Clean white with blue",
        preview: ["#f8fafc", "#f1f5f9", "#ffffff", "#2563eb"],
    },
    {
        id:      "catppuccin-latte",
        name:    "Catppuccin Latte",
        type:    "light",
        emoji:   "☕",
        desc:    "Soft pastel light",
        preview: ["#eff1f5", "#e6e9ef", "#ccd0da", "#8839ef"],
    },
    {
        id:      "golden-hour",
        name:    "Golden Hour",
        type:    "light",
        emoji:   "🌅",
        desc:    "Warm cream with amber",
        preview: ["#faf7ef", "#f5f0e4", "#fffdf5", "#d97706"],
    },
    {
        id:      "arctic-ice",
        name:    "Arctic Ice",
        type:    "light",
        emoji:   "❄️",
        desc:    "Cool blue-white with indigo",
        preview: ["#eff6ff", "#dbeafe", "#ffffff", "#4f46e5"],
    },
    {
        id:      "solarized-light",
        name:    "Solarized Light",
        type:    "light",
        emoji:   "🌻",
        desc:    "Precision cream tones",
        preview: ["#fdf6e3", "#eee8d5", "#e8dcc8", "#268bd2"],
    },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const [themeId, setThemeId] = useState(() =>
        localStorage.getItem("ms_theme") || "midnight-slate"
    );

    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", themeId);
        localStorage.setItem("ms_theme", themeId);
    }, [themeId]);

    return (
        <ThemeContext.Provider value={{ theme, themeId, setThemeId, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}