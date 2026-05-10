import api from "./axios";

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