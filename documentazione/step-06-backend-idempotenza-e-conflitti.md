# Step 06 - Backend idempotente e gestione conflitti

## Obiettivo dello step
Rendere il backend sicuro rispetto a retry/doppio invio delle operazioni di sync offline.

## Prompt da lanciare
```text
Implementa lo Step 06 nel progetto "ospedale": adegua backend PHP per idempotenza e gestione conflitti minimi.

Contesto:
- I client offline possono ritentare la stessa operazione piu` volte.
- Endpoint principale di salvataggio: `api/save-modal.php`.

Obiettivo:
1) Garantire che la stessa operazione non venga applicata due volte.
2) Ridurre rischio inconsistenze in presenza di retry o multi-device.

Attivita` richieste:
1. Estendi payload client con `operationId` UUID per ogni evento outbox.
2. In backend crea persistenza deduplica (tabella es. `sync_operations`):
   - operation_id (unique)
   - room reference / action
   - created_at / processed_at
   - esito.
3. In `save-modal.php`:
   - valida `operationId` se presente.
   - se operationId gia` processata: ritorna risposta `ok` idempotente senza riapplicare mutazioni.
   - se nuova: processa transazione e registra operationId come completata.
4. Definisci una politica conflitti semplice e documentata:
   - es. last-write-wins con `updated_at`,
   - oppure check ottimistico con timestamp client/server (se vuoi fare step extra).
5. Mantieni compatibilita` con client legacy senza `operationId` (fallback).

Vincoli:
- Nessuna regressione sulle action gia` supportate (`saveField`, `saveApparecchiaturaRow`, ecc.).
- Gestione errori chiara in JSON.

Output atteso:
- Migrazioni DB necessarie.
- Modifiche endpoint e comportamento per duplicate submission.
- Esempio richiesta/risposta idempotente.
```
