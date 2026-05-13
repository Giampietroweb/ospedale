---
name: normalize-svg-planimetry
description: Normalize P{n} reference labels inside SVG floor plans (planimetrie) — aggregate split fragments, wrap codes with asterisks, apply the canonical text style, re-order P{n} nodes above all other content, recalibrate viewBox/letterboxing, and emit a closure report. Use only when the user explicitly invokes this skill to process a planimetry SVG (default project: `planimetrie/nord-{n}/nord-{n}.svg`, reference file: `planimetrie/nord-6/nord-6.svg`). Hybrid defaults — file path, label prefix, and reference file are all parameterizable.
disable-model-invocation: true
---

# Normalize SVG Planimetry — P{n} Reference Labels

Applica il flusso a 5 step descritto in `documentazione/lavorazione-planimetria-pX.md`
su qualsiasi SVG di planimetria. Il documento canonico resta la fonte di verità per
casi limite, esempi e troubleshooting esteso: questa skill ne è la versione operativa
e parametrizzata.

## Parametri della skill

Prima di iniziare, fissare con l'utente (o dedurre dal contesto) questi valori. Se
mancano, chiedere esplicitamente; non assumere silenziosamente.

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| `TARGET_SVG` | — (obbligatorio) | Path del file da lavorare, es. `planimetrie/nord-3/nord-3.svg`. |
| `LABEL` | derivato dal nome file: `nord-{n}` → `P{n}` | Prefisso delle referenze da normalizzare (es. `P3`, `P12`, oppure prefissi custom come `SUD2`). |
| `REFERENCE_SVG` | `planimetrie/nord-6/nord-6.svg` | File di riferimento già lavorato da cui mutuare struttura e stile. |
| `STYLE` | vedi sezione **Stile canonico** | Attributi da applicare ai nodi `<text>` delle referenze. |
| `MARGIN` | `20` unità SVG | Margine di sicurezza per il viewBox attorno al bounding box. |

> Se l'utente carica un SVG fuori da `planimetrie/`, `LABEL` va richiesto esplicitamente:
> non inferirlo dal path.

## Stile canonico (FASE C dello Step 3)

Tutti i nodi `<text>` di una referenza devono avere ESATTAMENTE questi attributi:

```
fill="#ff2a00"
font-weight="700"
stroke="#ffffff"
stroke-width="0.35"
paint-order="stroke fill"
font-size="1.4119788"
```

Attributi di posizione del nodo originale che NON vanno mai toccati:
`x`, `y`, `font-family`, `text-anchor`.

## Flusso operativo (5 step)

Eseguire gli step in ordine; ogni step ha il prompt esatto e i criteri di accettazione
documentati in `documentazione/lavorazione-planimetria-pX.md`. Qui sintetizziamo le
istruzioni minimali — leggere la doc per dettagli e prompt completi.

### Step 1 — Analisi del file di riferimento

Solo lettura su `REFERENCE_SVG`. Riportare:

- valore di `viewBox`;
- numero di nodi `<text>` con `LABEL`;
- formato dei codici (atteso `*{LABEL}-xxx-yyy*`);
- attributi di stile applicati;
- posizione dei nodi nel file (devono stare prima di `</svg>`);
- nessun frammento spezzato.

### Step 2 — Analisi del file target

Solo lettura su `TARGET_SVG`. Riportare i contatori:

1. `viewBox` corrente;
2. nodi `<text>` con `LABEL`;
3. nodi già in formato `*{LABEL}-...*`;
4. casi incompleti `*{LABEL}*` (senza codice);
5. frammenti spezzati su più nodi `<text>` contigui;
6. presenza dello stile canonico;
7. posizione dei nodi (sono già prima di `</svg>`?).

### Step 3 — Normalizzazione (formato + stile)

Patch puntuali, in ordine:

- **FASE A — Aggregazione**: se ci sono codici spezzati su più nodi `<text>` contigui,
  fonderli in un unico nodo `*{LABEL}-xxx-yyy*` mantenendo `x`, `y`, `font-family`,
  `text-anchor` del primo frammento. Rimuovere i nodi frammento. Mai produrre
  `*{LABEL}*` senza codice.
- **FASE B — Asterischi**: per ogni nodo che contiene `{LABEL}-...` ma non
  `*{LABEL}-...*`, aggiungere `*` all'inizio e alla fine del solo contenuto testuale.
  Nessun attributo va toccato.
- **FASE C — Stile**: applicare/correggere gli attributi della sezione
  **Stile canonico** sui soli nodi `<text>` `LABEL` che non li hanno.

Vincoli: niente modifiche a `<path>`, geometrie, immagini, layer (`<g>`), testi
non-`LABEL`. Niente riscritture globali del file: solo patch mirate.

Report di chiusura step: contatori per FASE A/B/C, 3 esempi post-modifica, residui
incompleti = 0.

