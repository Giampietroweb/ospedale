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

### 3.4 Aggregazione in stringa unica (automazione)

Dopo la delimitazione `*...*`, ogni etichetta spezzata su piu nodi `<text>` deve essere ricomposta in un solo nodo con stringa completa.

Pattern tipico in input (nodi separati):

- `*P6`
- `-`
- `191`
- `191` (duplicato grafico possibile)
- `-`
- `060*`

Output atteso:

- `*P6-191-060*` in un unico `<text>...</text>`

Regole operative:

- aggregare solo sequenze che iniziano con `*` e terminano con `*`
- preservare gli attributi grafici del primo nodo (`fill`, `font-size`, `stroke`, ecc.)
- se il token centrale e duplicato per resa grafica, mantenerne una sola copia nella stringa finale
- eliminare i nodi intermedi usati solo per comporre il codice
- processo idempotente: rieseguire la pipeline non deve creare duplicati o alterazioni progressive

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
  - aggregano i frammenti delimitati in una sola stringa per etichetta
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

5) Aggregazione automatica in stringa unica:
- dopo la delimitazione, ricomponi ogni codice spezzato in un solo nodo <text>
- se esistono duplicazioni del token centrale (es. 191 ripetuto), mantieni un solo token nella stringa finale
- esempio finale richiesto: *P6-191-060* in un unico <text>
- preserva stile e attributi del primo nodo ed elimina i nodi intermedi di composizione

6) Z-index equivalente in SVG:
- porta tutti i <text> evidenziati in fondo al file SVG per renderli sopra le linee

7) Viewer HTML:
- aggiorna/crea insex.html per mostrare la nuova SVG
- zoom di default 200%
- zoom +/- del 20%
- reset 100%
- centraggio iniziale e mantenimento del centro durante zoom in/out

8) Verifiche finali:
- controlla che non esistano casi senza delimitazione completa (*inizio e fine*)
- controlla che non esistano casi *P6* (senza blocchi successivi)
- controlla che non restino etichette P6 spezzate su più nodi consecutivi
- riporta un breve riepilogo numerico delle occorrenze trovate/modificate
```
///////////////////////////////////////////////////////////////////////////////

Lavora sul file SVG indicato e applica SOLO la logica delle referenze P6>>>>>>>cambia con numero piano, come fatto su `planimetrie/nord-6.svg`.
OBIETTIVO
1) Normalizzare tutte le referenze che iniziano con P6.
2) Evidenziarle con stile ad alta leggibilità.
3) Aggregare i codici P6 spezzati in più nodi `<text>`.
4) Portare i `<text>` P6 finali in fondo al file SVG, così vengono renderizzati sopra.
5) Ridurre lo spazio bianco sopra/sotto lavorando solo sul `viewBox`.
VINCOLI CRITICI
- NON copiare un vecchio SVG dentro quello nuovo.
- NON serializzare o riscrivere l’intero SVG.
- NON cambiare encoding, newline, spaziatura globale o ordine attributi non necessari.
- NON toccare `<path>`, geometrie, immagini embeddate, layer/gruppi, colori non-P6 o testi non-P6.
- Per la fase P6, modifica solo nodi `<text>` che compongono referenze P6.
- Per la fase viewBox, modifica solo l’attributo `viewBox` del tag `<svg>`.
LOGICA P6
- Riconosci tutte le varianti P6 numeriche e alfanumeriche:
  - `P6-191-060`
  - `P6-991-003`
  - `P6-E91-001`
  - `P6-C9M-113`
  - `P6-191-025b`
- Nel file i codici possono essere spezzati così:
  - `P6`
  - `-`
  - `191`
  - `191`
  - `-`
  - `060`
- Aggrega ogni sequenza in un unico `<text>`:
  - `*P6-191-060*`
- Se nella stessa etichetta c’è un token duplicato, mantienilo una sola volta.
- Non aggiungere nuove occorrenze logiche: lavora solo sui P6 già presenti nel nuovo file.
- Dopo l’aggregazione non devono rimanere P6 spezzati su più `<text>`.
- Non creare mai casi incompleti come `*P6*`.
STILE DA APPLICARE AI SOLI P6
Usa questo stile sul `<text>` finale aggregato:
- `fill="#ff2a00"`
- `font-weight="700"`
- `stroke="#ffffff"`
- `stroke-width="0.35"`
- `paint-order="stroke fill"`
- `font-size="1.4119788"`
Preserva gli attributi di posizione del primo nodo P6 originale, per esempio:
- `x`
- `y`
- `font-family`
- `text-anchor`
Z-ORDER SVG
- Rimuovi i frammenti originali usati per comporre il codice P6.
- Inserisci i `<text>` P6 aggregati e stilizzati subito prima di `</svg>`.
- Non riordinare altri blocchi.
VIEWBOX
Dopo la fase P6:
1) Calcola il bounding box reale del contenuto SVG.
2) Riduci lo spazio bianco sopra/sotto e, se utile, anche ai lati.
3) Applica un margine di sicurezza, ad esempio `20` unità.
4) Modifica solo il valore di `viewBox`.
5) Non modificare `width`, `height`, geometrie, path o testi.
METODO DI LAVORO
Prima di modificare:
- mostra il conteggio dei nodi `<text>` con P6;
- mostra quanti sono già nel formato `*P6...*`;
- mostra quanti casi incompleti `*P6*` esistono.
Poi:
- esegui patch minimali e mirate;
- evita rewrite totale del file;
- se usi uno script, deve fare sostituzioni puntuali sul testo esistente.
Dopo:
- mostra `git diff --stat`;
- verifica che:
  - tutte le etichette P6 siano aggregate;
  - tutti i P6 siano stilizzati;
  - non esistano casi `*P6*`;
  - non restino P6 spezzati;
  - il `viewBox` sia l’unico attributo globale modificato.
REPORT FINALE OBBLIGATORIO
Riporta:
- numero etichette P6 trovate;
- numero etichette aggregate;
- numero duplicati rimossi;
- numero casi `*P6*` incompleti, deve essere `0`;
- nuovo valore del `viewBox`;
- conferma esplicita: “Nessuna modifica fuori da referenze/stile P6 e viewBox”.
