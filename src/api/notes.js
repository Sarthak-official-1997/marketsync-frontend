// src/api/notes.js
// Personal research notes. Matches the existing backend contract:
//   NoteDto      { id, body, stocks:[{symbol,name,exchange}], reminders:[{remindAt,fired,firedAt}], done, createdAt }
//   Create/PATCH { body, stocks:[{symbol,name,exchange}], reminders:[ISO datetime], done? }
// Reuses the shared axios instance (JWT + interceptors) from portfolio.js.

import { api } from "./portfolio";

/** GET /api/notes — all of the user's notes. */
export const getNotes         = ()            => api.get("/notes");

/** GET /api/notes/by-stock/{symbol} — notes linking a given stock. */
export const getNotesByStock  = (symbol)      => api.get(`/notes/by-stock/${symbol}`);

/** POST /api/notes — { body, stocks?, reminders? }. Only body is required. */
export const createNote       = (payload)     => api.post("/notes", payload);

/** PATCH /api/notes/{id} — { body?, stocks?, reminders?, done? }. Null fields unchanged. */
export const updateNote       = (id, patch)   => api.patch(`/notes/${id}`, patch);

/** DELETE /api/notes/{id} — returns 204. */
export const deleteNote       = (id)          => api.delete(`/notes/${id}`);