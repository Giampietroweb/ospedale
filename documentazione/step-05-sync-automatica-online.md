# Step 05 - Sincronizzazione automatica al ritorno online

## Obiettivo dello step
Svuotare in sicurezza la coda outbox quando la connessione ritorna, con retry controllato e ordine stabile.

## Prompt da lanciare
```text
Implementa lo Step 05 nel progetto "ospedale": sync automatica della coda outbox quando torna la connessione.

Contesto:
- Step 04 ha introdotto IndexedDB e coda `outbox`.
- I POST verso `save-modal.php` possono essere accodati.

Obiettivo:
1) Inviare automaticamente al server le operazioni pendenti.
2) Evitare invii duplicati incontrollati.

Attivita` richieste:
1. Crea modulo `sync-engine.js` (o equivalente) con funzioni:
   - `flushOutbox({ maxItems?, reason? })`
   - `syncSingleOperation(operation)`
   - `scheduleRetry()` con backoff esponenziale.
2. Trigger di sync:
   - evento browser `online`.
   - bootstrap app (all'avvio pagina).
   - opzionale timer periodico leggero solo quando ci sono pending.
3. Regole di invio:
   - ordine FIFO per `createdAt`.
   - aggiorna stato operazione: `pending -> syncing -> synced/error`.
   - su errore di rete: interrompi batch e riprova dopo backoff.
   - su errore validazione server (4xx applicativo): marca `error` persistente.
4. Aggiungi lock anti-concorrenza (`isSyncInProgress`) per evitare flush paralleli.
5. Esporre eventi/callback minimi per aggiornare UI stato sync.

Vincoli:
- Non implementare service worker background sync avanzato in questo step.
- Funzionamento affidabile anche senza tab sempre aperta: sync almeno all'apertura + online event.

Output atteso:
- Flusso documentato dei cambi stato operazione.
- Strategia retry con soglie.
- Test manuale: enqueue offline -> torna online -> operazioni inviate e marcate synced.
```
