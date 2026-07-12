// src/utils/push.js
// Web Push subscription helpers. Talks to the backend's /api/push endpoints using
// the authenticated axios instance so the JWT rides along.
import { api } from "../api/portfolio";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw     = atob(base64);
    const arr     = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

export function pushSupported() {
    return typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
}

// { supported, permission, subscribed }
export async function getPushStatus() {
    if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false };
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        return { supported: true, permission: Notification.permission, subscribed: !!sub };
    } catch {
        return { supported: true, permission: Notification.permission, subscribed: false };
    }
}

export async function enablePush() {
    if (!pushSupported()) throw new Error("Notifications aren't supported on this device/browser");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was denied");

    const { data } = await api.get("/push/public-key");
    if (!data?.enabled || !data?.publicKey) {
        throw new Error("Push isn't enabled on the server yet");
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
    }

    const json = sub.toJSON();
    await api.post("/push/subscribe", {
        endpoint: sub.endpoint,
        p256dh:   json.keys?.p256dh,
        auth:     json.keys?.auth,
    });
    return true;
}

export async function disablePush() {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
        try { await api.post("/push/unsubscribe", { endpoint: sub.endpoint }); } catch { /* ignore */ }
        try { await sub.unsubscribe(); } catch { /* ignore */ }
    }
}

export async function sendTestPush() {
    await api.post("/push/test");
}