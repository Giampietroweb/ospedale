# Lavorazione Planimetrie SVG — Normalizzazione Referenze `P{n}`

Questo documento descrive il processo completo in **5 step** per normalizzare le referenze `P{n}` (es. `P2`, `P6`) in un file SVG di planimetria, replicando la struttura applicata su `nord-6.svg` a qualsiasi altro piano.

Ogni step include il **prompt esatto** da fornire all'agente AI, i **criteri di accettazione** e le **verifiche attese**.

---

## Contesto

Il flusso si applica ogni volta che si aggiunge o aggiorna una planimetria nella cartella `planimetrie/`. Il file di riferimento da cui mutuare la struttura è `planimetrie/nord-6/nord-6.svg`. Il file da lavorare segue il pattern `planimetrie/nord-{n}/nord-{n}.svg`.

---

## Step 1 — Analisi del file di riferimento

### Obiettivo

Capire la struttura finale attesa confrontando il file di riferimento già lavorato (`nord-6.svg`) con il file target da lavorare.

### Prompt

```
Analizza il file planimetrie/nord-6/nord-6.svg e mostrami:

1. Il valore del viewBox corrente.
2. Quanti nodi <text> contengono referenze P6.
3. Il formato esatto con cui le referenze P6 sono scritte nel contenuto testuale (es. *P6-191-060*).
4. Gli attributi di stile applicati ai nodi <text> P6 (fill, font-weight, stroke, stroke-width, paint-order, font-size).
5. La posizione dei nodi <text> P6 nel file: sono raggruppati prima di </svg>? Mostra le ultime 5 righe del file.
6. Esistono P6 spezzati su più nodi <text> o ogni nodo contiene un codice completo?

Non modificare nulla. Solo analisi e report.
```

### Criteri di accettazione

- L'agente restituisce il valore del viewBox.
- Mostra almeno 3 esempi di nodi `<text>` P6 nel formato `*P6-xxx-yyy*`.
- Conferma che i nodi P6 sono posizionati in fondo al file, prima di `</svg>`.
- Elenca tutti gli attributi di stile.

---

## Step 2 — Analisi del file target prima delle modifiche

### Obiettivo

Fotografare lo stato iniziale del file da lavorare per individuare cosa manca rispetto al file di riferimento: frammenti spezzati, stile assente, posizione errata, asterischi mancanti.

### Prompt

```
Analizza il file planimetrie/nord-{n}/nord-{n}.svg (sostituisci {n} con il numero del piano) e mostrami:

1. Il valore del viewBox corrente.
2. Quanti nodi <text> contengono la stringa "P{n}" (es. P2, P3...).
3. Quanti di questi nodi sono già nel formato *P{n}-...*  (con asterischi).
4. Quanti sono casi incompleti, cioè contengono solo *P{n}* senza il codice completo.
5. Ci sono nodi <text> con frammenti spezzati del codice (es. un nodo con solo "P{n}", uno con "-", uno con "191", ecc.)?
6. I nodi P{n} hanno già applicato lo stile corretto (fill="#ff2a00", font-weight="700", stroke="#ffffff", stroke-width="0.35", paint-order="stroke fill", font-size="1.4119788")?
7. I nodi P{n} sono già posizionati alla fine del file, subito prima di </svg>?

Non modificare nulla. Solo analisi e report numerico preciso.
```

### Criteri di accettazione

- L'agente restituisce i conteggi esatti per ogni punto.
- Il report indica chiaramente le differenze rispetto al file di riferimento.
- Nessuna modifica al file.

---

## Step 3 — Normalizzazione del formato e dello stile

### Obiettivo

Applicare le patch minime necessarie per portare ogni referenza `P{n}` al formato `*P{n}-xxx-yyy*` con lo stile corretto. Se i codici sono spezzati su più nodi, aggregarli prima.

### Prompt

