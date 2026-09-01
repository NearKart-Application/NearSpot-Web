// NearSpot FCM Service Worker
// Firebase config is injected by the app when the SW is registered.
// See: src/lib/pushNotifications.ts

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let messaging = null;

self.addEventListener('message', event => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
    }
    messaging = firebase.messaging();

    messaging.onBackgroundMessage(payload => {
      const { title = 'NearSpot', body = '', data = {} } = payload.notification ?? payload.data ?? {};
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag ?? 'nearspot',
        data: { url: data.url ?? '/' },
      });
    });
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
