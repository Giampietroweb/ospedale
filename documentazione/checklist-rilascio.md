# Checklist rilascio — PWA Offline-First Ospedale

## Prima del rilascio

### Preparazione ambiente
- [ ] Eseguire la migrazione SQL: `database/migration-sync-operations.sql`
- [ ] Verificare che il webserver serva `manifest.webmanifest` con `Content-Type: application/manifest+json`
- [ ] Verificare che `service-worker.js` sia servito con `Cache-Control: no-cache` (non mettere in cache il SW stesso)
- [ ] Verificare che tutti i file `assets/vendor/` siano accessibili
- [ ] Eseguire `npm run test` e verificare 0 fallimenti
- [ ] Eseguire `npm run build:css` per aggiornare `assets/vendor/tailwind.css` se `index.html` è cambiato

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
- [ ] Navigare su `piani/planimetria.html`: deve aprirsi (pagina precache)
- [ ] Verificare che il badge "Offline" sia visibile nella toolbar

### 3. Apertura planimetrie offline
- [ ] Con rete offline, selezionare un piano con planimetria dal menu principale
- [ ] Verificare che la mappa SVG si carichi (se era già stata caricata online prima)
- [ ] Verificare che i dropdown Tom Select siano funzionanti (CSS/JS locali)

### 4. Modifica stanza offline → enqueue
- [ ] Con rete offline, aprire la modale di una stanza
- [ ] Modificare un campo (es. nome stanza) e cliccare Salva
- [ ] Verificare che appaia il messaggio "Salvato in locale, in attesa di sincronizzazione"
- [ ] Verificare che il badge di coda mostri "1 in coda" (o più)
- [ ] Aprire il pannello debug (clic sul badge coda): l'operazione deve essere visibile con status "In attesa"
- [ ] Ricaricare la pagina (ancora offline): il badge coda deve essere ancora presente

### 5. Ritorno online → sync riuscita
- [ ] Disattivare la modalità offline in DevTools
- [ ] Verificare che il badge passi a "Online" entro pochi secondi
- [ ] Verificare che la sync parta automaticamente
- [ ] Nel pannello debug: l'operazione deve passare a "Sincronizzato"
- [ ] Il badge coda deve sparire (0 operazioni pendenti)

### 6. Simulazione errore server → retry
- [ ] Intercettare le richieste a `save-modal.php` con DevTools → risposta 500
- [ ] Fare una modifica stanza online (risponde 500 → l'operazione va in coda)
- [ ] Verificare che appaia "Salvato in locale, in attesa di sincronizzazione"
- [ ] Ripristinare le risposte normali
- [ ] Attendere il retry automatico (backoff: 1s, 2s, 4s...)
- [ ] Verificare sync completata nel pannello debug

### 7. Idempotenza (doppio invio)
- [ ] Inviare la stessa operazione due volte (simulabile con `operationId` duplicato via console)
- [ ] Verificare che il backend risponda `ok: true, idempotent: true` alla seconda richiesta
- [ ] Verificare che il dato non sia duplicato in database

---

## Criteri di Done

- [ ] 0 errori console bloccanti nei flussi core (offline/online/save/sync)
- [ ] Badge rete e badge coda funzionanti e visibili
- [ ] Pannello debug mostra ultime 20 operazioni con status corretti
- [ ] Feedback "Salvato sul server" / "Salvato in locale" visibile nella modale
- [ ] Dati non persi dopo 5+ minuti in modalità offline con salvataggi multipli
- [ ] App installabile su Chrome Desktop e Android
- [ ] Test automatici: `npm run test` → 0 fallimenti

---

## Post-rilascio

- [ ] Monitorare la tabella `sync_operations` nei primi giorni: verificare operazioni con `outcome = 'success'`
- [ ] Verificare assenza di operazioni bloccate in `pending` per oltre 1 ora
- [ ] Comunicare agli utenti la procedura di aggiornamento SW (vedi `architettura-offline-first.md`)