```
Lavora sul file planimetrie/nord-{n}/nord-{n}.svg e applica le seguenti modifiche, in ordine:

FASE A — Aggregazione (solo se ci sono codici spezzati):
Se nel file esistono referenze P{n} distribuite su più nodi <text> contigui (es. un nodo con "P{n}", uno con "-", uno con "191", ecc.), aggregale in un unico <text> nel formato *P{n}-xxx-yyy*.
- Usa le coordinate x, y, font-family, text-anchor del primo frammento del gruppo.
- Rimuovi tutti i nodi frammento dopo l'aggregazione.
- Non creare casi incompleti come *P{n}*.

FASE B — Aggiunta asterischi (solo ai nodi senza asterischi):
Per ogni nodo <text> che contiene "P{n}-" ma non è ancora nel formato *P{n}-...*:
- Modifica solo il contenuto testuale aggiungendo * all'inizio e * alla fine.
- Esempio: P{n}-191-060 → *P{n}-191-060*
- Non toccare nessun attributo del nodo.

FASE C — Applicazione stile (solo ai nodi senza stile corretto):
Per ogni nodo <text> P{n} che non ha lo stile completo, aggiungi o correggi:
- fill="#ff2a00"
- font-weight="700"
- stroke="#ffffff"
- stroke-width="0.35"
- paint-order="stroke fill"
- font-size="1.4119788"

VINCOLI:
- Non modificare path, geometrie, immagini, layer, testi non-P{n}.
- Esegui solo patch puntuali: non riscrivere l'intero file.
- Non cambiare encoding, newline globali o ordine attributi non necessari.

Dopo le modifiche mostra:
- Quanti nodi sono stati aggiornati per fase (A, B, C).
- 3 esempi di nodi P{n} dopo la modifica.
- Conteggio dei casi incompleti rimanenti (deve essere 0).
```

### Criteri di accettazione

- Tutti i nodi P{n} sono nel formato `*P{n}-xxx-yyy*`.
- Tutti i nodi P{n} hanno lo stile completo.
- Nessun caso incompleto `*P{n}*`.
- Nessuna modifica a elementi non-P{n}.

---

## Step 4 — Verifica Z-order e riposizionamento in fondo al file

### Obiettivo

Garantire che tutti i nodi `<text>` P{n} siano renderizzati sopra gli altri elementi, spostandoli subito prima del tag di chiusura `</svg>`.

### Prompt

```
Lavora sul file planimetrie/nord-{n}/nord-{n}.svg e verifica la posizione dei nodi <text> P{n}:

1. I nodi <text> *P{n}-...* sono già tutti posizionati subito prima di </svg>?
   - Se SÌ: non fare nulla e riporta "Z-order già corretto".
   - Se NO: estrai tutti i nodi <text> *P{n}-...* dalla loro posizione attuale nel file
     e reinseriscili in blocco subito prima del tag </svg> di chiusura.

VINCOLI:
- Non riordinare o spostare nessun altro blocco del file.
- Non modificare il contenuto dei nodi P{n} (solo la posizione nel file).
- Non aggiungere righe vuote extra o modificare la spaziatura globale.
- Esegui la modifica con patch puntuale, non riscrivere l'intero file.

Dopo la verifica/modifica mostra:
- Conferma se i nodi erano già in posizione o se sono stati spostati.
- Le ultime 6 righe del file (devono terminare con nodi *P{n}-...* seguiti da </svg>).
- Numero totale di nodi P{n} ora in fondo al file.
```

### Criteri di accettazione

- L'ultima riga non vuota prima di `</svg>` è un nodo `<text>` con `*P{n}-...*`.
- Nessun nodo P{n} rimane in posizioni intermedie del file.
- Il resto del file è invariato.

---

## Step 5 — Calcolo viewBox e report finale

### Obiettivo

Ottimizzare il viewBox per ridurre lo spazio bianco sopra/sotto, poi produrre il report di chiusura lavorazione.

### Prompt

```
Lavora sul file planimetrie/nord-{n}/nord-{n}.svg per ottimizzare il viewBox ed emetti il report finale.

FASE VIEWBOX:
1. Calcola il bounding box reale del contenuto SVG:
   - Considera le coordinate x,y di tutti i nodi <text>.
   - Considera le coordinate dei path (attributo d="").
   - Prendi il minimo e il massimo per X e Y.
2. Confronta il bounding box reale con il viewBox corrente.
3. Se il viewBox corrente ha margini significativamente diversi da ~20 unità sui lati:
   - Calcola il nuovo viewBox: x_min-20, y_min-20, (x_max-x_min)+40, (y_max-y_min)+40
   - Modifica SOLO l'attributo viewBox del tag <svg>.
   - Non modificare width, height, geometrie, path o testi.
4. Se il viewBox corrente è già calibrato entro ±5 unità dal valore ottimale: lasciarlo invariato.

REPORT FINALE OBBLIGATORIO:
Riporta i seguenti valori:
- Numero etichette P{n} trovate nel file.
- Numero etichette aggregate (frammenti uniti).
- Numero duplicati rimossi.
- Numero casi *P{n}* incompleti (deve essere 0).
- ViewBox precedente e nuovo (o "invariato" se non modificato).
- Mostra git diff --stat del file.
- Conferma esplicita: "Nessuna modifica fuori da referenze/stile P{n} e viewBox".
```

### Criteri di accettazione

