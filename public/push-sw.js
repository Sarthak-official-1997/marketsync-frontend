/* public/push-sw.js
 * Push handlers imported into the Workbox-generated service worker via
 * vite.config workbox.importScripts. Runs in the SW scope, so it can show
 * notifications even when the app/tab is closed.
 */

// A push arrived from the server → show a system notification.
self.addEventListener("push", (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

    const title = data.title || "FOLYO";
    const options = {
        body:  data.body || "",
        icon:  "/icons/icon-192.png",
        badge: "/icons/icon-96.png",
        vibrate: [80, 40, 80],
        tag: data.tag || "folyo-alert",
        renotify: true,
        data: { url: data.url || "/stocks/alerts" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification → focus an existing tab (and route it) or open one.
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/stocks/alerts";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ("focus" in client) {
                    if ("navigate" in client) { try { client.navigate(url); } catch (e) {} }
                    return client.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});