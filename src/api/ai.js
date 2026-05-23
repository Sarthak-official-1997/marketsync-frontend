import { api } from "./portfolio";

/**
 * Upload a broker screenshot for AI analysis.
 * Returns extracted trade data for user review.
 * Does NOT create transactions — that happens separately after user confirms.
 *
 * @param {File} imageFile - The screenshot file
 * @returns {Promise<AiExtractionResponse>}
 */
export const extractTradesFromImage = async (imageFile) => {
    const formData = new FormData();
    formData.append("image", imageFile);

    const response = await api.post("/ai/extract-trades", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,  // 30 second timeout — AI can take a few seconds
    });

    return response.data;
};