- Il viewBox è ottimale: contenuto visibile con margine ~20 unità.
- Il report numerico è completo e coerente.
- `git diff --stat` mostra le sole modifiche attese.
- La conferma esplicita è presente.

---

## Checklist finale di chiusura lavorazione

Prima di considerare il file pronto, verificare manualmente:

- [ ] `grep -c '\*P{n}' nord-{n}.svg` restituisce il numero atteso di etichette
- [ ] `grep '>P{n}-' nord-{n}.svg` restituisce 0 (nessun P{n} senza asterischi)
- [ ] `grep '>\*P{n}\*<' nord-{n}.svg` restituisce 0 (nessun caso incompleto)
- [ ] `tail -5 nord-{n}.svg` mostra nodi `*P{n}-...*` seguiti da `</svg>`
- [ ] `head -3 nord-{n}.svg | grep viewBox` mostra il viewBox aggiornato o invariato
- [ ] Il file apre correttamente nel browser o in un visualizzatore SVG

---

## Note operative

### File di riferimento
Il file di riferimento canonico è sempre `planimetrie/nord-6/nord-6.svg`. Prima di lavorare su un nuovo piano, leggere la struttura di nord-6 per allineare le aspettative.

### Stile P{n} standard
Lo stile da applicare a tutti i nodi `<text>` con referenze P{n} è sempre:

```
fill="#ff2a00"
font-weight="700"
stroke="#ffffff"
stroke-width="0.35"
paint-order="stroke fill"
font-size="1.4119788"
```

### Attributi di posizione da preservare
Gli attributi di posizione del nodo originale non devono mai essere modificati:

```
x, y, font-family, text-anchor
```

### Margine viewBox
Il margine di sicurezza standard attorno al bounding box del contenuto è **20 unità SVG**.

### Strategia di edit su file SVG > 8 MB
I file di planimetria possono superare i 20 MB. Gli strumenti di edit testuale che caricano l'intero file in memoria troncano il contenuto al limite di **8 MiB (8.388.608 byte)**, lasciando un SVG senza `</svg>` finale e con tutti i nodi `<text>` P{n} (collocati in fondo al file) persi.

#### Sintomi di troncamento
- `wc -c nord-{n}.svg` restituisce esattamente `8388608` o `8388610`.
- `tail -c 200 nord-{n}.svg` non contiene `</svg>` e finisce a metà di un attributo `d="..."`.
- `grep -c '\*P{n}-' nord-{n}.svg` restituisce 0 (tutti i P{n} sono in coda al file).
- La preview SVG nell'IDE/browser non si carica.

#### Strategia raccomandata
Per modifiche puntuali su SVG di grandi dimensioni usare sempre operazioni in streaming, mai edit che riscrivono l'intero file:

- **Modifica di un singolo attributo o riga** (es. `viewBox`, `height`, `width`): usare `sed` in-place. Su macOS:
  ```
  sed -i '' '3s/height="OLD"/height="NEW"/' planimetrie/nord-{n}/nord-{n}.svg
  ```
  Limitare il range alla riga esatta (`3s/.../.../`) per evitare match accidentali nel resto del file.
- **Modifiche multiple su nodi `<text>` P{n}**: script Python che legge e scrive in streaming (riga per riga), oppure `sed` con più espressioni `-e`.
- **Mai** eseguire un'operazione che ricarica e riscrive l'intero file.

#### Verifica post-modifica obbligatoria
Dopo ogni edit su un file > 8 MB, verificare in quest'ordine:

1. `wc -c nord-{n}.svg` — la dimensione deve essere coerente col delta atteso (es. `-1` byte se la nuova stringa è 1 carattere più corta).
2. `tail -c 200 nord-{n}.svg` — deve terminare con `</svg>` preceduto dall'ultimo nodo `<text>` P{n}.
3. `git diff --stat planimetrie/nord-{n}/nord-{n}.svg` — deve mostrare il numero esatto di righe modificate previste, non migliaia.
4. `grep -c '\*P{n}-' nord-{n}.svg` — il conteggio deve essere identico a prima della modifica.

#### Recovery in caso di troncamento
Se il file risulta troncato, ripristinare immediatamente dall'ultimo commit:
```
git checkout HEAD -- planimetrie/nord-{n}/nord-{n}.svg
```
Poi riapplicare la modifica con la strategia streaming descritta sopra.

### Cosa non toccare mai
- `<path>` e geometrie
- Immagini embeddate (es. `<image>`)
- Testi non-P{n}
- Layer e gruppi (`<g>`)
- Attributi globali del `<svg>` diversi da `viewBox`
- Encoding, dichiarazione XML, DOCTYPE
