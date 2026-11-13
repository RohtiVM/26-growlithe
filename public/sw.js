/* Service worker do Growlithe: recebe o push da Missão Relâmpago e abre a missão no toque. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "⚡ Growlithe", body: "Tem missão nova no shopping!", url: "/app", tag: "growlithe" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Payload fora do formato: mostra o aviso genérico.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.location.origin));
      if (open) {
        open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    }),
  );
});
