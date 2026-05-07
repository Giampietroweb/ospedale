# Step 03 - Cache runtime, API GET e dipendenze locali

## Obiettivo dello step
Rendere robusto l'offline per dati in sola lettura e rimuovere dipendenze critiche da CDN.

## Prompt da lanciare
```text
Implementa lo Step 03 nel progetto "ospedale": runtime caching per GET e migrazione dipendenze CDN critiche in locale.

Contesto:
- Service worker base con precache gia` presente.
- Alcune pagine caricano risorse da CDN (es. Tailwind CDN, Tom Select CDN).

Obiettivo:
1) Evitare dipendenza dalla rete per librerie essenziali.
2) Gestire GET API in modo offline-friendly.

Attivita` richieste:
1. Individua dipendenze esterne attualmente in CDN nelle pagine HTML.
2. Porta in locale (cartella `vendor/` o `assets/vendor/`) i file necessari per il runtime:
   - CSS/JS di Tom Select.
   - qualunque altra libreria indispensabile alla UI core.
3. Aggiorna riferimenti HTML ai nuovi path locali.
4. Estendi `service-worker.js`:
   - separa cache in namespace (es. `app-shell`, `runtime-assets`, `runtime-api`).
   - strategia cache-first per statici non critici.
   - strategia network-first con fallback cache per GET API:
     - `/api/get-room.php`
     - `/api/get-rooms-for-floor.php`
     - `/api/catalogs.php?action=list...`
5. Implementa helper nel SW per distinguere:
   - richieste navigazione
   - static assets
   - API GET.
6. Aggiungi timeout ragionevole lato network-first (es. 3-5s) prima del fallback cache.

Vincoli:
- Nessuna modifica ai POST in questo step.
- Niente logica outbox qui.
- Mantieni backward compatibility dei path.

Output atteso:
- Elenco dipendenze migrate da CDN a locale.
- Spiegazione delle strategie cache per categoria.
- Verifica manuale: con offline attivo, pagine apribili e ultime GET disponibili.
```
