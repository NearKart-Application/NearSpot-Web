/**
 * NearSpot Web Push (FCM)
 *
 * Setup checklist:
 *   1. Create a Firebase project → Web app → copy config into FIREBASE_CONFIG below
 *   2. Generate a VAPID key (Cloud Messaging → Web Push certificates) and set VAPID_KEY
 *   3. Set PUBLIC_FIREBASE_* env vars in .env.local (Astro exposes PUBLIC_* to the client)
 *   4. Re-deploy — the service worker is already wired up at /firebase-messaging-sw.js
 */

import api from './api';

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.PUBLIC_FIREBASE_API_KEY            ?? '',
  authDomain:        import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         import.meta.env.PUBLIC_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.PUBLIC_FIREBASE_APP_ID              ?? '',
};

const VAPID_KEY = import.meta.env.PUBLIC_FIREBASE_VAPID_KEY ?? '';

function isConfigured(): boolean {
  return !!FIREBASE_CONFIG.apiKey && !!VAPID_KEY;
}

/**
 * Register the FCM service worker, request notification permission, obtain FCM token,
 * and POST it to the backend. Call once after the user logs in.
 */
export async function registerWebPush(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isConfigured()) return; // no-op until Firebase env vars are set
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    // Inject Firebase config into the service worker
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG });
    } else {
      swReg.addEventListener('updatefound', () => {
        const newWorker = swReg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            navigator.serviceWorker.controller?.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG });
          }
        });
      });
    }

    // Load Firebase dynamically so it doesn't bloat the initial bundle
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return;

    const stored = localStorage.getItem('ns_fcm_token');
    if (stored === token) return; // already registered, skip API call

    await api.post('/notifications/device-token/', { fcm_token: token, device_type: 'web' });
    localStorage.setItem('ns_fcm_token', token);
  } catch (err) {
    console.warn('[NearSpot] Web push registration failed:', err);
  }
}

export function unregisterWebPush(): void {
  localStorage.removeItem('ns_fcm_token');
}
