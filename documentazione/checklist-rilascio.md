# Checklist rilascio — PWA Offline-First Ospedale

## Prima del rilascio

### Preparazione ambiente
- [ ] Eseguire la migrazione SQL: `database/migration-sync-operations.sql`
- [ ] Verificare che il webserver serva `manifest.webmanifest` con `Content-Type: application/manifest+json`
- [ ] Verificare che `service-worker.js` sia servito con `Cache-Control: no-cache` (non mettere in cache il SW stesso)
- [ ] Verificare che tutti i file `assets/vendor/` siano accessibili
- [ ] Eseguire `npm run test` e verificare 0 fallimenti (`offline-store` e `sync-engine`)
- [ ] Eseguire `npm run build:css` per aggiornare `assets/vendor/tailwind.css` se `index.html` è cambiato
- [ ] Verificare che `CACHE_VERSION` in `service-worker.js` sia stato incrementato (attualmente `app-shell-v2`)

---

## Test manuali — Flussi core

### 1. Installazione app
- [ ] Aprire `index.html` su Chrome/Edge Desktop
- [ ] Verificare che l'icona di installazione appaia nella barra degli indirizzi
- [ ] Installare l'app e verificare che si apra come standalone (senza barra browser)
- [ ] Aprire l'app installata e verificare che la navigazione funzioni
- [ ] Ripetere test su dispositivo mobile Android (Chrome)

### 2. Avvio app completamente offline
- [ ] Aprire DevTools → Network → selezionare "Offline"
- [ ] Ricaricare `index.html`: deve aprirsi senza errori
- [ ] Navigare su `estrazioni.html`: deve aprirsi (pagina precache)
- [ ] Navigare su `cataloghi.html`: deve aprirsi (pagina precache)
- [ ] Navigare su `sync.html`: deve aprirsi (pagina precache)
- [ ] Navigare su `piani/planimetria.html`: deve aprirsi (pagina precache)
- [ ] Verificare che il badge "Offline" sia visibile in alto a destra in tutte le pagine

### 3. Apertura planimetrie offline
- [ ] Con rete offline, selezionare un piano con planimetria dal menu principale
- [ ] Verificare che la mappa SVG si carichi (se già caricata online prima)
- [ ] Verificare che i dropdown Tom Select siano funzionanti (CSS/JS locali)

### 4. Modifica stanza offline → enqueue + UI
- [ ] Con rete offline, aprire la modale di una stanza
- [ ] Modificare un campo (es. nome stanza) e cliccare Salva
- [ ] Verificare il messaggio "**Salvato in locale** alle HH:MM — sarà sincronizzato al ritorno online"
- [ ] Verificare che il badge "Sync" diventi "1 in coda" (ambra)
- [ ] Cliccare sul badge: si apre il pannello floating "Monitor sincronizzazione"
- [ ] Verificare nel pannello:
  - [ ] Summary mostra "1 In attesa, 0 In corso, 0 Sincronizzate, 0 Errori"
  - [ ] L'operazione è visibile con timestamp di creazione
  - [ ] Mostra il tipo di operazione tradotto in italiano (es. "Apparecchiatura")
  - [ ] Mostra la stanza coinvolta (es. `nord / 3 / N301`)
- [ ] Cliccare "Apri report completo →" → si apre `/sync.html`
- [ ] In `/sync.html` verificare:
  - [ ] Summary in alto consistente con il pannello
  - [ ] La tabella mostra la riga con stato "In attesa"
  - [ ] La colonna "Creato" mostra orario (relativo + assoluto)
  - [ ] La colonna "Sincronizzato" è "—"
  - [ ] La colonna "Tentativi" è 0
- [ ] Ricaricare la pagina ancora offline: tutto deve persistere

### 5. Ritorno online → sync automatica
- [ ] Disattivare la modalità offline in DevTools
- [ ] Verificare che il badge passi a "Online" entro pochi secondi
- [ ] Verificare che la sync parta automaticamente (badge cambia in "Sync 1..." poi torna "Sync")
- [ ] Nel pannello/sync.html: l'operazione passa a "Sincronizzato"
- [ ] La colonna "Sincronizzato" mostra l'orario di completamento
- [ ] La colonna "Tentativi" mostra 1
- [ ] Il summary aggiorna i contatori (1 Sincronizzata, 0 In attesa)
- [ ] Il pannello mostra "Ultima sync: HH:MM (ora)"

