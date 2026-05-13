# Architettura Offline-First — PWA Ospedale

## Panoramica

L'app "Ospedale" è una PWA (Progressive Web App) offline-first basata su vanilla JS + PHP.
I dati in lettura sono disponibili offline via cache del service worker.
I salvataggi offline vengono accodati in IndexedDB e sincronizzati automaticamente al ritorno della connessione.

---

## Componenti principali

| File | Ruolo |
|------|-------|
| `manifest.webmanifest` | Configurazione PWA (nome, icone, display mode) |
| `pwa-register.js` | Registrazione robusta del service worker |
| `service-worker.js` | Precache shell, runtime cache, fallback offline |
| `offline-store.js` | IndexedDB: coda outbox, operazioni CRUD |
| `api-client.js` | Wrapper fetch POST: online→server, offline→outbox |
| `sync-engine.js` | Motore di sync: FIFO, backoff, lock, pub/sub eventi |
| `sync-ui.js` | Badge rete, badge coda, pannello debug, stato modale |

---

## Flusso di salvataggio

```
Utente modifica stanza
    ↓
saveRoomFragment(action, extraPayload)
    ↓
apiClient.saveRoom(...)
    ├── navigator.onLine = true → fetch POST save-modal.php
    │       ├── 200 ok → { status: 'saved' }
    │       ├── 4xx → throw Error (errore validazione, no enqueue)
    │       └── 5xx / network error → enqueue
    └── navigator.onLine = false → enqueue
             ↓
         IndexedDB outbox (status: pending)
```

## Flusso di sincronizzazione

```
Trigger: evento 'online' | DOMContentLoaded | timer 30s
    ↓
syncEngine.flushOutbox()
    ↓ (FIFO per createdAt, lock isSyncInProgress)
Per ogni operazione pending:
    ├── markOperationSyncing
    ├── fetch POST save-modal.php (con operationId)
    │       ├── 200 ok → markOperationSynced
    │       ├── 4xx → markOperationError (permanente)
    │       └── errore rete → markOperationPending + scheduleRetry
    └── emitEvent → syncUI aggiorna badge e pannello
```

## Idempotenza backend

Ogni operazione ha un `operationId` UUID generato lato client.
Il backend registra ogni `operation_id` nella tabella `sync_operations`.
Se riceve la stessa operazione due volte, risponde `{ ok: true, idempotent: true }` senza rieseguire.

Politica conflitti: **last-write-wins** basata su `updated_at` del server.

---

## Strategie cache del Service Worker

| Tipo richiesta | Cache | Strategia |
|----------------|-------|-----------|
| Navigazione (HTML) | `app-shell-v1` | Network con fallback cache |
| Asset statici (CSS/JS/SVG) | `app-shell-v1` | Cache-first |
| Asset vendor (Tom Select, Tailwind) | `runtime-assets-v1` | Cache-first |
| GET API (`/api/get-room.php`, ecc.) | `runtime-api-v1` | Network-first (timeout 4s) |
| POST API (salvataggi) | — | Non intercettato dal SW |

---

## Versioning cache

Per invalidare tutte le cache precache al prossimo deploy:

1. Incrementare `CACHE_VERSION` in `service-worker.js` (es. `app-shell-v2`)
2. Il vecchio SW verrà sostituito al prossimo avvio della pagina
3. Le vecchie cache vengono eliminate nell'handler `activate`

**Attenzione**: `RUNTIME_ASSETS_CACHE` e `RUNTIME_API_CACHE` sono preservate tra versioni per non perdere le risposte API in cache.

---

## Limitazioni note

1. **Sincronizzazione garantita solo con tab aperta**: la sync background tramite Background Sync API non è implementata. La coda viene svuotata solo quando l'utente ha la pagina aperta e torna online.

2. **Timer periodico (30s) non attivo con tab chiusa**: se l'utente chiude il browser offline, la sync partirà al prossimo avvio (`bootstrap`).

3. **Conflitti multi-device**: la politica last-write-wins può causare sovrascritture se due utenti modificano la stessa stanza quasi in contemporanea. È documentato e accettato.

4. **Planimetrie SVG non precachate**: i file SVG delle planimetrie non sono nella precache (sono molti e pesanti). Sono in cache solo se l'utente li ha già visitati online.

5. **Tom Select e Tailwind**: le versioni vendor sono fisse (`tom-select@2.4.3`). Per aggiornarle, scaricare nuovamente in `assets/vendor/` e aggiornare `RUNTIME_ASSETS_CACHE` nel SW.

---

## Troubleshooting comune

### Il service worker non si aggiorna
- Aprire DevTools → Application → Service Workers → cliccare "Update"
- Oppure incrementare `CACHE_VERSION` e fare deploy

### Le operazioni restano in "In attesa" per sempre
- Verificare che la rete sia effettivamente disponibile
- Aprire il pannello debug e cliccare "Riprova ora"
- Controllare se l'errore è un 4xx (permanente): in quel caso resettare manualmente l'operazione nel DB IndexedDB

### La tabella `sync_operations` cresce troppo
- Le operazioni con `outcome = 'success'` possono essere archiviate dopo N giorni
- Aggiungere un job cron: `DELETE FROM sync_operations WHERE outcome = 'success' AND processed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`

### L'app non è installabile
- Verificare che il `manifest.webmanifest` sia servito con Content-Type corretto
- Verificare che il service worker sia registrato (DevTools → Application → Service Workers)
- Verificare che la pagina sia servita via HTTPS (o localhost)

---

## Raccomandazioni post-rilascio

1. Monitorare `sync_operations` con `outcome = 'pending'` per più di 24h (potrebbero indicare errori sistematici)
2. Aggiungere alerting se il tasso di `outcome = 'error'` supera il 5%
3. Considerare Background Sync API per garantire sync anche con tab chiusa in futuro
4. Considerare Workbox per semplificare la manutenzione del service worker nelle versioni successive
