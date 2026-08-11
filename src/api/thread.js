// src/api/thread.js
// 1:1 idea/messaging thread — vertical slice, no broadcast yet.
// Creator-side calls go through /client-tracker/{id}/thread (CREATOR-only,
// same auth as everything else in api/clientTracker.js). Client-side calls
// go through /my-thread — no id in the URL at all, since the backend
// resolves "your thread" from your own account, not from anything the
// client passes.

import { api } from "./portfolio";

// ── Creator side ─────────────────────────────────────────────────────────
export const getThread          = (trackedClientId) => api.get(`/client-tracker/${trackedClientId}/thread`);
export const sendThreadText     = (trackedClientId, body) =>
    api.post(`/client-tracker/${trackedClientId}/thread/text`, { body });
export const sendThreadIdea     = (trackedClientId, idea) =>
    api.post(`/client-tracker/${trackedClientId}/thread/idea`, idea);
export const getPendingIdeas    = () => api.get("/client-tracker/thread/pending-ideas");

// ── Client side ──────────────────────────────────────────────────────────
export const getMyThread        = () => api.get("/my-thread");
export const sendMyThreadText   = (body) => api.post("/my-thread/text", { body });
export const markIdeaActed      = (ideaMessageId, dismissed, actionNote) =>
    api.post(`/my-thread/ideas/${ideaMessageId}/act`, { dismissed, actionNote });