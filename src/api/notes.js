// src/api/notes.js
// Notes CRUD. Reuses the shared axios instance (JWT + interceptors) from portfolio.js.

import { api } from "./portfolio";

/** GET /api/notes — user's notes (pinned first, newest first). Optional text filter q. */
export const getNotes   = (q)         => api.get("/notes", q ? { params: { q } } : undefined);

/** POST /api/notes — { content, linkedSymbols?, remindAt?, pinned? } */
export const createNote = (payload)   => api.post("/notes", payload);

/** PATCH /api/notes/{id} — partial update; only provided fields change. */
export const updateNote = (id, patch) => api.patch(`/notes/${id}`, patch);

/** DELETE /api/notes/{id} */
export const deleteNote = (id)        => api.delete(`/notes/${id}`);