import { api } from "./portfolio";

export const sendContactMessage = (data)     => api.post("/contact", data);
export const getMyThreads       = ()         => api.get("/contact/mine").then(r => r.data);
export const getThread          = (id)       => api.get(`/contact/${id}/thread`).then(r => r.data);
export const replyToThread      = (id, data) => api.post(`/contact/${id}/reply`, data).then(r => r.data);