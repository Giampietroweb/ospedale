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

const CACHE_VERSION = 'app-shell-v7';
const RUNTIME_ASSETS_CACHE = 'runtime-assets-v1';
const RUNTIME_API_CACHE = 'runtime-api-v1';

/** Include credenziali HTTP (Basic Auth hosting) nelle richieste same-origin. */
const FETCH_INIT = { credentials: 'include' };

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/estrazioni.html',
  '/cataloghi.html',
  '/sync.html',
  '/piani/planimetria.html',
  '/style.css',
  '/script.js',
  '/estrazioni.js',
  '/cataloghi.js',
  '/pwa-register.js',
  '/toolbar-nav.js',
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
  '/sync-page.js',
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
    pathname.startsWith('/planimetrie/') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webmanifest')
  );
}

function offlineNavigationResponse() {
  return new Response('Pagina non disponibile offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** Risolve varianti URL (/ vs index.html, query string planimetria, ecc.). */
async function matchNavigationRequest(cache, request) {
  const { pathname } = new URL(request.url);
  const candidates = [
    request,
    pathname,
    pathname === '/' ? '/index.html' : null,
    pathname.endsWith('/') ? `${pathname}index.html` : null,
  ].filter(Boolean);

  for (const key of candidates) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  return null;
}

async function putNavigationCache(cache, request, response) {
  const { pathname } = new URL(request.url);
  const keys = new Set([pathname || '/index.html']);
  if (pathname === '/' || pathname === '/index.html') {
    keys.add('/');
    keys.add('/index.html');
  }
  await Promise.all([...keys].map((key) => cache.put(key, response.clone())));
}

async function handleNavigation(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await matchNavigationRequest(cache, request);

  const refreshCache = () =>
    fetch(request, FETCH_INIT)
      .then(async (response) => {
        if (response.ok) {
          await putNavigationCache(cache, request, response);
        }
      })
      .catch(() => {});

  if (cached) {
    event.waitUntil(refreshCache());
    return cached;
  }

  try {
    const response = await fetch(request, FETCH_INIT);
    if (response.ok) {
      await putNavigationCache(cache, request, response);
    }
    return response;
  } catch {
    const shell = (await cache.match('/index.html')) || (await cache.match('/'));
    return shell || offlineNavigationResponse();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request, FETCH_INIT);
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

function offlineApiResponse() {
  return new Response(JSON.stringify({ ok: false, error: 'Dati non disponibili offline.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (!self.navigator.onLine) {
    return cached || offlineApiResponse();
  }

  const networkPromise = fetch(request.clone(), FETCH_INIT).then((response) => {
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
    return cached || offlineApiResponse();
  }
}

async function precacheAppShell(cache) {
  await Promise.all(
    APP_SHELL_ASSETS.map(async (url) => {
      try {
        const response = await fetch(url, FETCH_INIT);
        if (response.ok) {
          await cache.put(url, response);
        } else {
          console.warn('[SW] precache skip:', url, response.status);
        }
      } catch (err) {
        console.warn('[SW] precache skip:', url, err);
      }
    })
  );
}

// ── Lifecycle: Install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => precacheAppShell(cache))
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
    event.respondWith(handleNavigation(request, CACHE_VERSION, event));
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
