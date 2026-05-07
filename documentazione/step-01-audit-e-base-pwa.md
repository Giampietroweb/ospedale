# Step 01 - Audit e base PWA

## Obiettivo dello step
Preparare il progetto per essere installabile come PWA, senza introdurre ancora la logica offline-first di persistenza dati.

## Prompt da lanciare
```text
Sei nel progetto "ospedale". Implementa lo Step 01 per avviare la trasformazione in PWA.

Contesto tecnico:
- Progetto web multipagina con file principali: index.html, piani/planimetria.html, estrazioni.html, cataloghi.html, script.js, estrazioni.js, cataloghi.js, style.css.
- Backend PHP in /api.
- Attualmente alcune dipendenze CSS/JS sono caricate da CDN.

Obiettivo:
1) Rendere l'app installabile come PWA.
2) Preparare una base coerente per gli step successivi (service worker e offline data sync).
3) Non introdurre ancora la coda offline dei salvataggi.

Vincoli:
- Mantieni compatibilita` con l'architettura attuale (vanilla JS + PHP).
- Non rompere i flussi esistenti.
- Usa naming chiaro e commenti solo dove serve.

Attivita` richieste:
1. Crea `manifest.webmanifest` con:
   - name, short_name, start_url, display=standalone, background_color, theme_color, icons.
2. Aggiungi icone app (placeholder se non disponibili) in una cartella dedicata, es. `assets/icons/`.
3. Aggiorna tutte le pagine HTML principali (`index.html`, `piani/planimetria.html`, `estrazioni.html`, `cataloghi.html`):
   - `<link rel="manifest" href="...">` con path corretto.
   - `<meta name="theme-color" ...>`.
   - hook di bootstrap per registrazione service worker (solo preparazione; il file SW verra` popolato dopo).
4. Crea un file `pwa-register.js` (o nome equivalente) che registri il service worker in modo robusto:
   - controlli su `serviceWorker` support.
   - log minimi utili in dev.
   - nessun errore bloccante in UI.
5. Esegui un check dei path relativi da pagine in sottocartella (`piani/`) per evitare rotture.

Output atteso:
- Elenco file creati/modificati.
- Spiegazione sintetica delle scelte.
- Check rapido su installabilita` (manifest valido + SW registrabile).

Importantissimo:
- Non implementare ancora cache strategica o logica outbox.
- Se trovi dipendenze CDN critiche per l'offline, segnale in nota ma non migrare in questo step.
```
