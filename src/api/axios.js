import axios from "axios";

// Base instance — all requests go to /api (proxied to Spring Boot)
const api = axios.create({
    baseURL: "/api",
    headers: { "Content-Type": "application/json" },
});

// Interceptor: automatically add JWT to every request
// So you never write "Authorization: Bearer ..." manually
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor: if 401 comes back, token expired — redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;