### Step 4 — Z-order in fondo al file

I nodi `<text>` `*{LABEL}-...*` devono renderizzarsi sopra tutto: spostarli in
blocco subito prima di `</svg>`. Se sono già lì, non fare nulla e dichiararlo.

Vincoli: non riordinare altri blocchi, non modificare il contenuto dei nodi
`LABEL`, niente righe vuote extra.

Verifica: ultime 6 righe del file devono terminare con nodi `*{LABEL}-...*`
seguiti da `</svg>`.

### Step 5 — ViewBox, letterboxing, report finale

**FASE VIEWBOX**

1. Calcolare bounding box reale dal contenuto (coordinate dei `<text>` e dei
   `<path>` via attributo `d`).
2. Confrontare col `viewBox` corrente.
3. Se i margini differiscono significativamente da `MARGIN` (~20 unità):

   ```
   nuovo_viewBox = x_min-MARGIN  y_min-MARGIN  (x_max-x_min)+2*MARGIN  (y_max-y_min)+2*MARGIN
   ```

   Modificare SOLO l'attributo `viewBox` del tag `<svg>`. Se è già calibrato
   entro ±5 unità, lasciarlo invariato.

**FASE CANVAS — Rimozione bande vuote (letterboxing)**

Solo se in preview restano fasce trasparenti dopo il viewBox: significa che
`width/height` del tag `<svg>` ha un aspect ratio diverso da `vb_width/vb_height`.
Mantenere `width` invariato e ricalcolare:

```
height_nuovo = width × (vb_height / vb_width)
```

Arrotondare a 2 decimali (es. `577.88pt`). Modificare SOLO l'attributo `height`
(o, in alternativa, SOLO `width`) sulla riga del tag `<svg>` radice.

**REPORT FINALE OBBLIGATORIO**

- numero etichette `LABEL` trovate;
- numero frammenti aggregati;
- numero duplicati rimossi;
- numero casi incompleti residui (deve essere `0`);
- viewBox precedente → nuovo (o "invariato");
- `git diff --stat TARGET_SVG`;
- conferma testuale: «Nessuna modifica fuori da referenze/stile `LABEL`, viewBox
  e (se applicata) width/height del tag `<svg>` per rimozione letterboxing».

## Verifica finale automatizzata

Eseguire lo script di verifica con i parametri della sessione:

```
bash .cursor/skills/normalize-svg-planimetry/scripts/verify.sh <TARGET_SVG> <LABEL>
```

Lo script riproduce la checklist dello Step 5 e fallisce (exit code ≠ 0) se trova
problemi. Esempio:

```
bash .cursor/skills/normalize-svg-planimetry/scripts/verify.sh planimetrie/nord-3/nord-3.svg P3
```

## SVG > 8 MiB — regole tassative

Gli edit testuali che caricano l'intero file in memoria **troncano a 8.388.608 byte**,
distruggono il `</svg>` finale e cancellano i nodi `LABEL` collocati in coda.

- Modifica di **una riga sola** del tag `<svg>` radice (es. `viewBox`, `width`,
  `height`): usare `sed -i ''` mirato sulla riga 3, mai sull'intero file:

  ```
  sed -i '' '3s/height="OLD"/height="NEW"/' TARGET_SVG
  ```
- Modifiche **multiple** sui nodi `<text>` `LABEL`: script Python in streaming
  (riga per riga) o `sed` con più espressioni `-e`. **Mai** strumenti che
  riscrivono il file intero.
- Dopo ogni edit verificare in quest'ordine:
  1. `wc -c TARGET_SVG` (delta byte coerente);
  2. `tail -c 200 TARGET_SVG` (deve finire con `</svg>` preceduto da un nodo
     `<text>` `LABEL`);
  3. `git diff --stat TARGET_SVG` (numero righe modificate ≈ atteso);
  4. `grep -c "\\*${LABEL}-" TARGET_SVG` (conteggio invariato rispetto a prima).
- Se il file risulta troncato, recovery immediato:
  `git checkout HEAD -- TARGET_SVG` e ripetere con strategia streaming.

## Cosa NON toccare mai

- `<path>` e qualsiasi geometria;
- immagini embeddate (`<image>`);
- testi che non sono referenze `LABEL`;
- layer e gruppi (`<g>`);
- attributi globali del `<svg>` diversi da `viewBox`, e da `width`/`height` SOLO
  per allineare l'aspect del viewport al viewBox (FASE CANVAS);
- encoding, dichiarazione XML, DOCTYPE.

## Riferimenti

- Documento canonico con prompt completi per ogni step: `documentazione/lavorazione-planimetria-pX.md`
- File di riferimento: `planimetrie/nord-6/nord-6.svg`
- Script di verifica: `scripts/verify.sh`
