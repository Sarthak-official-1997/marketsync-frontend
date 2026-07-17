// src/api/notes.js
import { api } from "./portfolio";

// Personal research notes. A note is free text + zero-to-many linked stocks
// + an optional reminder time. See NoteController on the backend.

export const getNotes        = ()              => api.get("/notes").then(r => r.data);
export const getNotesByStock = (symbol)        => api.get(`/notes/by-stock/${encodeURIComponent(symbol)}`).then(r => r.data);
export const createNote      = (data)          => api.post("/notes", data).then(r => r.data);
export const updateNote      = (id, data)      => api.patch(`/notes/${id}`, data).then(r => r.data);
export const deleteNote      = (id)            => api.delete(`/notes/${id}`).then(r => r.data);