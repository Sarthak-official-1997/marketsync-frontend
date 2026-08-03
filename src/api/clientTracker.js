// src/api/clientTracker.js
// Creator-only client-tracking tool. All endpoints require CREATOR role
// (enforced backend-side via SecurityConfig + @PreAuthorize).

import { api } from "./portfolio";

export const listTrackedClients   = ()               => api.get("/client-tracker");
export const createTrackedClient  = (displayName)     => api.post("/client-tracker", { displayName });
export const getTrackedClient     = (id)              => api.get(`/client-tracker/${id}`);
export const deleteTrackedClient  = (id)              => api.delete(`/client-tracker/${id}`);
export const mapTrackedClient     = (id, userId)      => api.post(`/client-tracker/${id}/map`, { userId });

// Manual holding entry
export const addTrackedHolding    = (id, payload)     => api.post(`/client-tracker/${id}/holdings`, payload);
export const deleteTrackedHolding = (id, stockId)     => api.delete(`/client-tracker/${id}/holdings/${stockId}`);

// Excel/CSV import — preview then confirm (same two-step pattern as the real transaction import)
export const previewExcelHoldings = (id, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/client-tracker/${id}/holdings/import-excel`, form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};
export const confirmExcelHoldings = (id, rows) =>
    api.post(`/client-tracker/${id}/holdings/import-excel/confirm`, rows);

// AI screenshot import — ALL screenshots in a batch go in ONE request, so
// Gemini sees every image together and can recognize when several
// screenshots are just the same portfolio table scrolled to show different
// columns, instead of extracting each one blind and separately.
export const previewScreenshotHoldings = (id, files) => {
    const form = new FormData();
    Array.from(files).forEach(f => form.append("files", f));
    return api.post(`/client-tracker/${id}/holdings/import-screenshot`, form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};
export const confirmScreenshotHoldings = (id, trades) =>
    api.post(`/client-tracker/${id}/holdings/import-screenshot/confirm`, trades);

// The explicit, confirmed sync action — confirmed must be true or the backend rejects it
export const syncTrackedHolding = (id, stockId, confirmed) =>
    api.post(`/client-tracker/${id}/holdings/${stockId}/sync`, { confirmed });