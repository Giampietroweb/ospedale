# Step 07 - UI stato offline e monitor sincronizzazione

## Obiettivo dello step
Dare feedback chiaro all'utente su stato rete, stato coda e risultato sincronizzazione.

## Prompt da lanciare
```text
Implementa lo Step 07 nel progetto "ospedale": migliorare UX offline con indicatori di stato e pannello sync.

Contesto:
- Esiste gia` coda outbox e sync engine.
- Serve trasparenza operativa all'utente.

Obiettivo:
1) Evitare ambiguita` ("ho salvato davvero?").
2) Rendere visibile numero e stato delle operazioni pendenti.

Attivita` richieste:
1. Aggiungi indicatori globali UI:
   - badge stato rete: Online / Offline.
   - badge sync: X operazioni in coda.
2. Nella modale stanza, mostra esito salvataggi:
   - "Salvato sul server"
   - "Salvato in locale, in attesa di sincronizzazione"
   - "Errore sincronizzazione" con dettaglio sintetico.
3. Crea piccolo pannello debug (attivabile) con:
   - lista ultime N operazioni outbox.
   - stato, timestamp, eventuale errore.
   - pulsante "Riprova sincronizzazione ora".
4. Aggiungi listener eventi custom dal sync engine alla UI (pattern pub/sub semplice).
5. Mantieni accessibilita` minima:
   - aria-live per messaggi di stato principali.
   - contrasto e testi chiari.

Vincoli:
- Evita UI invasiva; stile coerente con layout attuale.
- Nessuna dipendenza framework nuova.

Output atteso:
- Elenco componenti UI aggiunti.
- Eventi gestiti (online/offline/sync state changes).
- Breve demo flow: offline save -> queued -> online sync -> synced.
```
