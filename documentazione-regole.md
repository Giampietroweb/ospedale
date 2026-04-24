# Documentazione Regole Applicate

Questo documento descrive le regole e le convenzioni applicate durante le modifiche a:

- `mappa.svg`
- `insex.html`

## 1) Regole di visualizzazione SVG (`mappa.svg`)

### 1.1 Ritaglio e inquadratura (viewBox)

Per ridurre gli spazi bianchi e rendere il contenuto piu visibile, e stato ristretto il `viewBox` ai soli contenuti utili.

Stato attuale:

- `viewBox="561 1212 1588 856"`

### 1.2 Rapporto viewport

Per ridurre lo spazio verticale sopra/sotto, `height` e stata allineata al rapporto del `viewBox`.

Stato attuale:

- `width="2834.64pt"`
- `height="1472.59pt"`

## 2) Regole di evidenziazione codici P6 (`mappa.svg`)

### 2.1 Pattern di codici considerati

Sono stati evidenziati i codici che iniziano con `P6`, inclusi casi:

- con blocchi alfanumerici separati da `-` (es. `P6-E91-003`)
- con sottoblocchi letterali (es. `P6-MLE-E93-002`)
- con parti numeriche/numeriche (es. `P6-191-060`)
- con coda alfanumerica (es. `P6191-014d`)

Nota: in SVG i codici possono essere spezzati in piu nodi `<text>`.

### 2.2 Stile grafico applicato ai codici evidenziati

Per aumentare leggibilita e contrasto:

- `fill="#ff2a00"`
- `font-weight="700"`
- `stroke="#ffffff"`
- `stroke-width="0.35"`
- `paint-order="stroke fill"`

### 2.3 Dimensione font

Le etichette evidenziate sono state uniformate e poi ridotte per evitare accavallamenti.

Regola finale:

- tutte le occorrenze evidenziate hanno `font-size` omogeneo rispetto alle trasformazioni applicate
- riduzione complessiva applicata del `40%` nell'ultima fase

### 2.4 Ordine di disegno (equivalente z-index)

In SVG non esiste `z-index` CSS come in HTML. Per mostrare i codici sopra le linee:

- i nodi `<text>` evidenziati sono stati spostati in fondo al file SVG
- in questo modo sono renderizzati per ultimi e visivamente sopra gli altri elementi

## 3) Regole di delimitazione con asterischi

### 3.1 Obiettivo

Delimitare ogni occorrenza completa con:

- asterisco iniziale `*`
- asterisco finale `*`

Formato logico atteso:

- `*P6-...-...*`

### 3.2 Regole operative

- mai chiudere un'occorrenza come `*P6*` se non sono presenti blocchi successivi
- includere sia codici alfanumerici che codici numerici (es. `P6-191-060`)
- quando il codice e spezzato in piu `<text>`, l'asterisco iniziale va sul primo frammento e quello finale sull'ultimo frammento
- in presenza di duplicazioni grafiche (token ripetuti in nodi separati), la delimitazione deve comunque coprire l'intera sequenza del codice visualizzato

### 3.3 Esempio pratico su nodi separati

Rappresentazione su piu nodi:

- `*P6`
- `-`
- `191`
- `191`
- `-`
- `060*`

Interpretazione visiva:

- `*P6-191-060*`

## 4) Regole del viewer HTML (`insex.html`)

### 4.1 Struttura e strumenti

La pagina include:

- visualizzazione di `mappa.svg`
- toolbar con `Zoom +`, `Zoom -`, `Reset 100%`
- indicatore percentuale zoom

### 4.2 Zoom di default

Valore corrente:

- `currentZoom = 2` (200%)

### 4.3 Step zoom

Incremento/decremento a click:

- `zoomStep = 0.2` (20%)

### 4.4 Comportamento zoom e centraggio

- lo zoom e applicato tramite `width/height` reali dell'immagine (non `transform: scale`)
- la viewport mantiene il centro durante zoom in/out
- al reset torna a `100%` e ricentra

## 5) Note manutentive

- Se in futuro compaiono nuove varianti di codice `P6`, aggiornare il pattern di riconoscimento mantenendo la regola `*...*`.
- Evitare sostituzioni manuali massive nel file SVG: preferire script idempotenti che:
  - rimuovono prima delimitatori/stili obsoleti
  - riapplicano regole in modo deterministico
- Dopo modifiche ai pattern, verificare almeno un caso per ciascun formato:
  - `P6-AAA-001`
  - `P6-191-060`
  - `P6191-014d`

## 6) Prompt pronto da incollare in chat

Copia e incolla questo prompt quando carichi una nuova SVG:

```text
Lavora su @NOME_FILE.svg e applica lo stesso workflow usato su mappa.svg.

Obiettivi:
1) Riduci gli spazi bianchi:
- analizza il contenuto reale dei path/text
- aggiorna il viewBox per inquadrare meglio il contenuto
- correggi width/height del tag <svg> in modo coerente con il rapporto del viewBox

2) Evidenzia tutti i codici che iniziano con P6:
- includi varianti alfanumeriche e numeriche (es: P6-E91-003, P6-MLE-E93-002, P6-191-060, P6191-014d)
- considera che i codici possono essere spezzati su più nodi <text>

3) Applica stile alta leggibilità ai codici evidenziati:
- fill="#ff2a00"
- font-weight="700"
- stroke="#ffffff"
- stroke-width="0.35"
- paint-order="stroke fill"
- uniforma il font-size di tutte le occorrenze evidenziate
- poi riduci il font-size del 40% per evitare accavallamenti (se necessario)

4) Delimitazione obbligatoria con asterischi:
- ogni occorrenza completa deve essere *...*
- mai creare *P6* da solo
- se il codice è spezzato su più <text>, metti * all’inizio del primo frammento e alla fine dell’ultimo
- assicurati che i pattern numerici (tipo P6-191-060) siano inclusi

5) Z-index equivalente in SVG:
- porta tutti i <text> evidenziati in fondo al file SVG per renderli sopra le linee

6) Viewer HTML:
- aggiorna/crea insex.html per mostrare la nuova SVG
- zoom di default 200%
- zoom +/- del 20%
- reset 100%
- centraggio iniziale e mantenimento del centro durante zoom in/out

7) Verifiche finali:
- controlla che non esistano casi senza delimitazione completa (*inizio e fine*)
- controlla che non esistano casi *P6* (senza blocchi successivi)
- riporta un breve riepilogo numerico delle occorrenze trovate/modificate
```
