import { api } from "./portfolio";

/**
 * Upload broker files for AI analysis (images, PDF, CSV, TXT, Excel).
 * Up to 5 files. Returns extracted trade data for user review.
 * Does NOT create transactions — that happens separately after user confirms.
 *
 * @param {Array<{file: File|null, textContent: string|null}>} fileItems
 * @returns {Promise<AiExtractionResponse>}
 */
export const extractTradesFromFiles = async (fileItems) => {
    const formData = new FormData();
    fileItems.forEach(item => {
        if (item.file)        formData.append("files", item.file);
        if (item.textContent) formData.append("textContents", item.textContent);
    });
    const response = await api.post("/ai/extract-trades", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
    });
    return response.data;
};

/**
 * Upload broker files for MF AI analysis.
 *
 * @param {Array<{file: File|null, textContent: string|null}>} fileItems
 * @returns {Promise<AiMfExtractionResponse>}
 */
export const extractMfTradesFromFiles = async (fileItems) => {
    const formData = new FormData();
    fileItems.forEach(item => {
        if (item.file)        formData.append("files", item.file);
        if (item.textContent) formData.append("textContents", item.textContent);
    });
    const response = await api.post("/ai/extract-mf-trades", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
    });
    return response.data;
};

/** Legacy single-image wrapper — kept for any existing callers */
export const extractTradesFromImage = async (imageFile) =>
    extractTradesFromFiles([{ file: imageFile, textContent: null }]);

/** Legacy single-image MF wrapper */
export const extractMfTradesFromImage = async (imageFile) =>
    extractMfTradesFromFiles([{ file: imageFile, textContent: null }]);

/** Send a chat message */
export const sendChatMessage = (sessionId, message) =>
    api.post("/ai/chat", { sessionId, message });

/** Load messages for a session */
export const getChatHistory = (sessionId) =>
    api.get(`/ai/chat/history/${sessionId}`);

/** List all user's chat sessions */
export const getChatSessions = () =>
    api.get("/ai/chat/sessions");