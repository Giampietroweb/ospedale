/**
 * Service Worker — Ospedale PWA
 *
 * VERSIONING CACHE:
 * - Incrementare CACHE_VERSION (es. app-shell-v2) a ogni deploy che
 *   modifica file in APP_SHELL_ASSETS. Il vecchio SW viene sostituito
 *   automaticamente alla prossima apertura della pagina.
 * - Le cache runtime-* sono preservate tra versioni per non perdere
 *   i dati API già in cache.
 *
 * PROCEDURA SAFE UPDATE:
 * 1. Modificare i file desiderati
 * 2. Incrementare CACHE_VERSION
 * 3. Fare deploy
 * 4. Al prossimo avvio pagina, il nuovo SW si installa e fa skipWaiting()
 * 5. Le vecchie cache vengono eliminate nell'handler activate
 */

const CACHE_VERSION = 'app-shell-v1';
const RUNTIME_ASSETS_CACHE = 'runtime-assets-v1';
const RUNTIME_API_CACHE = 'runtime-api-v1';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/estrazioni.html',
  '/cataloghi.html',
  '/piani/planimetria.html',
  '/style.css',
  '/script.js',
  '/estrazioni.js',
  '/cataloghi.js',
  '/pwa-register.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
  '/assets/vendor/tailwind.css',
  '/assets/vendor/tom-select.css',
  '/assets/vendor/tom-select.complete.min.js',
  '/offline-store.js',
  '/api-client.js',
  '/sync-engine.js',
  '/sync-ui.js',
];

const API_GET_PATHS = [
  '/api/get-room.php',
  '/api/get-rooms-for-floor.php',
  '/api/catalogs.php',
];

const NETWORK_FIRST_TIMEOUT_MS = 4000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isVendorAsset(request) {
  return new URL(request.url).pathname.startsWith('/assets/vendor/');
}

function isApiGetRequest(request) {
  if (request.method !== 'GET') return false;
  const pathname = new URL(request.url).pathname;
  return API_GET_PATHS.some((path) => pathname.startsWith(path));
}

function isStaticAsset(request) {
  const { pathname } = new URL(request.url);
  return (
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webmanifest')
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Risorsa non disponibile offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);

  const networkPromise = fetch(request.clone()).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
  );

  try {
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ ok: false, error: 'Dati non disponibili offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}

async function fallbackToCache(request, cacheName) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Pagina non disponibile offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// ── Lifecycle: Install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Lifecycle: Activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const preservedCaches = [CACHE_VERSION, RUNTIME_ASSETS_CACHE, RUNTIME_API_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !preservedCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Lifecycle: Fetch ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (isNavigationRequest(request)) {
    event.respondWith(fallbackToCache(request, CACHE_VERSION));
    return;
  }

  if (isApiGetRequest(request)) {
    event.respondWith(
      networkFirstWithTimeout(request, RUNTIME_API_CACHE, NETWORK_FIRST_TIMEOUT_MS)
    );
    return;
  }

  if (isVendorAsset(request)) {
    event.respondWith(cacheFirst(request, RUNTIME_ASSETS_CACHE));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, CACHE_VERSION));
    return;
  }
});
