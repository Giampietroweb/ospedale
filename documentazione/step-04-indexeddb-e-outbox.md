# Step 04 - IndexedDB e coda outbox per i salvataggi

## Obiettivo dello step
Intercettare i salvataggi e metterli in una coda locale quando la rete non e` disponibile, senza perdere dati utente.

## Prompt da lanciare
```text
Implementa lo Step 04 nel progetto "ospedale": introduci IndexedDB con outbox per i salvataggi offline.

Contesto:
- Frontend usa fetch POST verso `../api/save-modal.php` tramite `saveRoomFragment(...)` in `script.js`.
- Serve supportare ambienti senza connessione.

Obiettivo:
1) Non perdere nessun salvataggio quando offline.
2) Preparare una coda locale pronta per sync successivo.

Attivita` richieste:
1. Crea modulo dedicato (es. `offline-store.js`) con API chiare:
   - `openOfflineDb()`
   - `enqueueOutboxOperation(operation)`
   - `listPendingOperations()`
   - `markOperationSynced(id, metadata)`
   - `markOperationError(id, error)`
   - eventuale `saveRoomSnapshot(...)` per cache locale stanza.
2. Definisci schema IndexedDB:
   - db name: es. `ospedale_offline_db`
   - store `outbox` con chiave primaria (UUID) e indici (`status`, `createdAt`).
   - store opzionale `roomCache` per letture offline.
3. Introduci un wrapper API (es. `api-client.js`) per le chiamate a `save-modal.php`:
   - se online: prova invio diretto.
   - se offline o fetch fallisce per rete: enqueue in outbox e ritorna risultato "queued".
4. Integra il wrapper in `script.js`, sostituendo la chiamata diretta a `fetch` in `saveRoomFragment`.
5. Mantieni la UI coerente: lo step deve distinguere almeno tra:
   - salvato sul server
   - messo in coda offline.

Vincoli:
- Non introdurre ancora il flush completo della coda (arriva nello step successivo).
- Evita duplicazione codice: funzioni piccole e riusabili.
- Error handling esplicito, niente catch vuoti.

Output atteso:
- Nuovi moduli e punti di integrazione.
- Esempio di record outbox salvato.
- Verifica: in offline mode un salvataggio viene accodato e non perso.
```
