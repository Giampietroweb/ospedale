# Architettura Offline-First — PWA Ospedale

## Panoramica

L'app "Ospedale" è una PWA (Progressive Web App) offline-first basata su vanilla JS + PHP.
I dati in lettura sono disponibili offline via cache del service worker.
I salvataggi offline vengono accodati in IndexedDB e sincronizzati automaticamente
al ritorno della connessione, con monitoraggio completo via una pagina dedicata `/sync.html`.

---

## Componenti principali

| File | Ruolo |
|------|-------|
| `manifest.webmanifest` | Configurazione PWA (nome, icone, display mode) |
| `pwa-register.js` | Registrazione robusta del service worker |
| `service-worker.js` | Precache shell, runtime cache, fallback offline |
| `offline-store.js` | IndexedDB v2: coda outbox + metadata, CRUD, statistiche, retention |
| `api-client.js` | Wrapper POST: online→server, offline→outbox. Emette eventi su `window` |
| `sync-engine.js` | Motore sync: FIFO, backoff, lock, auto-reflush, retry singolo |
| `sync-ui.js` | Badge rete/coda, pannello monitor floating, feedback modale |
| `sync.html` + `sync-page.js` | Report completo navigabile delle operazioni outbox |

---

## Schema IndexedDB v2

Database: `ospedale_offline_db` — versione **2**.

### Store `outbox`
Chiave: `id` (uuid v4 generato client-side).

| Campo | Tipo | Note |
|-------|------|------|
| `id` | string (uuid) | chiave primaria — è anche l'`operationId` inviato al backend per idempotenza |
| `status` | `'pending' \| 'syncing' \| 'synced' \| 'error'` | indicizzato |
| `action` | string | es. `'saveApparecchiaturaRow'` — indicizzato |
| `payload` | object | corpo POST completo (compreso `roomRef`, `autoAttributes`) |
| `roomRef` | object | denormalizzato `{ blocco, piano, roomCode }` per ricerche rapide |
| `createdAt` | string ISO | accodamento — indicizzato |
| `updatedAt` | string ISO | ultimo aggiornamento qualsiasi |
| `lastAttemptAt` | string ISO \| null | timestamp dell'ultimo tentativo di sync |
| `syncedAt` | string ISO \| null | timestamp del sync riuscito |
| `attemptCount` | number | numero tentativi effettuati (inclusi quelli falliti) |
| `error` | string \| null | ultimo messaggio di errore |
| `serverResponse` | object \| null | corpo della risposta JSON del server al successo |

### Store `metadata`
Key-value pairs. Chiave: `key`.

| Key | Valore | Scopo |
|-----|--------|-------|
| `lastSyncAt` | string ISO | Timestamp dell'ultima sincronizzazione conclusasi con almeno 1 successo |
| `lastFlushSummary` | object | `{ syncedCount, errorCount, remainingCount, elapsedMs, reason, at }` |

### Migrazione v1 → v2

All'apertura del DB v2, il blocco `onupgradeneeded`:
1. Aggiunge l'indice `action` allo store `outbox` se non presente
2. Crea lo store `metadata` se non presente
3. Esegue un cursore sull'`outbox` esistente e:
   - Imposta `attemptCount = 0`, `lastAttemptAt = null`, `syncedAt = null` ai record che non li hanno
   - Per i record già `synced`, copia `updatedAt` in `syncedAt` per non perdere lo storico
   - Imposta `roomRef = payload.roomRef` se mancante

---

## Eventi globali (`window`)

| Evento | Detail | Quando |
|--------|--------|--------|
| `pwa:enqueued` | `{ operationId, action, roomRef }` | Operazione accodata in outbox (offline o errore rete/5xx) |
| `pwa:saved-online` | `{ operationId, action, roomRef }` | Operazione salvata direttamente online senza accodare |

Questi eventi sono usati da `sync-ui.js`, `sync-page.js` e dal motore stesso per
aggiornare la UI in modo reattivo. Il `sync-engine` ascolta `pwa:enqueued` per
avviare immediatamente un flush quando online.

---

## Flusso di salvataggio

