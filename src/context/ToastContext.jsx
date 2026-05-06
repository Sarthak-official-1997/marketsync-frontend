import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "success", duration = 3000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = (id) =>
        setToasts(prev => prev.filter(t => t.id !== id));

    const toast = {
        success: (msg) => addToast(msg, "success"),
        error:   (msg) => addToast(msg, "error"),
        info:    (msg) => addToast(msg, "info"),
        warning: (msg) => addToast(msg, "warning"),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl
                                    text-sm font-medium pointer-events-auto animate-slide-in border
                                    ${t.type === "success" ? "bg-green-900/90 text-green-100 border-green-700"
                            : t.type === "error"   ? "bg-red-900/90 text-red-100 border-red-700"
                                : t.type === "warning" ? "bg-yellow-900/90 text-yellow-100 border-yellow-700"
                                    : "bg-blue-900/90 text-blue-100 border-blue-700"}`}
                    >
                        <span>
                            {t.type === "success" ? "✅"
                                : t.type === "error"   ? "❌"
                                    : t.type === "warning" ? "⚠️" : "ℹ️"}
                        </span>
                        <span>{t.message}</span>
                        <button
                            onClick={() => removeToast(t.id)}
                            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
                        >✕</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}