### 6. Simulazione errore server → retry con feedback
- [ ] Intercettare le richieste a `save-modal.php` con DevTools → risposta 500
- [ ] Fare una modifica stanza online (risponde 500 → l'operazione va in coda)
- [ ] Verificare "Salvato in locale" nella modale
- [ ] Aprire `/sync.html`: l'operazione è "In attesa" con errore visibile in colonna "Dettaglio"
- [ ] Cliccare "Riprova" sulla riga → il pulsante diventa "…"
- [ ] Ripristinare le risposte normali
- [ ] Cliccare "Sincronizza ora" in alto → sync va a buon fine
- [ ] Verificare che il `attemptCount` sia ≥ 2

### 7. Retry esponenziale automatico
- [ ] Mantenere il server in errore 500
- [ ] Modificare una stanza online (va in coda)
- [ ] Osservare console: i retry partono a 1s, 2s, 4s, 8s…
- [ ] Ripristinare risposte normali: al successivo retry l'operazione viene sincronizzata
- [ ] Verificare in `/sync.html` che `attemptCount` rifletta tutti i tentativi

### 8. Idempotenza (doppio invio)
- [ ] Inviare la stessa operazione due volte (`operationId` duplicato via console)
- [ ] Verificare che il backend risponda `ok: true, idempotent: true` alla seconda richiesta
- [ ] Verificare che il dato non sia duplicato in database

### 9. Robustezza HTML/JSON
- [ ] Provocare un errore PHP nel backend (es. modificare temporaneamente `save-modal.php`)
- [ ] Effettuare un salvataggio
- [ ] Verificare che NON appaia mai un errore tipo `<br /><b>...</b>` nel log lato client
- [ ] Verificare che l'operazione sia accodata con un messaggio di errore comprensibile

### 10. Lock anti-concorrenza
- [ ] Modificare 60+ stanze offline (creare 60+ operazioni)
- [ ] Tornare online
- [ ] Verificare in `/sync.html` che il batch completi (50 nel primo, 10+ nel batch continuo)
- [ ] Tutti i record devono passare a "Sincronizzato"
- [ ] Nessuna operazione deve restare bloccata in "In corso" indefinitamente

### 11. Azioni Monitor Sync
- [ ] Da `/sync.html` cliccare "Dettaglio" su una riga: si apre modale con payload JSON
- [ ] Per un'operazione sincronizzata, verificare la presenza della "Risposta server"
- [ ] Cliccare "Elimina" su una riga: chiede conferma e poi rimuove la riga
- [ ] Cliccare "Elimina sincronizzate": rimuove tutte le `synced` ma lascia pending/error
- [ ] Disattivare "Aggiornamento automatico": il polling 5s si ferma
- [ ] Cliccare "Aggiorna": refresh immediato

### 12. Filtri e ricerca
- [ ] Selezionare "Errori" nel filtro stato: solo le operazioni in errore
- [ ] Digitare `nord` in "Stanza": solo le operazioni con `roomRef.blocco='nord'`
- [ ] Impostare una data minima: filtra correttamente

---

## Criteri di Done

- [ ] 0 errori console bloccanti nei flussi core (offline/online/save/sync)
- [ ] Badge rete e badge coda visibili e funzionanti in tutte le pagine
- [ ] Pannello debug mostra summary contatori + lista ultime 20 operazioni + link a report
- [ ] Pagina `/sync.html` mostra fino a 500 operazioni con filtri funzionanti
- [ ] Timestamp visibili e accurati ovunque (creato/ultimo tentativo/sincronizzato)
- [ ] Feedback "Salvato sul server" / "Salvato in locale" visibile nella modale con orario
- [ ] Dati non persi dopo 5+ minuti in modalità offline con salvataggi multipli
- [ ] App installabile su Chrome Desktop e Android
- [ ] Test automatici: `npm run test` → 0 fallimenti (60 test totali)

---

## Post-rilascio

- [ ] Monitorare la tabella `sync_operations`: verificare distribuzione `outcome = 'success'`
- [ ] Verificare assenza di operazioni bloccate in `pending` per oltre 1 ora
- [ ] Comunicare agli utenti la procedura di aggiornamento SW (vedi `architettura-offline-first.md`)
- [ ] Pianificare cron di pulizia `sync_operations` (vedi architettura, sezione retention)
- [ ] Consigliare retention IndexedDB (eseguire `offlineStore.purgeSyncedOlderThan(7 giorni)` periodicamente)
