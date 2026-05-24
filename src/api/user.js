import { api } from "./portfolio";

export const setupPasskey      = (passkey) =>
    api.post("/user/setup-passkey", { passkey });

export const getPasskeyStatus  = () =>
    api.get("/user/passkey-status");

export const revealPassword    = (passkey) =>
    api.post("/user/reveal-password", { passkey });

export const changePassword    = (data) =>
    api.post("/user/change-password", data);

export const resetWithPasskey  = (passkey, newPassword) =>
    api.post("/user/reset-password-with-passkey", { passkey, newPassword });

export const forgotPasswordWithPasskey = (username, passkey, newPassword) =>
    api.post("/auth/forgot-password", { username, passkey, newPassword });