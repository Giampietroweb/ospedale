# Step 02 - Service Worker e precache asset core

## Obiettivo dello step
Introdurre un service worker funzionante con precache dei file essenziali per garantire apertura dell'app anche offline.

## Prompt da lanciare
```text
Implementa lo Step 02 nel progetto "ospedale": service worker con precache dei file core.

Contesto:
- Step 01 gia` completato: manifest e registrazione SW presenti.
- App multipagina con percorsi root e sottocartelle (`piani/`, `planimetrie/`).

Obiettivo:
1) Consentire apertura offline delle pagine principali.
2) Definire una strategia cache versionata e manutenibile.

Attivita` richieste:
1. Crea/aggiorna `service-worker.js` con:
   - costante `CACHE_VERSION` (es. `app-shell-v1`).
   - array `APP_SHELL_ASSETS` con i file minimi:
     - `/index.html`
     - `/estrazioni.html`
     - `/cataloghi.html`
     - `/piani/planimetria.html`
     - `/style.css`
     - `/script.js`
     - `/estrazioni.js`
     - `/cataloghi.js`
     - `/manifest.webmanifest`
     - icone PWA.
2. In `install`:
   - apri cache e precache degli asset.
   - `self.skipWaiting()`.
3. In `activate`:
   - rimuovi cache vecchie non corrispondenti a `CACHE_VERSION`.
   - `clients.claim()`.
4. In `fetch`:
   - per richieste GET di navigazione (`request.mode === 'navigate'`), usa fallback a cache se offline.
   - per asset precache, usa cache-first semplice.
5. Gestisci in modo sicuro errori di fetch senza rompere il thread SW.

Vincoli:
- Non implementare ancora caching API dinamico complesso.
- Non implementare ancora queue offline per POST.
- Codice leggibile e modulare (helper interni al SW).

Output atteso:
- Diff dei file.
- Breve spiegazione del lifecycle install/activate/fetch.
- Nota su come incrementare `CACHE_VERSION` per invalidare cache.
```
