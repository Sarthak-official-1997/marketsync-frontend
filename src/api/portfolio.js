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