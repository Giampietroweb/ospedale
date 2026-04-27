# Documentazione — Ospedale: Gestione Planimetrie e Dotazioni

> Versione documento: 1.0 — 27 aprile 2026

---

## Indice

1. [Panoramica generale](#1-panoramica-generale)
2. [Stack tecnologico](#2-stack-tecnologico)
3. [Struttura del progetto](#3-struttura-del-progetto)
4. [Schema del database](#4-schema-del-database)
5. [Architettura applicativa](#5-architettura-applicativa)
6. [Pagine frontend](#6-pagine-frontend)
7. [API backend](#7-api-backend)
8. [Flusso applicativo](#8-flusso-applicativo)
9. [Configurazione e deploy](#9-configurazione-e-deploy)
10. [Dipendenze esterne](#10-dipendenze-esterne)
11. [Limitazioni note e sviluppi futuri](#11-limitazioni-note-e-sviluppi-futuri)

---

## 1. Panoramica generale

L'applicazione è un sistema web per la **gestione delle planimetrie ospedaliere** e il censimento delle dotazioni (apparecchiature medicali, impiantistica, altre dotazioni) presenti in ogni locale dell'ospedale.

### Obiettivo principale

Permettere al personale autorizzato di:

- Navigare la struttura ospedaliera per **blocco** (Nord, Sud, Piastra Centrale, Interrato) e **piano**
- Visualizzare una **planimetria SVG interattiva** di ogni piano
- Cliccare su ogni stanza per aprire un pannello di dettaglio con i dati del locale
- **Modificare e salvare** in tempo reale attributi della stanza, apparecchiature, impianti e altre dotazioni
- **Estrarre e scaricare** i dati in formato Excel con filtri per blocco, piano, reparto, stanza e tipologia

### Struttura ospedaliera gestita

| Sezione | Piani |
|---------|-------|
| Torre Nord | 0 → 6 |
| Torre Sud | 0 → 6 |
| Piastra Centrale | 0, 1, 2 |
| Interrato | -1, -2 |

---

## 2. Stack tecnologico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Front-end | HTML5, CSS3, JavaScript (vanilla ES2022+) | Nessun framework JS |
| Stili | CSS personalizzato (`style.css`) | Tailwind CDN solo su `index.html` |
| Select avanzate | [Tom Select](https://tom-select.js.org/) | Caricato da CDN |
| Back-end | PHP 8.2+ (`declare(strict_types=1)`) | Tutti i file API |
| Database | MySQL 8.x | Charset `utf8mb4_unicode_ci` |
| ORM/DB layer | PDO + prepared statements | Nessun ORM |
| Export Excel | `phpoffice/phpspreadsheet` | Via Composer |
| Containerizzazione | Docker + Docker Compose | PHP 8.2-Apache + MySQL 8.4 + phpMyAdmin |
| Mappa | File SVG statici | Caricati come `<object>` nel browser |

---

## 3. Struttura del progetto

```
ospedale/
├── index.html                    # Home page — navigazione per blocco/piano
├── estrazioni.html               # Pagina filtri ed export dati
├── estrazioni.js                 # Logica front-end estrazioni
├── script.js                     # Logica front-end planimetria (~2978 righe)
├── style.css                     # Foglio di stile globale (~1090 righe)
│
├── piani/
│   └── planimetria.html          # Viewer planimetria (riceve ?piano=blocco-N)
│
├── planimetrie/
│   ├── {blocco}-{piano}.svg      # [RICHIESTO] SVG planimetria per ogni piano
│   └── occorenze-{blocco}-{piano}.json  # [RICHIESTO] Dati occorrenze da pianificazione
│
├── api/
│   ├── config.php                # Carica variabili d'ambiente da .env
│   ├── database.php              # Factory PDO — getDatabaseConnection()
│   ├── utils.php                 # [CONSIGLIATO] Utility condivise (attualmente mancante)
│   ├── get-room.php              # GET: dati completi di una stanza
│   ├── get-rooms-for-floor.php   # GET: stanze presenti in DB per un piano
│   ├── save-modal.php            # POST: salvataggio dati stanza/dotazioni
│   ├── estrazioni.php            # GET: opzioni filtro + ricerca dati
│   ├── estrazioni-query.php      # Libreria query + helper per estrazioni
│   ├── estrazioni-export.php     # GET: download XLSX
│   └── test-db.php               # Health check database
│
├── database/
│   └── schema.sql                # DDL iniziale delle 4 tabelle
│
├── docker/
│   └── php/
│       └── Dockerfile            # php:8.2-apache + pdo_mysql
│
├── .env                          # Variabili d'ambiente (NON versionare)
├── .env.example                  # Template variabili (da creare)
├── docker-compose.yml            # Stack Docker completo
├── composer.json                 # Dipendenze PHP (phpspreadsheet)
├── composer.lock
├── DEPENDENCIES.txt              # Istruzioni Composer
└── documentazione-regole.md     # Regole formato SVG planimetrie
```

---

## 4. Schema del database

Il database è composto da 4 tabelle con relazioni one-to-many. Tutte le tabelle usano `ENGINE=InnoDB`, `utf8mb4_unicode_ci`, e hanno campi `created_at` / `updated_at` con gestione automatica.

### 4.1 Tabella `rooms`

Anagrafica dei locali. Un locale è identificato univocamente dalla tripletta `(blocco, piano, room_code)`.

| Colonna | Tipo | Nullable | Descrizione |
|---------|------|----------|-------------|
| `id` | BIGINT UNSIGNED PK | No | Auto-increment |
| `blocco` | VARCHAR(30) | No | `nord` \| `sud` \| `piastra` \| `sotterraneo` |
| `piano` | VARCHAR(20) | No | Numero intero come stringa (es. `"3"`, `"-1"`) |
| `room_code` | VARCHAR(100) | No | Codice identificativo stanza (es. `P6-010`) |
| `room_code_name` | VARCHAR(255) | Sì | Nome descrittivo del locale |
| `occupazione` | VARCHAR(255) | Sì | Tipo di occupazione/destinazione |
| `reparto` | VARCHAR(255) | Sì | Reparto di afferenza |
| `superficie` | VARCHAR(50) | Sì | Superficie in m² (formato libero) |
| `emipiano` | VARCHAR(20) | Sì | Sotto-zona del piano (es. `A`, `B`) |
| `accreditamento_locale` | VARCHAR(255) | Sì | Tipologia accreditamento |
| `posti_letto` | INT | Sì | Numero posti letto |
| `note_arredi_segnaletica` | TEXT | Sì | Note libere su arredi e segnaletica |
| `created_at` | TIMESTAMP | No | Inserimento automatico |
| `updated_at` | TIMESTAMP | No | Aggiornamento automatico |

**Indici:** UNIQUE su `(blocco, piano, room_code)`, KEY su `(blocco, piano)`, KEY su `room_code`.

> **Nota:** La tabella viene creata automaticamente al primo salvataggio di un campo non vuoto (logica lazy insert in `ensureRoomExists`).

---

### 4.2 Tabella `room_apparecchiature`

Elenco delle apparecchiature presenti in ogni stanza. Una stanza può avere N righe.

| Colonna | Tipo | Nullable | Descrizione |
|---------|------|----------|-------------|
| `id` | BIGINT UNSIGNED PK | No | Auto-increment |
| `room_id` | BIGINT UNSIGNED FK | No | Riferimento a `rooms.id` (CASCADE DELETE) |
| `apparecchiatura` | VARCHAR(255) | Sì | Nome apparecchiatura (da catalogo o libero) |
| `tipologia` | VARCHAR(100) | Sì | Tipologia di ancoraggio/installazione |
| `produttore` | VARCHAR(255) | Sì | Produttore |
| `modello` | VARCHAR(255) | Sì | Modello |
| `qta` | VARCHAR(50) | Sì | Quantità (formato libero) |
| `nuovo` | VARCHAR(20) | Sì | Flag "nuovo acquisto" |
| `trasferimento` | VARCHAR(20) | Sì | Flag "trasferimento da altro reparto" |
| `inv` | TEXT | Sì | Numeri inventario serializzati come array JSON (es. `["INV001","INV002"]`) |
| `note` | TEXT | Sì | Note libere |
| `sort_order` | INT UNSIGNED | No | Ordinamento riga (corrisponde all'indice DOM) |

**Relazione:** `room_id` → `rooms.id` ON DELETE CASCADE.

---

### 4.3 Tabella `room_impiantistica`

Dotazioni impiantistiche di ogni stanza (prese elettriche, gas medicali, rete dati, ecc.).

| Colonna | Tipo | Nullable | Descrizione |
|---------|------|----------|-------------|
| `id` | BIGINT UNSIGNED PK | No | Auto-increment |
| `room_id` | BIGINT UNSIGNED FK | No | Riferimento a `rooms.id` |
| `tipologia` | VARCHAR(255) | No | Tipo di impianto (chiave semantica della riga) |
| `qta_presenti` | INT | Sì | Quantità già installata |
| `qta_da_implementare` | INT | Sì | Quantità da installare |
| `note` | TEXT | Sì | Note libere |
| `sort_order` | INT UNSIGNED | No | Ordinamento |

**Nota:** La coppia `(room_id, tipologia)` è l'identificatore funzionale della riga; un DELETE+INSERT su questa coppia viene eseguito ad ogni salvataggio.

---

### 4.4 Tabella `room_altre_dotazioni`

Altre dotazioni (badge lettore, videosorveglianza, chiamata infermiera, ecc.).

| Colonna | Tipo | Nullable | Descrizione |
|---------|------|----------|-------------|
| `id` | BIGINT UNSIGNED PK | No | Auto-increment |
| `room_id` | BIGINT UNSIGNED FK | No | Riferimento a `rooms.id` |
| `altra_dotazione` | VARCHAR(255) | No | Nome dotazione (chiave semantica della riga) |
| `presente` | ENUM(`Si`, `No`) | Sì | Indica se è già presente |
| `da_implementare` | ENUM(`Si`, `No`) | Sì | Indica se è da implementare |
| `note` | TEXT | Sì | Note libere |
| `sort_order` | INT UNSIGNED | No | Ordinamento |

---

### 4.5 Diagramma ER (testuale)

```
rooms (1) ─────────────────────────── (N) room_apparecchiature
  │  id, blocco, piano, room_code          room_id → rooms.id
  │  room_code_name, occupazione, ...      apparecchiatura, tipologia, ...
  │
  ├──────────────────────────────────── (N) room_impiantistica
  │                                        room_id → rooms.id
  │                                        tipologia, qta_presenti, ...
  │
  └──────────────────────────────────── (N) room_altre_dotazioni
                                           room_id → rooms.id
                                           altra_dotazione, presente, ...
```

---

## 5. Architettura applicativa

L'applicazione è una **SPA-like multi-pagina** (MPA) senza framework JavaScript. Ogni pagina è un file HTML con script JavaScript vanilla che comunica con le API PHP tramite `fetch()`.

```
Browser
│
├── index.html                (navigazione statica, nessuna chiamata API)
│
├── piani/planimetria.html    (richiede script.js)
│   │
│   ├── fetch: ../planimetrie/{piano}.svg
│   ├── fetch: ../planimetrie/occorenze-{piano}.json
│   ├── GET ../api/get-rooms-for-floor.php?blocco=&piano=
│   ├── GET ../api/get-room.php?blocco=&piano=&roomCode=
│   └── POST ../api/save-modal.php  (JSON body)
│
└── estrazioni.html           (richiede estrazioni.js)
    │
    ├── GET ../api/estrazioni.php?action=options&...
    ├── GET ../api/estrazioni.php?action=search&...
    └── GET ../api/estrazioni-export.php?...  (download XLSX)
```

---

## 6. Pagine frontend

### 6.1 `index.html` — Home page

Pagina di navigazione pura. Presenta una griglia con tutti i piani delle tre torri e degli interrati. Ogni link porta a `piani/planimetria.html?piano={blocco}-{N}`.

**Funzionalità:**
- Link rapido a Estrazioni
- Griglia Torre Sud (7 piani), Piastra Centrale (3 piani), Torre Nord (7 piani)
- Sezione Interrati (2 livelli)
- Nessuna chiamata API

---

### 6.2 `piani/planimetria.html` — Viewer planimetria

Pagina principale dell'applicazione. Riceve il parametro `?piano=blocco-N` dall'URL.

**Componenti visivi:**
- **Toolbar**: zoom −/+, reset, etichetta zoom corrente
- **Overlay loader**: mostrato durante il caricamento della mappa (min 2s artificiale)
- **Messaggio errore**: mostrato se SVG o dati non caricano
- **Area mappa**: elemento `<object>` che carica il file SVG; la classe `map-wrapper` gestisce lo zoom tramite `transform: scale()`
- **Modale stanza**: pannello laterale/centrale con tre sezioni (tab):
  - *Attributi stanza*: campi editabili inline (nome, occupazione, reparto, superficie, ecc.)
  - *Apparecchiature*: tabella dinamica con catalogo Tom Select e campi per ogni colonna
  - *Impiantistica*: tabella con template predefiniti (presa elettrica, gas medicali, rete dati, ecc.)
  - *Altre dotazioni*: tabella con template predefiniti (badge, videosorveglianza, ecc.)

**Comportamento SVG:**
- L'SVG viene caricato in un elemento `<object>`
- Al `load` dell'SVG, `script.js` accede al `contentDocument` e cerca elementi `<text>` il cui contenuto corrisponde al pattern `*CODICE*` (asterischi come delimitatori)
- Le stanze trovate nel DB vengono marcate con la classe CSS `room-present-in-db` (colore evidenziato)
- Le stanze con apparecchiatura "Monitor Centralizzato" vengono marcate con `room-centralized-monitor`
- Click su un elemento testo: estrae il `roomCode`, carica i dati e apre il modale

---

### 6.3 `estrazioni.html` — Filtri e export

Pagina di interrogazione e download dati.

**Filtri disponibili (a cascata):**
1. **Tipo**: Apparecchiature | Impiantistica | Altre dotazioni (radio button)
2. **Blocco**: Tom Select con le 4 sezioni
3. **Piano**: Tom Select, si aggiorna in base al blocco
4. **Reparto**: Tom Select, si aggiorna in base a blocco/piano
5. **ID Stanza**: Tom Select, si aggiorna in base al contesto
6. **Dettaglio**: Tom Select, valori DISTINCT dal DB per il tipo selezionato

**Azioni:**
- **Ricerca**: GET `api/estrazioni.php?action=search&...` → tabella risultati nel browser
- **Esporta Excel**: apre `api/estrazioni-export.php?...` → download XLSX

---

## 7. API backend

Tutte le API sono file PHP con `declare(strict_types=1)`, restituiscono JSON (tranne l'export) e gestiscono gli errori con codici HTTP appropriati.

### 7.1 `api/config.php`

Carica le variabili d'ambiente dal file `.env` del progetto (se non già impostate nell'ambiente del server). Restituisce un array di configurazione con `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.

---

### 7.2 `api/database.php`

Espone la funzione `getDatabaseConnection(): PDO`. Crea una connessione PDO a MySQL con:
- `PDO::ATTR_ERRMODE` → `ERRMODE_EXCEPTION`
- `PDO::ATTR_DEFAULT_FETCH_MODE` → `FETCH_ASSOC`
- `PDO::ATTR_EMULATE_PREPARES` → `false`
- Charset: `utf8mb4`

---

### 7.3 `api/get-rooms-for-floor.php`

**Metodo:** GET  
**Parametri:** `blocco`, `piano`  
**Risposta:**
```json
{
  "ok": true,
  "rooms": ["P6-010", "P6-011", ...],
  "centralizedMonitorRooms": ["P6-015", ...]
}
```

**Comportamento:**
- Restituisce la lista di `room_code` per il piano richiesto che hanno una riga in DB
- Identifica separatamente le stanze con un'apparecchiatura il cui nome normalizzato (senza spazi, trattini, underscore, punti, UPPER) corrisponde a `"MONITORCENTRALIZZATO"`
- Usato da `script.js` per evidenziare le stanze sull'SVG

---

### 7.4 `api/get-room.php`

**Metodo:** GET  
**Parametri:** `blocco`, `piano`, `roomCode`  
**Risposta (stanza non in DB):**
```json
{ "ok": true, "exists": false }
```
**Risposta (stanza in DB):**
```json
{
  "ok": true,
  "exists": true,
  "roomRef": { "blocco": "nord", "piano": "6", "roomCode": "P6-010" },
  "attributiStanza": {
    "roomCodeName": "Sala operatoria 1",
    "occupazione": "Sala operatoria",
    "reparto": "Chirurgia",
    "superficie": "45",
    "emipiano": "A",
    "accreditamentoLocale": "...",
    "postiLetto": null,
    "noteArrediSegnaletica": null
  },
  "apparecchiature": [...],
  "impiantistica": [...],
  "altreDotazioni": [...]
}
```

Il campo `inv` in ogni riga apparecchiatura viene normalizzato come array di stringhe uppercase.

---

### 7.5 `api/save-modal.php`

**Metodo:** POST (body JSON)  
**Content-Type:** `application/json`

**Payload base:**
```json
{
  "roomRef": { "blocco": "nord", "piano": "6", "roomCode": "P6-010" },
  "action": "saveField | saveApparecchiaturaRow | saveImpiantisticaRow | saveAltreDotazioniRow",
  "autoAttributes": { "roomCodeName": "...", "occupazione": "...", ... }
}
```

**Azioni disponibili:**

| `action` | Payload aggiuntivo | Comportamento |
|----------|-------------------|---------------|
| `saveField` | `fieldName`, `value` | Aggiorna un campo di `rooms`; crea la stanza se non esiste (solo se il valore è non vuoto) |
| `saveApparecchiaturaRow` | `row` (oggetto), `rowIndex` | DELETE riga per `sort_order`, poi INSERT se ha valori utili |
| `saveImpiantisticaRow` | `row` (oggetto), `rowIndex` | DELETE riga per `tipologia`, poi INSERT se ha valori utili |
| `saveAltreDotazioniRow` | `row` (oggetto), `rowIndex` | DELETE riga per `altra_dotazione`, poi INSERT se ha valori utili |

**Logica `autoAttributes`:** alla prima creazione della stanza (riga non ancora in DB), se i campi "auto" (roomCodeName, occupazione, superficie, emipiano, accreditamentoLocale, postiLetto, noteArrediSegnaletica) sono vuoti in DB, vengono popolati con i valori forniti da `autoAttributes` (dati provenienti dal JSON delle occorrenze).

**Risposta:**
```json
{ "ok": true, "action": "saveField", "roomId": 42, "skipped": false }
```

---

### 7.6 `api/estrazioni.php`

**Metodo:** GET  
**Parametro `action`:**

**`action=options`** — Restituisce le opzioni disponibili per i filtri a cascata:
```json
{
  "ok": true,
  "blocchi": [...],
  "piani": [...],
  "reparti": [...],
  "roomCodes": [...],
  "dettagli": [...]
}
```

**`action=search`** — Esegue la ricerca e restituisce le righe:
```json
{
  "ok": true,
  "tipo": "apparecchiature",
  "rows": [
    { "blocco": "nord", "piano": "6", "reparto": "...", "roomCode": "...", "apparecchiatura": "...", ... }
  ]
}
```

**Parametri filtro comuni:** `tipo`, `blocco`, `piano`, `reparto`, `room_code`, `dettaglio`

---

### 7.7 `api/estrazioni-export.php`

**Metodo:** GET  
**Parametri:** stessi di `estrazioni.php?action=search`  
**Risposta:** File XLSX scaricabile (Content-Disposition: attachment)

Usa `phpoffice/phpspreadsheet`. Richiede che `vendor/autoload.php` sia disponibile (dopo `composer install`). Se manca, il server risponde con errore 503.

**Headers colonne per tipo:**
- *Apparecchiature*: Blocco, Piano, Reparto, ID Stanza, Apparecchiatura, Tipologia, Produttore, Modello, Q.tà, Nuovo, Trasferimento, Inv., Note
- *Impiantistica*: Blocco, Piano, Reparto, ID Stanza, Tipologia impiantistica, Q.tà presenti, Q.tà da implementare, Note
- *Altre dotazioni*: Blocco, Piano, Reparto, ID Stanza, Altra dotazione, Presente, Da implementare, Note

---

### 7.8 `api/test-db.php`

**Metodo:** GET  
**Uso:** Health check. Verifica la connessione, mostra la versione MySQL, il nome del database corrente e le tabelle presenti. Confronta con le 4 tabelle attese. Da non esporre in produzione.

---

## 8. Flusso applicativo

### 8.1 Apertura planimetria

```
Utente clicca su "Piano 6 Nord" in index.html
  → Naviga a piani/planimetria.html?piano=nord-6
  → planimetria.html carica script.js
  → script.js legge il parametro piano dall'URL: "nord-6"
  → parseFloorContext("nord-6") → { blocco: "nord", piano: "6" }
  → In parallelo:
      1. fetch("../planimetrie/occorenze-nord-6.json")   → dati occorrenze
      2. fetch("../api/get-rooms-for-floor.php?blocco=nord&piano=6")  → stanze in DB
      3. mapObject.data = "../planimetrie/nord-6.svg"    → caricamento SVG
  → Quando tutti e tre completano:
      - Sul SVG: evidenzia stanze presenti in DB (classe room-present-in-db)
      - Sul SVG: evidenzia stanze con monitor centralizzato (classe room-centralized-monitor)
      - Nasconde il loader
```

### 8.2 Click su stanza

```
Utente clicca su elemento <text> "*P6-010*" nell'SVG
  → script.js cattura il click, estrae "P6-010"
  → Cerca "P6-010" nel JSON occorrenze → carica dati pianificazione
  → Apre il modale con i dati JSON pre-popolati nei campi
  → fetch("../api/get-room.php?blocco=nord&piano=6&roomCode=P6-010")
  → Se exists=true: merge dei dati DB nei campi (sovrascrive i dati JSON)
  → Se exists=false: i campi restano con i dati JSON (non ancora salvati in DB)
```

### 8.3 Salvataggio campo attributo

```
Utente modifica il campo "Nome stanza" (roomCodeName) e perde il focus
  → script.js intercetta l'evento blur
  → Costruisce payload:
      {
        roomRef: { blocco: "nord", piano: "6", roomCode: "P6-010" },
        action: "saveField",
        fieldName: "roomCodeName",
        value: "Sala operatoria 1",
        autoAttributes: { occupazione: "...", superficie: "...", ... }  // da JSON occorrenze
      }
  → POST ../api/save-modal.php
  → Se stanza non in DB: viene creata (ensureRoomExists) e gli autoAttributes vengono sincronizzati
  → Risposta { ok: true } → aggiorna UI
```

### 8.4 Salvataggio riga apparecchiatura

```
Utente modifica una cella nella tabella apparecchiature e perde il focus
  → script.js raccoglie tutti i campi della riga (rowIndex = indice DOM)
  → Costruisce payload:
      {
        roomRef: { ... },
        action: "saveApparecchiaturaRow",
        rowIndex: 2,
        row: { apparecchiatura: "Monitor", tipologia: "Fisso", ... }
      }
  → POST ../api/save-modal.php
  → Il server: DELETE WHERE room_id=? AND sort_order=2, poi INSERT se ha valori
```

### 8.5 Estrazioni

```
Utente seleziona filtri su estrazioni.html e clicca "Ricerca"
  → estrazioni.js costruisce URL con parametri filtro
  → GET ../api/estrazioni.php?action=search&tipo=apparecchiature&blocco=nord
  → Risposta JSON → rendering tabella nel browser

Utente clicca "Esporta Excel"
  → window.open("../api/estrazioni-export.php?tipo=apparecchiature&blocco=nord&...")
  → Il browser scarica il file XLSX
```

---

## 9. Configurazione e deploy

### 9.1 Variabili d'ambiente (`.env`)

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ospedale
DB_USER=utente_db
DB_PASS=password_sicura
```

> **Attenzione:** Non versionare mai il file `.env` reale. Aggiungere `.env` al `.gitignore`.

---

### 9.2 Deploy con Docker

```bash
# Clona il repository
git clone <url-repo>
cd ospedale

# Crea il file .env
cp .env.example .env
# Modifica .env con le credenziali reali

# Avvia lo stack
docker-compose up -d

# Installa le dipendenze PHP (per l'export Excel)
docker-compose exec web composer install

# Accedi all'applicazione
# App:        http://localhost:8000
# phpMyAdmin: http://localhost:8081
```

**Servizi Docker:**

| Servizio | Immagine | Porta | Descrizione |
|----------|----------|-------|-------------|
| `web` | `php:8.2-apache` (custom) | 8000 | Application server |
| `db` | `mysql:8.4` | 3306 (interno) | Database MySQL |
| `phpmyadmin` | `phpmyadmin/phpmyadmin` | 8081 | Admin DB UI |

Lo schema viene inizializzato automaticamente da `database/schema.sql` al primo avvio del container `db`.

---

### 9.3 Deploy manuale (senza Docker)

1. Requisiti: PHP 8.2+, MySQL 8.x, Apache/Nginx, Composer
2. Clona il repository nella document root del web server
3. Crea il database e importa `database/schema.sql`
4. Crea il file `.env` con le credenziali
5. Esegui `composer install` nella root del progetto
6. Configura il virtual host per puntare alla root del progetto
7. Assicurati che Apache/Nginx possa scrivere (se necessario) e leggere tutti i file

---

### 9.4 Asset planimetrie

I file SVG e JSON delle planimetrie devono essere posizionati nella cartella `planimetrie/`:

```
planimetrie/
├── nord-0.svg
├── nord-1.svg
├── ...
├── nord-6.svg
├── sud-0.svg
├── ...
├── piastra-0.svg
├── ...
├── sotterraneo-1.svg
├── sotterraneo-2.svg
├── occorenze-nord-0.json
├── occorenze-nord-1.json
├── ...
```

**Requisiti file SVG:**
- Devono contenere elementi `<text>` con il codice stanza nel formato `*CODICE*`
- Esempio: `<text>*P6-010*</text>` → viene riconosciuto da `script.js` come stanza cliccabile
- Devono avere un `viewBox` valido per funzionare correttamente con lo zoom

**Formato file JSON occorrenze:**
```json
[
  {
    "Codice semplificato": "P6-010",
    "Nome": "Sala operatoria 1",
    "Occupazione": "Sala operatoria",
    "Area": "45.2",
    "Emipiano": "A"
  },
  ...
]
```

---

## 10. Dipendenze esterne

### PHP (Composer)

| Pacchetto | Versione | Uso |
|-----------|----------|-----|
| `phpoffice/phpspreadsheet` | ~2.x | Generazione file XLSX per export |

Installazione: `composer install`

### JavaScript (CDN)

| Libreria | Uso | Pagine |
|----------|-----|--------|
| [Tom Select](https://tom-select.js.org/) | Select avanzate con ricerca | `planimetria.html`, `estrazioni.html` |
| [Tailwind CSS](https://tailwindcss.com/) | Utility CSS | Solo `index.html` |

---

## 11. Limitazioni note e sviluppi futuri

### Limitazioni attuali

| # | Limitazione | Impatto |
|---|-------------|---------|
| 1 | Nessun sistema di autenticazione | Chiunque raggiunga il server può leggere e modificare i dati |
| 2 | `.env` non escluso da git | Rischio esposizione credenziali se il repo è condiviso |
| 3 | Righe apparecchiature identificate per posizione DOM | Riordinamento o inserimento può corrompere dati |
| 4 | Nessun audit log | Non è tracciabile chi ha modificato cosa e quando |
| 5 | Nessuna migrazione database versionata | Impossibile aggiornare produzione in modo controllato |
| 6 | SVG non versionati nel repository | Il progetto non è autonomamente deployabile senza file esterni |
| 7 | Console.log attivi in produzione | Esposizione dati interni nella console del browser |
| 8 | Export Excel richiede Composer manuale | Può fallire silenziosamente se `vendor/` è assente |

### Sviluppi futuri consigliati

1. **Autenticazione con ruoli** (viewer / editor / admin)
2. **Audit log** su tabella dedicata con tracciamento utente, timestamp, payload prima/dopo
3. **Migrazioni database versionate** (Phinx o script shell)
4. **Test automatici** per le API critiche (PHPUnit + test di integrazione)
5. **Catalogo apparecchiature da database** anziché catalogo statico in `script.js`
6. **Notifiche in tempo reale** tra utenti simultanei (WebSocket o polling)
7. **Storico versioni per stanza** (possibilità di vedere e ripristinare versioni precedenti)
8. **Importazione massiva** da Excel/CSV per popolamento iniziale
9. **Ricerca full-text** su apparecchiature e note
10. **Dashboard riepilogativa** con statistiche per blocco/piano/reparto

---

*Documentazione generata il 27 aprile 2026. Per segnalare errori o aggiornamenti, aprire una issue nel repository.*
