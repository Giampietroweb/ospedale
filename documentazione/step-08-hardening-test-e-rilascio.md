# Step 08 - Hardening, test end-to-end e rilascio

## Obiettivo dello step
Consolidare la PWA offline-first con test reali, metriche minime e checklist di rilascio.

## Prompt da lanciare
```text
Implementa lo Step 08 nel progetto "ospedale": hardening finale, test E2E/manuali e checklist rilascio PWA offline-first.

Contesto:
- PWA installabile, caching, outbox, sync e idempotenza backend gia` implementati.

Obiettivo:
1) Ridurre regressioni prima del go-live.
2) Definire criteri di accettazione oggettivi.

Attivita` richieste:
1. Crea checklist test manuali strutturata:
   - installazione app (desktop/mobile).
   - avvio app completamente offline.
   - apertura planimetrie e pagine principali offline.
   - modifica stanza offline -> enqueue.
   - ritorno online -> sync riuscita.
   - simulazione errore server -> stato error + retry.
2. Aggiungi script/test automatici dove possibile:
   - test unit funzioni pure (normalizzazione payload, queue utilities).
   - test integrazione base su sync engine (mock fetch).
3. Aggiungi logging minimo non invasivo:
   - conteggio operazioni queued/synced/error.
   - tempi medi di sync batch (facoltativo ma consigliato).
4. Definisci strategia versioning cache:
   - quando incrementare versione.
   - procedura safe update SW.
5. Aggiorna documentazione progetto con:
   - architettura offline-first.
   - troubleshooting comune.
   - limitazioni note (es. sync "a orario fisso" non garantito su tutti i browser).

Criteri di Done:
- Nessun errore console bloccante nei flussi core.
- Esperienza utente comprensibile in condizioni offline/online.
- Dati non persi in scenari offline prolungati.
- Procedura di rilascio ripetibile documentata.

Output atteso:
- Report test con esiti.
- Lista rischi residui.
- Raccomandazioni per monitoraggio post-rilascio.
```
