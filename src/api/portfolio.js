import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const TOKEN_KEY           = "ms_token";
const SESSION_EXPIRED_KEY = "ms_session_expired";

// ── Read token from either storage ───────────────────────────────────
const getToken              = ()                    => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

// ── Axios instance ────────────────────────────────────────────────────
export const api = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
});

// ── Request interceptor — attach JWT ─────────────────────────────────
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response interceptor — handle errors ─────────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status  = error.response?.status;
        const code    = error.response?.data?.error;
        const message = error.response?.data?.message;

        // 401 = token expired, 403 = token invalid
        // Both mean: clear session and force re-login
        if (status === 401 || status === 403) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem("ms_user");
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem("ms_user");

            // Flag for LoginPage to show "Session expired" banner
            sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");

            // Hard redirect — can't use React Router from axios interceptor
            if (!window.location.pathname.includes("/login")) {
                window.location.href = "/login";
            }
            return Promise.reject(error);
        }

        // Attach user-friendly message for other errors
        error.userMessage = getUserFriendlyMessage(status, code, message);
        return Promise.reject(error);
    }
);

function getUserFriendlyMessage(status, code, backendMessage) {
    if (status === 504 || code === "UPSTREAM_TIMEOUT") return "Data source is slow — please try again";
    if (status === 502 || code === "MF_API_ERROR")     return "Could not reach mfapi.in — please retry";
    if (code === "MARKET_DATA_ERROR")  return "Could not fetch live price — showing last known value";
    if (status === 404) return backendMessage || "Not found";
    if (status === 400) return backendMessage || "Invalid request";
    if (status === 409) return backendMessage || "Already exists";
    if (status >= 500)  return "Server error — please try again";
    return backendMessage || "Something went wrong";
}

// ====================================================================
// AUTH
// ====================================================================

/**
 * Login. Backend field is "usernameOrEmail" (not "username").
 * Pass rememberMe=true for 30-day token.
 */
export const loginApi                               = (usernameOrEmail, password, rememberMe = false)   => api.post("/auth/login", { usernameOrEmail, password, rememberMe });

export const registerApi                            = (data)                                                    => api.post("/auth/register", data);

// ====================================================================
// STOCKS
// ====================================================================
export const resolveStock                           = (data)                                                    => api.post("/stocks/resolve", data);
export const searchStocks                           = (q, page = 0, size = 20)                  => api.get(`/stocks/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`);
export const getStockPrice                          = (symbol)                                                  => api.get(`/stocks/${symbol}/price`);
export const getStockReturns                        = (symbol, exchange)                                        => api.get(`/market-data/returns/${symbol}?exchange=${exchange}`);
export const getStockChart                          = (symbol, exchange, interval, range)                       => api.get(`/market-data/chart/${symbol}?exchange=${exchange}&interval=${interval}&range=${range}`);
export const getIndices                             = ()                                                        => api.get("/market-data/indices");
export const getIndexConstituents                   = (symbol)                                                  => api.get(`/market-data/index-constituents/${encodeURIComponent(symbol)}`);
export const getIndexChart                          = (symbol, interval = "5m", range = "1d")       => api.get(`/market-data/index-chart/${encodeURIComponent(symbol)}`, { params: { interval, range } });

// ====================================================================
// HOLDINGS
// ====================================================================
export const getHoldings                            = ()                                        => api.get("/holdings");
export const getMfHoldings                          = ()                                        => api.get("/mf/holdings");

// ====================================================================
// TRANSACTIONS
// ====================================================================
export const getTransactions                        = (page = 0, size = 50)     => api.get(`/transactions?page=${page}&size=${size}`);
export const addTransaction                         = (data)                                    => api.post("/transactions", data);
export const deleteTransaction                      = (id)                                      => api.delete(`/transactions/${id}`);
export const bulkDeleteTransactions                 = (ids)                                     => api.delete("/transactions/bulk", { data: ids });

// ====================================================================
// WATCHLIST
// ====================================================================
export const getWatchlist                           = ()                => api.get("/watchlist");
export const addToWatchlist                         = (data)            => api.post("/watchlist/items", data);
export const removeFromWatchlist                    = (id)              => api.delete(`/watchlist/items/${id}`);
export const getWatchlistPrices                     = ()                => api.get("/watchlist/prices");

// ====================================================================
// PORTFOLIO
// ====================================================================
export const getPortfolioSummary                    = ()                => api.get("/portfolio/summary");
export const getMfPortfolioSummary                  = ()                => api.get("/mf/portfolio/summary");

// ====================================================================
// MUTUAL FUNDS
// ====================================================================
export const searchMfSchemes                        = (q, page = 0, size = 20)       => api.get(`/mf/schemes/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`);
export const getMfScheme                            = (code)                                        => api.get(`/mf/schemes/${code}`);
export const getMfNavHistory                        = (code, range = "1Y")                    => api.get(`/mf/schemes/${code}/nav-history?range=${range}`);
export const getMfNavOnDate                         = (code, date)                                  => api.get(`/mf/schemes/${code}/nav-on-date?date=${date}`);
export const getMfTransactions                      = (page = 0, size = 50)         => api.get(`/mf/transactions?page=${page}&size=${size}`);
export const addMfTransaction                       = (data)                                        => api.post("/mf/transactions", data);
export const deleteMfTransaction                    = (id)                                          => api.delete(`/mf/transactions/${id}`);



export const getMfWatchlist                         = ()        => api.get("/mf/watchlist");
export const addToMfWatchlist                       = (data)    => api.post("/mf/watchlist", data);
export const removeFromMfWatchlist                  = (id)      => api.delete(`/mf/watchlist/${id}`);

export const getPortfolioHistory                    = (range = "3mo")                         => api.get("/api/holdings/history", { params: { range } }).then(r => r.data);

// ── Price Alerts ──────────────────────────────────────────────────────────────
export const getAlerts                              = ()          => api.get("/alerts");
export const createAlert                            = (data)      => api.post("/alerts", data);
export const toggleAlert                            = (id)        => api.patch(`/alerts/${id}/toggle`);
export const deleteAlert                            = (id)        => api.delete(`/alerts/${id}`);