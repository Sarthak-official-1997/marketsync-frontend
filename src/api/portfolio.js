import api from "./axios";
// Global response interceptor — converts HTTP errors to readable messages
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status  = error.response?.status;
        const code    = error.response?.data?.error;
        const message = error.response?.data?.message;

        // Don't show toast for auth errors — login page handles those
        if (status === 401) return Promise.reject(error);

        // Map backend error codes to user-friendly messages
        const userMessage = getUserFriendlyMessage(status, code, message);
        error.userMessage = userMessage;

        return Promise.reject(error);
    }
);

function getUserFriendlyMessage(status, code, backendMessage) {
    if (status === 504 || code === "UPSTREAM_TIMEOUT") {
        return "Data source is slow — please try again";
    }
    if (status === 502 || code === "MF_API_ERROR") {
        return "Could not reach mfapi.in — please retry";
    }
    if (code === "MARKET_DATA_ERROR") {
        return "Could not fetch live price — showing last known value";
    }
    if (status === 404) return backendMessage || "Not found";
    if (status === 400) return backendMessage || "Invalid request";
    if (status === 409) return backendMessage || "Already exists";
    if (status === 403) return "You don't have permission for this";
    if (status >= 500)  return "Server error — please try again";
    return backendMessage || "Something went wrong";
}

export const getSummary          = ()           => api.get("/portfolio/summary");
export const getHoldings         = ()           => api.get("/holdings");
export const getTransactions     = (page = 0, size = 15) =>
    api.get(`/transactions?page=${page}&size=${size}`);
export const createTransaction   = (data)       => api.post("/transactions", data);
export const deleteTransaction   = (id)         => api.delete(`/transactions/${id}`);
export const getWatchlist        = ()           => api.get("/watchlist");
export const addToWatchlist      = (data)       => api.post("/watchlist/items", data);
export const removeFromWatchlist = (id)         => api.delete(`/watchlist/items/${id}`);
export const searchStocks        = (q, page = 0) =>
    api.get(`/stocks/search?q=${q}&page=${page}&size=10`);
export const getStockPrice       = (symbol)     => api.get(`/stocks/${symbol}/price`);

// Add these to src/api/portfolio.js

export const getMfHoldings        = () => api.get("/mf/holdings");
export const getMfPortfolioSummary = () => api.get("/mf/portfolio/summary");
export const getMfTransactions    = (page = 0) =>
    api.get(`/mf/transactions?page=${page}&size=20`);
export const addMfTransaction     = (data) => api.post("/mf/transactions", data);
export const deleteMfTransaction  = (id) => api.delete(`/mf/transactions/${id}`);
export const searchMfSchemes      = (q, page = 0) =>
    api.get(`/mf/schemes/search?q=${encodeURIComponent(q)}&page=${page}&size=20`);
export const getMfScheme          = (schemeCode) =>
    api.get(`/mf/schemes/${schemeCode}`);
export const getMfNavHistory = (schemeCode, range = "1Y") =>
    api.get(`/mf/schemes/${schemeCode}/nav-history?range=${range}`);
export const getMfNavOnDate = (schemeCode, date) =>
    api.get(`/mf/schemes/${schemeCode}/nav-on-date?date=${date}`);
export const getMfWatchlist      = () => api.get("/mf/watchlist");
export const addToMfWatchlist    = (data) => api.post("/mf/watchlist", data);
export const removeFromMfWatchlist = (id) => api.delete(`/mf/watchlist/${id}`);
// Fix double /api bug:
export const getStockReturns = (symbol, exchange) =>
    api.get(`/market-data/returns/${symbol}?exchange=${exchange}`);

// Add if not already there:
export const getStockHistory = (symbol, exchange, range = "1M") =>
    api.get(`/market-data/history/${symbol}?exchange=${exchange}&range=${range}`);
export const getStockChart = (symbol, exchange, interval, range) =>
    api.get(`/market-data/chart/${symbol}?exchange=${exchange}&interval=${interval}&range=${range}`);
export const getIndices = () => api.get("/market-data/indices");