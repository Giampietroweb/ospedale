# Report Analisi Bug, Inaccuratezze e Feature Mancanti

> Generato: 27 aprile 2026  
> Progetto: Ospedale — Gestione Planimetrie e Dotazioni  
> Analizzato: `index.html`, `estrazioni.html`, `piani/planimetria.html`, `script.js`, `estrazioni.js`, `style.css`, tutti i file `api/*.php`, `database/schema.sql`

---

## Legenda priorità

| Simbolo | Priorità | Descrizione |
|---------|----------|-------------|
| 🔴 | **Critico** | Rischio sicurezza o perdita dati |
| 🟠 | **Alto** | Bug o regressione concreta in produzione |
| 🟡 | **Medio** | Comportamento inatteso o degradante |
| 🟢 | **Basso** | Qualità del codice, UX, manutenibilità |
| 🔵 | **Feature** | Funzionalità mancante o miglioramento significativo |

---

## Step 1 — `.env` non in `.gitignore` 🔴

**File:** `.gitignore`  
**Problema:** Il file `.env` contiene credenziali di database (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`) in chiaro. Il `.gitignore` attuale esclude solo `/vendor/`, quindi `.env` può essere committato accidentalmente ed esposto nel repository.

**Impatto:** Se il repository viene reso pubblico o condiviso, le credenziali del database sono compromesse.

---

**Prompt di risoluzione:**

```
Nel file `.gitignore` del progetto, aggiungi le seguenti righe per escludere il file .env e altri file sensibili dal tracciamento git:

.env
.env.local
.env.*.local
*.log
.DS_Store

Poi crea un file `.env.example` nella root del progetto con le stesse chiavi di `.env` ma con valori placeholder, in modo da documentare le variabili necessarie senza esporre credenziali reali. Esempio:

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ospedale
DB_USER=utente_db
DB_PASS=password_sicura

Verifica con `git status` che .env non appaia tra i file tracciati. Se appare già nello storico git, esegui:
  git rm --cached .env
  git commit -m "fix: rimuovi .env dal tracking git"
```

---

## Step 2 — API senza autenticazione né protezione CSRF 🔴

**File:** `api/save-modal.php`, `api/get-room.php`, `api/get-rooms-for-floor.php`, `api/estrazioni.php`, `api/estrazioni-export.php`  
**Problema:** Tutti gli endpoint sono completamente aperti. Chiunque raggiunga il server può:
- Leggere i dati di tutte le stanze (`get-room.php`, `get-rooms-for-floor.php`, `estrazioni.php`)
- Scrivere, modificare o cancellare apparecchiature e dati di stanza (`save-modal.php`)
- Scaricare l'intera banca dati in formato Excel (`estrazioni-export.php`)

Non esiste alcun meccanismo di autenticazione (session, token, JWT) né header CSRF.

---

**Prompt di risoluzione:**

```
Implementa un sistema di autenticazione base per le API PHP del progetto ospedale.

Approccio minimo consigliato (autenticazione tramite token Bearer statico o sessione PHP):

1. Crea `api/auth.php` con una funzione `requireAuth(): void` che:
   - Legge il token dall'header Authorization (Bearer <token>) oppure da $_SESSION
   - Se non valido, risponde HTTP 401 con JSON {"ok": false, "error": "Non autorizzato"} e fa exit
   - Il token valido può essere letto da una variabile d'ambiente API_TOKEN nel .env

2. Aggiungi all'inizio di ogni file API (save-modal.php, get-room.php, get-rooms-for-floor.php, estrazioni.php, estrazioni-export.php) la chiamata:
   require __DIR__ . '/auth.php';
   requireAuth();

3. Per save-modal.php aggiungi anche validazione CSRF: il front-end deve inviare nell'header un token X-CSRF-Token che il server verifica corrisponda a quello della sessione corrente.

4. In alternativa, se l'app è ospitata su un server con accesso riservato alla rete ospedaliera, documenta esplicitamente che la sicurezza perimetrale di rete è il meccanismo di protezione, e aggiungi almeno un IP whitelist a livello Apache/Nginx.

Aggiorna anche il .env con:
  API_TOKEN=<token casuale sicuro, es. openssl rand -hex 32>

Aggiorna il front-end (script.js, estrazioni.js) per inviare il token negli header fetch.
```

---

## Step 3 — Funzioni PHP duplicate tra file API 🟠

**File:** `api/get-room.php` (righe 22–55), `api/get-rooms-for-floor.php` (righe 15–26), `api/estrazioni-query.php` (righe 8–41)  
**Problema:** Le funzioni `normalizeInventoryCode`, `normalizeInventoryListForResponse` / `estrazioniNormalizeInventoryListForResponse` e `errorResponse` sono definite più volte con logica identica o quasi identica. Violazione del principio DRY; ogni bugfix va applicato in più posti.

---

**Prompt di risoluzione:**

```
Crea un file condiviso `api/utils.php` che centralizzi le funzioni utility comuni tra i file API PHP.

Sposta in `api/utils.php` le seguenti funzioni (rimuovendole dai file originali):
- `normalizeInventoryCode(mixed $value): string` — presente in get-room.php e get-rooms-for-floor.php
- `normalizeInventoryListForResponse(mixed $value): array` — versione da get-room.php (logica identica a estrazioniNormalizeInventoryListForResponse in estrazioni-query.php)
- Una funzione generica `apiErrorResponse(string $message, int $statusCode = 400): void` che sostituisca le funzioni locali `errorResponse` e `jsonError`

In `api/utils.php` usa `declare(strict_types=1)` e non includere `database.php` (per evitare dipendenze circolari).

Nei file che usavano queste funzioni aggiungi `require __DIR__ . '/utils.php';` in cima.

Aggiorna anche `estrazioni-query.php` per usare `normalizeInventoryListForResponse` invece di `estrazioniNormalizeInventoryListForResponse`, allineando i nomi.
```

---

## Step 4 — `saveApparecchiaturaRow` identifica le righe per posizione (`sort_order`), non per ID 🟠

**File:** `api/save-modal.php` (righe 412–414)  
**Problema:** Il salvataggio di una riga apparecchiatura esegue prima `DELETE FROM room_apparecchiature WHERE room_id = :room_id AND sort_order = :sort_order` e poi reinserta. Questo significa che:
- Se due righe hanno lo stesso `sort_order` (situazione possibile se il front-end le invia non allineate), entrambe vengono cancellate.
- Non è possibile riordinare le righe senza rischiare di sovrascrivere dati.
- Mancanza di un ID univoco di riga lato client rende l'operazione fragile.

La stessa logica delete-by-key vale per `saveImpiantisticaRow` (match per `tipologia`) e `saveAltreDotazioniRow` (match per `altra_dotazione`): due righe con la stessa tipologia/altra_dotazione si cancellano a vicenda.

---

**Prompt di risoluzione:**

```
Modifica la strategia di salvataggio delle righe in `save-modal.php` per usare un identificatore stabile invece della posizione/tipologia.

Per `saveApparecchiaturaRow`:
1. Aggiungi un campo `rowId` nel payload (opzionale, UUID o intero assegnato dal front-end al momento della creazione della riga).
2. In `room_apparecchiature` aggiungi una colonna `row_uuid VARCHAR(36) NULL` (generata lato client con `crypto.randomUUID()`).
3. In `save-modal.php`, se `rowId` è presente nel payload, il DELETE diventa `DELETE FROM room_apparecchiature WHERE room_id = :room_id AND row_uuid = :row_uuid`.
4. In `script.js`, al momento della creazione di una nuova riga apparecchiatura, assegna `dataset.rowUuid = crypto.randomUUID()` alla riga DOM e includinlo nel payload di salvataggio.

Per `saveImpiantisticaRow` e `saveAltreDotazioniRow`, dato che la tipologia/altra_dotazione è la chiave semantica della riga, è accettabile mantenere il match per nome — ma aggiungi una UNIQUE KEY su `(room_id, tipologia)` in `room_impiantistica` e `(room_id, altra_dotazione)` in `room_altre_dotazioni` per rendere esplicito il vincolo a livello di schema e usare `INSERT ... ON DUPLICATE KEY UPDATE` invece di DELETE+INSERT.

Aggiungi la migrazione SQL in `database/migrations/001_add_row_uuid.sql`.
```

---

## Step 5 — `postiLetto` salvato con `PDO::PARAM_STR` invece di `PDO::PARAM_INT` 🟡

**File:** `api/save-modal.php` (riga 282)  
**Problema:** Quando `fieldName === 'postiLetto'`, il valore viene convertito in int da `asNullableInt()`, ma nel bind viene sempre usato `PDO::PARAM_STR` (a meno che sia null). Sebbene MySQL accetti la coercizione, il tipo non è corretto e può causare comportamenti imprevisti con strict mode.

```php
// riga 282 attuale — usa PARAM_STR anche per interi
$updateStatement->bindValue(':value', $boundValue, $boundValue === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
```

---

**Prompt di risoluzione:**

```
In `api/save-modal.php`, alla riga del bind del campo `postiLetto` (saveField, riga ~282), correggi il tipo PDO:

Sostituisci:
  $updateStatement->bindValue(':value', $boundValue, $boundValue === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

Con:
  $pdoType = PDO::PARAM_STR;
  if ($boundValue === null) {
      $pdoType = PDO::PARAM_NULL;
  } elseif ($fieldName === 'postiLetto') {
      $pdoType = PDO::PARAM_INT;
  }
  $updateStatement->bindValue(':value', $boundValue, $pdoType);

Applica lo stesso criterio nella funzione `syncAutoAttributesIfEmpty` (riga ~198) dove il tipo è già gestito correttamente con `is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR` — verifica che il valore passato per `postiLetto` sia effettivamente un `int` e non uno string numerico dopo `asNullableInt`.
```

---

## Step 6 — `console.log` in produzione in `script.js` 🟡

**File:** `script.js`  
**Problema:** Il file `script.js` contiene numerose chiamate a `console.log` usate per debug che rimangono attive in produzione. Questo espone dettagli interni dell'applicazione (payload, strutture dati, codici stanza) nella console del browser di chiunque utilizzi il sistema.

---

**Prompt di risoluzione:**

```
In `script.js`, rimuovi o disabilita tutti i `console.log` di debug prima del deploy in produzione.

Approccio raccomandato: sostituisci tutti i `console.log(` con una funzione di logging condizionale da definire in cima al file:

  const DEBUG = false; // impostare a true solo in sviluppo locale
  const debugLog = (...args) => { if (DEBUG) console.log(...args); };

Poi sostituisci globalmente `console.log(` con `debugLog(` in tutto il file (usa trova e sostituisci nell'IDE).

Mantieni `console.error(` per gli errori reali (sono utili anche in produzione per diagnostica).

Fai lo stesso in `estrazioni.js`.
```

---

## Step 7 — `meta` tag `noindex` ripetuti e Tailwind CDN solo su `index.html` 🟢

**File:** `index.html` (righe 7–12)  
**Problema:**
1. Il meta tag `<meta name="sogou" content="noodp" />` appare tre volte consecutivamente.
2. Tailwind CSS viene caricato da CDN solo su `index.html`, mentre le altre pagine usano `style.css` personalizzato — incoerenza stilistica.

---

**Prompt di risoluzione:**

```
In `index.html`:
1. Rimuovi i meta tag `noindex` duplicati. Mantieni solo una istanza per ciascun motore di ricerca. Verifica che non ci siano ripetizioni con:
   grep -n "noindex\|sogou\|slurp\|yandex" index.html

2. Valuta se Tailwind CDN è ancora necessario su `index.html`. Se le classi Tailwind usate sono poche (es. solo flex, grid, padding), considera di sostituirle con classi CSS in `style.css` per eliminare la dipendenza CDN esterna e uniformare il comportamento offline. Se invece si preferisce mantenere Tailwind, aggiungi il CDN anche nelle altre pagine o adotta un approccio build (Tailwind CLI) per tutte le pagine.
```

---

## Step 8 — `loader` con tempo minimo hardcoded di 2 secondi 🟢

**File:** `script.js` (costante `mapLoadMinMs = 2000`)  
**Problema:** Il loader della mappa ha un tempo minimo di visualizzazione di 2 secondi hardcoded. Se l'SVG si carica velocemente (es. da cache locale), l'utente aspetta inutilmente 2 secondi. Il valore non è configurabile.

---

**Prompt di risoluzione:**

```
In `script.js`, rendi il tempo minimo del loader configurabile e riducilo a un valore più appropriato:

1. Sostituisci `const mapLoadMinMs = 2000;` con `const mapLoadMinMs = 400;` — 400ms è sufficiente per evitare il flash del loader per caricamenti rapidi.

2. Oppure rimuovi completamente il tempo minimo artificiale e mostra/nascondi il loader in modo reattivo all'effettivo completamento del caricamento SVG e dei dati JSON/API.

3. Se si vuole mantenere un minimo per ragioni UX (evitare flickering), usa `const mapLoadMinMs = 300;` (valore percettivamente invisibile ma sufficiente).
```

---

## Step 9 — Asset mancanti: SVG planimetrie e file JSON occorrenze 🟠

**Problema:** Il progetto funziona solo se nella cartella `planimetrie/` sono presenti:
- Un file SVG per ogni piano (es. `nord-0.svg`, `nord-1.svg`, ..., `sud-0.svg`, ecc.)
- Un file JSON per ogni piano (es. `occorenze-nord-0.json`, `occorenze-nord-1.json`, ecc.)

Nel repository è presente solo `occorenze-nord-6.json`. Nessun SVG è versionato. Senza questi file la planimetria mostra solo un errore.

**Ulteriore problema:** Il nome del file JSON usa `occorenze` (con una sola 'r'), che è un errore ortografico. Se i file vengono rinominati in `occorrenze` occorre aggiornare il riferimento in `script.js`.

---

**Prompt di risoluzione:**

```
1. Crea e versiona (o documenta come ottenere) i file SVG delle planimetrie in `planimetrie/`:
   - Nomina i file secondo la convezione `{blocco}-{piano}.svg` (es. `nord-0.svg`, `sud-3.svg`, `sotterraneo-1.svg`)
   - Gli SVG devono avere gli elementi `<text>` con codice stanza nel formato `*CODICE*` per essere riconosciuti da `script.js`

2. Crea e versiona i file JSON delle occorrenze in `planimetrie/`:
   - Nomina i file `occorrenze-{blocco}-{piano}.json` (correggendo il refuso "occorenze" → "occorrenze")
   - Oppure mantieni la grafia attuale `occorenze` se i file reali la usano, purché sia coerente

3. In `script.js`, allinea la funzione `loadOccurrencesData(floorName)` con il nome file effettivo:
   - Se si adotta la correzione ortografica: `fetch(\`../planimetrie/occorrenze-\${floorName}.json\`)`
   - Verifica anche il nome del file `occorenze-nord-6.json` già presente e rinominalo di conseguenza

4. Aggiungi a `.gitignore` un commento che spieghi perché gli SVG potrebbero non essere versionati (dimensioni, diritti) o aggiungi istruzioni nel README su come ottenerli.
```

---

## Step 10 — `reparto` mancante da `autoFieldMap` in `save-modal.php` 🟡

**File:** `api/save-modal.php` (righe 214–222)  
**Problema:** Il campo `reparto` è presente in `allowedFieldMap` (può essere salvato manualmente), ma **non è in `autoFieldMap`**. Questo significa che quando viene creata una nuova stanza e il JSON delle occorrenze contiene il reparto, il campo non viene popolato automaticamente. L'utente deve salvarlo manualmente la prima volta.

Confronto:

```php
// allowedFieldMap — include reparto
$allowedFieldMap = ['roomCodeName', 'occupazione', 'reparto', 'superficie', ...];

// autoFieldMap — NON include reparto
$autoFieldMap = ['roomCodeName', 'occupazione', 'superficie', ...]; // reparto assente
```

---

**Prompt di risoluzione:**

```
In `api/save-modal.php`, valuta se aggiungere `reparto` all'`$autoFieldMap`.

Se il reparto deve essere pre-popolato dai dati JSON delle occorrenze alla prima apertura della stanza (comportamento coerente con gli altri attributi auto), aggiungi la riga:

  'reparto' => 'reparto',

all'interno di `$autoFieldMap` (dopo 'occupazione', riga ~217).

Verifica nel front-end (`script.js`) che il payload `autoAttributes` invii effettivamente il campo `reparto` quando disponibile nel JSON delle occorrenze. Cerca la costruzione dell'oggetto `autoAttributes` in `script.js` e aggiungi `reparto` se mancante.

Se invece il reparto deve essere impostato solo manualmente (perché può differire dai dati di pianificazione), lascia `autoFieldMap` invariato ma aggiungi un commento in `save-modal.php` che spieghi la scelta.
```

---

## Step 11 — Assenza di indice composito su `sort_order` in `room_apparecchiature` 🟡

**File:** `database/schema.sql`  
**Problema:** In `save-modal.php` l'operazione `DELETE FROM room_apparecchiature WHERE room_id = :room_id AND sort_order = :sort_order` usa due colonne. C'è un indice su `room_id` (`idx_room_apparecchiature_room_id`), ma non un indice composito `(room_id, sort_order)`. Per tabelle grandi la query usa l'indice singolo e poi filtra su `sort_order` in memoria.

---

**Prompt di risoluzione:**

```
In `database/schema.sql`, aggiungi un indice composito alla tabella `room_apparecchiature`:

  KEY idx_room_apparecchiature_room_sort (room_id, sort_order)

Stessa cosa per `room_impiantistica` (usata con `WHERE room_id = ? AND tipologia = ?`):

  KEY idx_room_impiantistica_room_tipologia (room_id, tipologia)

E per `room_altre_dotazioni` (usata con `WHERE room_id = ? AND altra_dotazione = ?`):

  KEY idx_room_altre_dotazioni_room_dotazione (room_id, altra_dotazione)

Crea un file di migrazione `database/migrations/002_add_composite_indexes.sql` con le istruzioni ALTER TABLE corrispondenti per i database già esistenti.
```

---

## Step 12 — Nessun `README.md` operativo 🔵

**Problema:** Non esiste un `README.md` nella root del progetto. Non c'è documentazione su come installare le dipendenze, configurare il database, avviare Docker, ottenere gli SVG o accedere all'applicazione.

---

**Prompt di risoluzione:**

```
Crea un file `README.md` nella root del progetto con le seguenti sezioni:

# Ospedale — Gestione Planimetrie e Dotazioni

## Descrizione
Breve descrizione dell'applicativo.

## Requisiti
- Docker e Docker Compose (versione minima)
- Oppure: PHP 8.2+, MySQL 8.x, Composer

## Setup con Docker
1. Copia `.env.example` in `.env` e compila le variabili
2. `docker-compose up -d`
3. Accedi a http://localhost:8000

## Setup manuale
1. Copia `.env.example` in `.env`
2. Crea il database e importa `database/schema.sql`
3. `composer install` (nella root del progetto)
4. Configura un virtual host Apache/Nginx che punti alla root

## Asset planimetrie
Spiega dove ottenere/posizionare i file SVG e JSON nella cartella `planimetrie/`

## Export Excel
Richiede Composer: `composer install` genera la cartella `vendor/` necessaria per `estrazioni-export.php`

## Struttura del progetto
Breve descrizione delle cartelle principali
```

---

## Step 13 — Autenticazione e gestione ruoli utente 🔵

**Problema:** L'applicazione non distingue tra utenti in sola lettura e utenti con permesso di scrittura. Chiunque acceda alla planimetria può modificare i dati di tutte le stanze. Non c'è tracciabilità di chi ha fatto cosa.

---

**Prompt di risoluzione:**

```
Implementa un sistema di autenticazione e ruoli per il progetto ospedale.

Opzione A — Autenticazione semplice con sessioni PHP:
1. Crea `api/login.php` (POST: username + password → imposta sessione)
2. Crea `api/logout.php`
3. Definisci due ruoli: `viewer` (sola lettura) e `editor` (lettura + scrittura)
4. `requireAuth()` verifica la sessione; `requireRole('editor')` usato in `save-modal.php`
5. Aggiungi tabella `users (id, username, password_hash, role, created_at)` in un nuovo file di migrazione
6. Aggiungi una pagina di login HTML

Opzione B — Integrazione con sistema SSO ospedaliero (se esistente):
1. Configura autenticazione via LDAP o SAML verso il provider d'identità ospedaliero
2. Usa una libreria PHP come `simplesamlphp/simplesamlphp` o `directorytree/ldaprecord`

In entrambi i casi:
- Le API di lettura possono restare accessibili a `viewer`
- `save-modal.php` richiede ruolo `editor`
- `estrazioni-export.php` può richiedere ruolo `viewer` o `editor`
```

---

## Step 14 — Audit log: tracciamento delle modifiche 🔵

**Problema:** Non c'è traccia di chi ha modificato cosa e quando. In un contesto ospedaliero la tracciabilità è spesso un requisito normativo.

---

**Prompt di risoluzione:**

```
Aggiungi una tabella di audit log al database e la relativa logica di scrittura.

1. Aggiungi in `database/migrations/003_add_audit_log.sql`:

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  user_label VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  room_id BIGINT UNSIGNED NULL,
  payload_before JSON NULL,
  payload_after JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_room_id (room_id),
  KEY idx_audit_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

2. In `api/save-modal.php`, dopo ogni operazione di salvataggio riuscita, inserisci un record in `audit_log` con:
   - `action`: il valore di `$action`
   - `entity_type`: 'room_apparecchiature' | 'room_impiantistica' | ecc.
   - `room_id`: l'ID della stanza
   - `payload_after`: JSON del payload ricevuto
   - `ip_address`: `$_SERVER['REMOTE_ADDR']`

3. Crea `api/get-audit-log.php` (richiede ruolo admin) per consultare lo storico.
```

---

## Step 15 — Migrazioni database versionate 🔵

**Problema:** Esiste solo `database/schema.sql` (schema iniziale). Non ci sono migrazioni versionate, quindi è impossibile aggiornare un database già in produzione in modo controllato.

---

**Prompt di risoluzione:**

```
Introduci un sistema di migrazioni database versionate per il progetto.

Opzione A — Script shell semplice:
1. Crea la cartella `database/migrations/` con file numerati: `001_schema_iniziale.sql`, `002_add_composite_indexes.sql`, ecc.
2. Crea `database/migrate.sh` che legge una tabella `schema_migrations (version VARCHAR(50), applied_at TIMESTAMP)` e applica solo le migrazioni non ancora applicate, in ordine crescente.

Opzione B — Flyway o Phinx:
1. Aggiungi `robmorgan/phinx` a `composer.json`
2. Configura `phinx.php` con le stesse variabili del `.env`
3. Crea le migration class in PHP per ogni step di schema

In entrambi i casi, aggiorna il `docker-compose.yml` per eseguire le migrazioni all'avvio del container `web` (comando entrypoint).
```

---

## Riepilogo

| # | Step | Priorità | File coinvolti |
|---|------|----------|----------------|
| 1 | `.env` non in `.gitignore` | 🔴 Critico | `.gitignore` |
| 2 | API senza autenticazione/CSRF | 🔴 Critico | `api/*.php` |
| 3 | Funzioni PHP duplicate tra API | 🟠 Alto | `api/get-room.php`, `api/get-rooms-for-floor.php`, `api/estrazioni-query.php` |
| 4 | Righe apparecchiature identificate per posizione | 🟠 Alto | `api/save-modal.php`, `script.js` |
| 5 | `postiLetto` bindato con `PARAM_STR` | 🟡 Medio | `api/save-modal.php` |
| 6 | `console.log` in produzione | 🟡 Medio | `script.js`, `estrazioni.js` |
| 7 | Meta duplicati e Tailwind incoerente | 🟢 Basso | `index.html` |
| 8 | Loader con tempo minimo hardcoded | 🟢 Basso | `script.js` |
| 9 | Asset SVG/JSON mancanti o naming incoerente | 🟠 Alto | `planimetrie/`, `script.js` |
| 10 | `reparto` assente da `autoFieldMap` | 🟡 Medio | `api/save-modal.php` |
| 11 | Indici compositi mancanti | 🟡 Medio | `database/schema.sql` |
| 12 | README operativo mancante | 🔵 Feature | — |
| 13 | Autenticazione e ruoli | 🔵 Feature | `api/`, HTML |
| 14 | Audit log modifiche | 🔵 Feature | `database/`, `api/save-modal.php` |
| 15 | Migrazioni database versionate | 🔵 Feature | `database/` |