```
Utente modifica stanza
    ↓
saveRoomFragment(action, extraPayload)
    ↓
apiClient.saveRoom(...)
    ├── navigator.onLine = true → fetch POST save-modal.php
    │       ├── 200 ok → { status: 'saved' } + dispatch 'pwa:saved-online'
    │       ├── 4xx → throw Error (errore validazione, no enqueue)
    │       └── 5xx / network error → enqueue + dispatch 'pwa:enqueued'
    └── navigator.onLine = false → enqueue + dispatch 'pwa:enqueued'
             ↓
         IndexedDB outbox (status: pending, attemptCount: 0)
```

## Flusso di sincronizzazione

```
Trigger: 'online' | DOMContentLoaded | timer 30s | 'pwa:enqueued' | manuale
    ↓
syncEngine.flushOutbox({ reason })
    ↓ FIFO per createdAt, lock isSyncInProgress (con finally)
Per ogni operazione pending (max 50/batch):
    ├── recordAttempt   → attemptCount++, lastAttemptAt = now
    ├── markOperationSyncing
    ├── fetch POST save-modal.php (con operationId nel body)
    │       ├── 200 ok → markOperationSynced(syncedAt = now, serverResponse)
    │       ├── 4xx → markOperationError (permanente)
    │       └── errore rete / 5xx / risposta non-JSON →
    │              markOperationPending(error = ...) + scheduleRetry
    └── emitEvent → UI aggiornata
    ↓
sync:end → setLastSyncAt + setMetadata('lastFlushSummary')
    ↓
Se restano pending e nessun errore di rete → flush continuativo (50ms dopo)
Se errore di rete e pending > 0 → scheduleRetry (backoff esponenziale)
```

### Backoff esponenziale
1s, 2s, 4s, 8s, 16s, 30s (max). Resettato a 0 quando una operazione va a buon fine.

### Lock anti-concorrenza
`isSyncInProgress` viene rilasciato in un blocco `finally` per garantire che
una eccezione non ricuperabile non blocchi i flush successivi. Quando un flush
viene saltato per lock, emette l'evento `sync:skipped` con `reason: 'lock'`.

---

## Pagina Monitor (`/sync.html`)

Pagina dedicata al monitoraggio operazioni offline:
- **Summary cards**: pending, syncing, synced, error + ultima sincronizzazione + stato rete
- **Filtri**: stato, tipo operazione, stanza (substring `blocco/piano/codice`), data minima
- **Tabella**: stato, operazione, stanza, dettaglio (campo o riga modificata),
  creato (relativo + assoluto), ultimo tentativo, sincronizzato, tentativi, azioni
- **Azioni per riga**: "Dettaglio" (apre modale con payload JSON + risposta server),
  "Riprova" (solo se pending/error), "Elimina"
- **Azioni globali**: "Sincronizza ora", "Aggiorna", "Elimina sincronizzate"
- **Auto-refresh** ogni 5s (toggleable)

---

## Idempotenza backend

Ogni operazione ha un `operationId` UUID generato lato client.
Il backend registra ogni `operation_id` nella tabella `sync_operations`.
Se riceve la stessa operazione due volte, risponde `{ ok: true, idempotent: true }` senza rieseguire.

Politica conflitti: **last-write-wins** basata su `updated_at` del server.

Il blocco di controllo idempotenza in `api/save-modal.php` è wrappato in `try/catch`:
se la tabella `sync_operations` non esiste (migrazione non eseguita), il salvataggio
procede normalmente senza deduplicazione invece di crashare.

---

## Strategie cache del Service Worker

| Tipo richiesta | Cache | Strategia |
|----------------|-------|-----------|
| Navigazione (HTML) | `app-shell-v2` | Network con fallback cache |
| Asset statici (CSS/JS/SVG) | `app-shell-v2` | Cache-first |
| Asset vendor (Tom Select, Tailwind) | `runtime-assets-v1` | Cache-first |
| GET API (`/api/get-room.php`, ecc.) | `runtime-api-v1` | Network-first (timeout 4s) |
| POST API (salvataggi) | — | Non intercettato dal SW |

### Asset precache (`app-shell-v2`)
HTML pagine principali (`index`, `estrazioni`, `cataloghi`, `sync`, `piani/planimetria`),
script PWA (`offline-store`, `api-client`, `sync-engine`, `sync-ui`, `sync-page`),
`pwa-register`, `style.css`, icone, manifest.

