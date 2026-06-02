/**
 * Registrazione Service Worker PWA.
 * Importato da tutte le pagine HTML principali.
 */

const SERVICE_WORKER_PATH = '/service-worker.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[PWA] Service Worker non supportato da questo browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
      scope: '/'
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.info('[PWA] Nuova versione disponibile. Ricarica la pagina per aggiornare.');
        }
      });
    });

    console.info('[PWA] Service Worker registrato con scope:', registration.scope);
  } catch (error) {
    console.error('[PWA] Registrazione Service Worker fallita:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerServiceWorker);
} else {
  registerServiceWorker();
}
