/* eslint-disable no-console */
/**
 * Service Worker — Browser Push Notifications
 * Receives push events from Web Push API and displays native notifications.
 */

// Install event — skip waiting to activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event — claim all clients
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event — display notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Notification",
      body: event.data.text(),
    };
  }

  const title = payload.title || "Copilot Portal";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/notification.png",
    badge: payload.badge || "/icons/badge.png",
    image: payload.image,
    tag: payload.tag || "copilot-notification",
    renotify: true,
    requireInteraction: payload.priority === "critical",
    silent: false,
    timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
    actions: payload.actions || [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open the relevant URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});

// Push subscription change — re-register
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then((subscription) => {
      // Notify the backend about the new subscription
      return fetch("/v1/notifications/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    })
  );
});