---

## Versioning cache

Per invalidare tutte le cache precache al prossimo deploy:

1. Incrementare `CACHE_VERSION` in `service-worker.js` (es. `app-shell-v3`)
2. Il vecchio SW verrà sostituito al prossimo avvio della pagina
3. Le vecchie cache vengono eliminate nell'handler `activate`

**Attenzione**: `RUNTIME_ASSETS_CACHE` e `RUNTIME_API_CACHE` sono preservate
tra versioni per non perdere le risposte API in cache.

---

## Retention IndexedDB

`offlineStore.deleteAllSyncedOperations()` rimuove tutte le operazioni con status `synced`
mantenendo solo quelle in attesa o in errore. La pagina `/sync.html` espone un pulsante
"Elimina sincronizzate" che invoca questa funzione.

`offlineStore.purgeSyncedOlderThan(milliseconds)` rimuove solo le operazioni `synced`
più vecchie di N ms. Utile per una pulizia automatica programmata
(ad es. al bootstrap delle pagine principali con `purgeSyncedOlderThan(7 * 24 * 3600 * 1000)`).

---

## Limitazioni note

1. **Sincronizzazione garantita solo con tab aperta**: Background Sync API non è implementata.
   La coda viene svuotata quando l'utente ha una pagina aperta e torna online.

2. **Timer periodico (30s) non attivo con tab chiusa**: se l'utente chiude il browser
   offline, la sync partirà al prossimo avvio (`bootstrap`).

3. **Conflitti multi-device**: la politica last-write-wins può causare sovrascritture
   se due utenti modificano la stessa stanza quasi in contemporanea. Documentato e accettato.

4. **Planimetrie SVG non precachate**: i file SVG delle planimetrie non sono nella
   precache (sono molti e pesanti). Sono in cache solo se l'utente li ha visitati online.

5. **Tom Select e Tailwind vendor**: le versioni sono fisse (`tom-select@2.4.3`).
   Per aggiornarle, scaricare nuovamente in `assets/vendor/` e incrementare
   `RUNTIME_ASSETS_CACHE` nel SW.

6. **Crescita IndexedDB**: senza retention manuale, le operazioni `synced` si accumulano.
   Usare il pulsante "Elimina sincronizzate" da `/sync.html` o `purgeSyncedOlderThan` programmaticamente.

---

## Troubleshooting comune

### Il service worker non si aggiorna
- Aprire DevTools → Application → Service Workers → cliccare "Update"
- Oppure incrementare `CACHE_VERSION` e fare deploy

### Le operazioni restano in "In attesa" per sempre
- Verificare connessione (badge "Online" visibile?)
- Aprire `/sync.html` e cliccare "Sincronizza ora"
- Aprire il dettaglio dell'operazione: se l'errore è 4xx è permanente — eliminare e ricreare manualmente
- Verificare risposta `save-modal.php`: se restituisce HTML invece di JSON c'è un errore PHP
  (controllare error_log del webserver)

### La risposta del server è HTML invece di JSON
- `api/save-modal.php` ha `ini_set('display_errors', '0')` per evitare il problema
- Verificare comunque il PHP error_log per individuare l'errore di base
- Se la tabella `sync_operations` non esiste, il backend continua a funzionare ma senza idempotenza

### La tabella `sync_operations` cresce troppo
- Job cron consigliato:
  ```sql
  DELETE FROM sync_operations
  WHERE outcome = 'success'
    AND processed_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
  ```

### L'app non è installabile
- Verificare `manifest.webmanifest` con `Content-Type: application/manifest+json`
- Verificare registrazione SW (DevTools → Application → Service Workers)
- Verificare HTTPS (o `localhost`)

---

## Raccomandazioni post-rilascio

1. Monitorare `sync_operations` con `outcome = 'pending'` per più di 24h
   (potrebbero indicare errori sistematici).
2. Alerting se il tasso `outcome = 'error'` supera il 5%.
3. Considerare Background Sync API per garantire sync anche con tab chiusa in futuro.
4. Considerare Workbox per semplificare la manutenzione del service worker.
5. Programmare retention automatica: invocare `offlineStore.purgeSyncedOlderThan(7 giorni)`
   nel bootstrap delle pagine principali.
