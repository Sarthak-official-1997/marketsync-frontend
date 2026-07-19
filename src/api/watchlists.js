// src/api/watchlists.js
// Multiple named watchlists (TradingView / Groww style).
// Talks to the PLURAL backend endpoints under /api/watchlists.
// Reuses the shared axios instance (with JWT + error interceptors) from portfolio.js.

import { api } from "./portfolio";

/** GET /api/watchlists — all of the user's named lists (default first), each with items + prices. */
export const getWatchlists      = ()                       => api.get("/watchlists");

/** POST /api/watchlists — create a new named list. color is optional (hex or null). */
export const createWatchlist    = (name, color = null)     => api.post("/watchlists", { name, color });

/** PATCH /api/watchlists/{id} — rename and/or recolour. Pass only what changes; null is left unchanged. */
export const updateWatchlist    = (id, { name, color })    => api.patch(`/watchlists/${id}`, { name, color });

/** DELETE /api/watchlists/{id} — delete a list (the default list is protected server-side). */
export const deleteWatchlist    = (id)                     => api.delete(`/watchlists/${id}`);

/** POST /api/watchlists/add-stock — add one stock to several lists at once (skips lists it's already in). */
export const addStockToLists    = (stockId, watchlistIds)  => api.post("/watchlists/add-stock", { stockId, watchlistIds });

/** PATCH /api/watchlists/items/{itemId}/color — set a stock's colour grade within a list (null clears it). */
export const setItemColor       = (itemId, color)          => api.patch(`/watchlists/items/${itemId}/color`, { color });

/** GET /api/watchlists/for-stock/{stockId} — array of list ids that currently contain this stock. */
export const getListsForStock   = (stockId)                => api.get(`/watchlists/for-stock/${stockId}`);