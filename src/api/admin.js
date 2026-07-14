// src/api/admin.js
import { api } from "./portfolio";

// -- Dashboard / Clients / Analytics (ADMIN + CREATOR) --------------------─
export const getAdminDashboard         = ()                        => api.get("/admin/dashboard").then(r => r.data);
export const getAdminClients           = ()                        => api.get("/admin/clients").then(r => r.data);
export const getClientHoldings         = (clientId)                => api.get(`/admin/clients/${clientId}/holdings`).then(r => r.data);
export const getClientPortfolioHistory = (clientId, range = "3m") => api.get(`/admin/clients/${clientId}/portfolio-history`, { params: { range } }).then(r => r.data);
export const getPlatformAnalytics      = ()                        => api.get("/admin/analytics").then(r => r.data);

// -- User management (CREATOR only) ----------------------------------------
export const getAllUsers     = ()                  => api.get("/admin/users").then(r => r.data);
export const createUser      = (data)             => api.post("/admin/users", data).then(r => r.data);
export const changeUserRole = (userId, role)      => api.patch(`/admin/users/${userId}/role`, { role }).then(r => r.data);
export const blockUser      = (userId)            => api.patch(`/admin/users/${userId}/block`).then(r => r.data);
export const unblockUser    = (userId)            => api.patch(`/admin/users/${userId}/unblock`).then(r => r.data);
export const deleteUser     = (userId)            => api.delete(`/admin/users/${userId}`).then(r => r.data);
export const resetUserPassword = (userId) => api.post(`/admin/users/${userId}/reset-password`).then(r => r.data);
export const resetUserPasskey = (userId) => api.delete(`/admin/users/${userId}/passkey`);

// -- Notifications (CREATOR sends, ADMIN/CREATOR views) --------------------
export const sendNotification      = (data)   => api.post("/admin/notifications", data).then(r => r.data);
export const getAllNotifications    = ()       => api.get("/admin/notifications").then(r => r.data);
export const getNotificationStatus = (id)     => api.get(`/admin/notifications/${id}/read-status`).then(r => r.data);

// -- Stock holders (CREATOR only) ------------------------------------------
export const getStockHolders = (symbol) => api.get(`/admin/analytics/stock/${symbol}/holders`).then(r => r.data);

// -- Client notifications (all users) --------------------------------------
export const getPendingNotifications = () => api.get("/notifications/pending").then(r => r.data);
export const acknowledgeNotification = (recipientId) => api.post(`/notifications/${recipientId}/acknowledge`).then(r => r.data);

// -- AI Chat additons --------------------------------------

export const getAiCostSummary = () => api.get("/admin/ai/cost-summary").then(r => r.data);
export const getAiReport = () => api.get("/admin/ai/report").then(r => r.data);
export const getUserChatSessions = (userId) => api.get(`/admin/ai/users/${userId}/chat`).then(r => r.data);
export const getUserChatSession = (userId, sessionId) => api.get(`/admin/ai/users/${userId}/chat/${sessionId}`).then(r => r.data);
export const getAiConfig = () => api.get("/admin/ai/config").then(r => r.data);
export const updateAiConfig = (key, value) => api.patch(`/admin/ai/config/${key}`, { value: String(value) }).then(r => r.data);

// -- Contact messages (CREATOR inbox) --------------------------------------
export const getContactMessages = ()    => api.get("/contact").then(r => r.data);
export const markContactRead    = (id)  => api.patch(`/contact/${id}/read`).then(r => r.data);
export const getInboxUnread     = ()    => api.get("/admin/inbox/unread").then(r => r.data);


// -----AI related ------------------
export const getUserAiTokenLimit  = (userId) => api.get(`/admin/ai/config/extract.max_tokens.user.${userId}`).then(r => r.data);
export const setUserAiTokenLimit  = (userId, tokens) => updateAiConfig(`extract.max_tokens.user.${userId}`, tokens);