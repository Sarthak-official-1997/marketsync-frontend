import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
    headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem("ms_token") || sessionStorage.getItem("ms_token");
    const fp    = localStorage.getItem("ms_fp")    || sessionStorage.getItem("ms_fp");
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
        config.headers["X-Client-FP"]   = fp || "";
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url || "";
        const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");

        // Only auto-redirect on 401/403 for NON-auth endpoints
        // (wrong login credentials shouldn't redirect, they should show error)
        if ((error.response?.status === 401 || error.response?.status === 403) && !isAuthEndpoint) {
            localStorage.removeItem("ms_token");
            localStorage.removeItem("ms_user");
            sessionStorage.removeItem("ms_token");
            sessionStorage.removeItem("ms_user");
            if (!window.location.pathname.includes("/login")) {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;