// src/api/clientTracker.js
// Creator-only client-tracking tool. All endpoints require CREATOR role
// (enforced backend-side via SecurityConfig + @PreAuthorize).

import { api } from "./portfolio";

export const listTrackedClients   = ()               => api.get("/client-tracker");
export const getCrossClientExposure = ()             => api.get("/client-tracker/exposure");
export const getAllPortfoliosSummary = ()            => api.get("/client-tracker/summary");
export const updateTrackedClientScope = (id, scope)  => api.patch(`/client-tracker/${id}/scope`, { scope });
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
// Read-only — shows which rows will/won't resolve before anything is
// actually saved. Same row shape as confirm.
export const checkExcelHoldings = (id, rows) =>
    api.post(`/client-tracker/${id}/holdings/import-excel/check`, rows);

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

// The explicit, confirmed sync action ("Pull") — confirmed must be true or the backend rejects it
export const syncTrackedHolding = (id, stockId, confirmed) =>
    api.post(`/client-tracker/${id}/holdings/${stockId}/sync`, { confirmed });

// View the mapped client's REAL transactions for one stock
export const getRealTransactions = (id, stockId) =>
    api.get(`/client-tracker/${id}/holdings/${stockId}/transactions`);

// Push staging area — nothing here touches the real account until Push commits it.
// Every holding automatically gets an initial staged entry the moment it's
// added AND the client is mapped (or retroactively, the moment mapping
// happens) — so there's always something real to review and push, without
// re-entering the same quantity/price a second time.
export const getStagedEdits   = (id)          => api.get(`/client-tracker/${id}/staged-edits`);
export const stageEdit        = (id, payload) => api.post(`/client-tracker/${id}/staged-edits`, payload);
export const removeStagedEdit = (id, stagedEditId) =>
    api.delete(`/client-tracker/${id}/staged-edits/${stagedEditId}`);

// Push — review, then commit. stockId omitted = "Push All"; provided = just that one stock.
// This is the ONLY real push mechanism — always goes through PushReviewModal
// first (getPushReview), never a blind direct commit.
export const getPushReview = (id, stockId) =>
    api.get(`/client-tracker/${id}/push/review`, { params: stockId ? { stockId } : {} });
export const executePush   = (id, stockId) =>
    api.post(`/client-tracker/${id}/push`, null, { params: stockId ? { stockId } : {} });