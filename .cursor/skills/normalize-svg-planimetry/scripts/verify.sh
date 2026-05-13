#!/usr/bin/env bash
# Verifica di chiusura per la skill normalize-svg-planimetry.
#
# Replica la checklist dello Step 5 della documentazione:
#   documentazione/lavorazione-planimetria-pX.md
#
# Uso:
#   bash verify.sh <TARGET_SVG> <LABEL>
#
# Esempio:
#   bash verify.sh planimetrie/nord-3/nord-3.svg P3
#
# Exit codes:
#   0  → tutte le verifiche passate
#   1  → uso errato
#   2  → file mancante o non leggibile
#   3  → almeno una verifica fallita

set -u

usage() {
  cat >&2 <<EOF
Uso: bash $0 <TARGET_SVG> <LABEL>

  TARGET_SVG  Path al file SVG da verificare (es. planimetrie/nord-3/nord-3.svg)
  LABEL       Prefisso etichette (es. P3, P12, SUD2). Niente asterischi: solo il prefisso.
EOF
  exit 1
}

if [[ $# -ne 2 ]]; then
  usage
fi

TARGET_SVG="$1"
LABEL="$2"

if [[ -z "$TARGET_SVG" || -z "$LABEL" ]]; then
  usage
fi

if [[ ! -r "$TARGET_SVG" ]]; then
  echo "ERRORE: file non leggibile: $TARGET_SVG" >&2
  exit 2
fi

# Escape per uso in regex grep-base (basta gestire caratteri shell-meta tipici)
escape_for_grep() {
  printf '%s' "$1" | sed -e 's/[][\.^$*+?{}()|/]/\\&/g'
}

LABEL_RE=$(escape_for_grep "$LABEL")

pass_count=0
fail_count=0

check() {
  local description="$1"
  local status="$2"
  local detail="$3"
  if [[ "$status" -eq 0 ]]; then
    printf '  [OK]   %s\n' "$description"
    if [[ -n "$detail" ]]; then
      printf '         %s\n' "$detail"
    fi
    pass_count=$((pass_count + 1))
  else
    printf '  [FAIL] %s\n' "$description"
    if [[ -n "$detail" ]]; then
      printf '         %s\n' "$detail"
    fi
    fail_count=$((fail_count + 1))
  fi
}

echo "→ Verifica normalize-svg-planimetry"
echo "  target : $TARGET_SVG"
echo "  label  : $LABEL"
echo

# 1) Almeno una etichetta nel formato *LABEL-...*
asterisk_count=$(grep -c "\\*${LABEL_RE}-" "$TARGET_SVG" || true)
if [[ "$asterisk_count" -gt 0 ]]; then
  check "Sono presenti etichette *${LABEL}-...*" 0 "occorrenze: $asterisk_count"
else
  check "Sono presenti etichette *${LABEL}-...*" 1 "occorrenze: 0 — la normalizzazione non sembra applicata"
fi

# 2) Nessun nodo <text> con LABEL- senza asterischi (>LABEL-...< NON va bene)
naked_count=$(grep -c ">${LABEL_RE}-" "$TARGET_SVG" || true)
if [[ "$naked_count" -eq 0 ]]; then
  check "Nessun nodo >${LABEL}-...< senza asterischi" 0 ""
else
  check "Nessun nodo >${LABEL}-...< senza asterischi" 1 "trovati $naked_count nodi non normalizzati"
fi

# 3) Nessun caso incompleto *LABEL* senza codice
incomplete_count=$(grep -c ">\\*${LABEL_RE}\\*<" "$TARGET_SVG" || true)
if [[ "$incomplete_count" -eq 0 ]]; then
  check "Nessun caso incompleto >*${LABEL}*<" 0 ""
else
  check "Nessun caso incompleto >*${LABEL}*<" 1 "trovati $incomplete_count casi incompleti"
fi

# 4) Le ultime righe devono contenere un nodo *LABEL-...* prima di </svg>
tail_buffer=$(tail -n 8 "$TARGET_SVG")
last_label_line=$(printf '%s\n' "$tail_buffer" | grep -n "\\*${LABEL_RE}-" | tail -n 1 | cut -d: -f1 || true)
last_close_line=$(printf '%s\n' "$tail_buffer" | grep -n "</svg>" | tail -n 1 | cut -d: -f1 || true)
if [[ -n "$last_label_line" && -n "$last_close_line" && "$last_label_line" -lt "$last_close_line" ]]; then
  check "Z-order: ultimo nodo *${LABEL}-...* precede </svg>" 0 ""
else
  check "Z-order: ultimo nodo *${LABEL}-...* precede </svg>" 1 \
    "ultime righe del file (tail -n 8):"$'\n'"$tail_buffer"
fi

# 5) Il viewBox è presente nei primi righe del file (header <svg>)
header=$(head -n 5 "$TARGET_SVG")
if printf '%s' "$header" | grep -q "viewBox="; then
  viewbox_line=$(printf '%s\n' "$header" | grep -o 'viewBox="[^"]*"' | head -n 1)
  check "Attributo viewBox presente nell'header" 0 "$viewbox_line"
else
  check "Attributo viewBox presente nell'header" 1 "nessun viewBox trovato nelle prime 5 righe"
fi

# 6) Stile canonico applicato (controllo a campione: ogni nodo *LABEL-...* deve avere fill="#ff2a00")
#    Verifica conservativa: conta le righe *LABEL-...* e quante di queste contengono fill="#ff2a00".
total_label_lines=$(grep -c "\\*${LABEL_RE}-" "$TARGET_SVG" || true)
# Cerca occorrenze nelle stesse righe con fill canonico.
styled_label_lines=$(grep "\\*${LABEL_RE}-" "$TARGET_SVG" | grep -c 'fill="#ff2a00"' || true)
if [[ "$total_label_lines" -gt 0 && "$styled_label_lines" -eq "$total_label_lines" ]]; then
  check "Stile canonico (fill=#ff2a00) su tutti i nodi *${LABEL}-...*" 0 \
    "$styled_label_lines / $total_label_lines"
else
  check "Stile canonico (fill=#ff2a00) su tutti i nodi *${LABEL}-...*" 1 \
    "$styled_label_lines / $total_label_lines — alcuni nodi sono fuori dal range della riga o senza stile"
fi

# 7) Letterboxing: rapporto width/height ≈ vb_width/vb_height (tolleranza 0.01)
header_line=$(grep -n '<svg' "$TARGET_SVG" | head -n 1 | cut -d: -f1 || true)
if [[ -n "$header_line" ]]; then
  header_chunk=$(sed -n "${header_line},$((header_line + 4))p" "$TARGET_SVG")
  width_raw=$(printf '%s' "$header_chunk" | grep -o 'width="[^"]*"' | head -n 1 | sed -E 's/.*"([^"]*)".*/\1/')
  height_raw=$(printf '%s' "$header_chunk" | grep -o 'height="[^"]*"' | head -n 1 | sed -E 's/.*"([^"]*)".*/\1/')
  viewbox_raw=$(printf '%s' "$header_chunk" | grep -o 'viewBox="[^"]*"' | head -n 1 | sed -E 's/.*"([^"]*)".*/\1/')

    # Estrae il primo numero (gestisce suffissi pt/mm/px e separatore decimale
    # sia con punto sia con virgola — alcuni export CAD usano la virgola).
    num() {
      printf '%s' "$1" \
        | grep -oE '[0-9]+([.,][0-9]+)?' \
        | head -n 1 \
        | tr ',' '.'
    }
    width=$(num "$width_raw")
    height=$(num "$height_raw")
  vb_w=$(printf '%s' "$viewbox_raw" | awk '{print $3}')
  vb_h=$(printf '%s' "$viewbox_raw" | awk '{print $4}')

  if [[ -n "$width" && -n "$height" && -n "$vb_w" && -n "$vb_h" ]]; then
    ratio_diff=$(awk -v w="$width" -v h="$height" -v vw="$vb_w" -v vh="$vb_h" \
      'BEGIN { if (h == 0 || vh == 0) { print "NaN"; exit } d = (w / h) - (vw / vh); if (d < 0) d = -d; printf "%.4f", d }')
    if [[ "$ratio_diff" != "NaN" ]] && awk -v d="$ratio_diff" 'BEGIN { exit !(d <= 0.01) }'; then
      check "Aspect width/height allineato al viewBox (no letterboxing)" 0 \
        "width=$width_raw  height=$height_raw  vb=${vb_w}×${vb_h}  Δ=${ratio_diff}"
    else
      check "Aspect width/height allineato al viewBox (no letterboxing)" 1 \
        "width=$width_raw  height=$height_raw  vb=${vb_w}×${vb_h}  Δ=${ratio_diff} — possibili bande vuote in preview"
    fi
  else
    check "Aspect width/height allineato al viewBox (no letterboxing)" 1 \
      "impossibile estrarre width/height/viewBox dall'header"
  fi
else
  check "Aspect width/height allineato al viewBox (no letterboxing)" 1 \
    "tag <svg> non trovato"
fi

# 8) Dimensione file > 8 MiB → ricorda l'utente di usare strategia streaming sui prossimi edit
file_size=$(wc -c < "$TARGET_SVG" | tr -d ' ')
if [[ "$file_size" -gt 8388608 ]]; then
  echo
  echo "  [INFO] File > 8 MiB ($file_size byte). Per modifiche future usare sempre"
  echo "         sed in-place o script in streaming (vedi SKILL.md, sezione SVG > 8 MiB)."
fi

echo
echo "→ Riepilogo: $pass_count OK, $fail_count FAIL"

if [[ "$fail_count" -gt 0 ]]; then
  exit 3
fi
exit 0
