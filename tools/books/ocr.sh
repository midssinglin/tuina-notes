#!/bin/bash
# usage: ocr.sh <pdf> <outdir> <worker> <nworkers>
pdf="$1"; out="$2"; w="$3"; n="$4"; mkdir -p "$out"
N=$(pdfinfo "$pdf" | awk '/^Pages:/{print $2}')
tmp=$(mktemp -d)
for ((p=1+w; p<=N; p+=n)); do
  f=$(printf "%s/p%04d.txt" "$out" $p)
  [ -s "$f" ] && continue
  pdftoppm -r 200 -gray -f $p -l $p "$pdf" "$tmp/x" >/dev/null 2>&1
  img=$(ls $tmp/x*.pgm 2>/dev/null | head -1)
  [ -z "$img" ] && { echo "" > "$f"; continue; }
  OMP_THREAD_LIMIT=1 TESSDATA_PREFIX=/home/claude/ocr/tessfast tesseract "$img" - -l chi_tra+eng --psm 3 2>/dev/null > "$f.tmp" && mv "$f.tmp" "$f"
  rm -f $tmp/x*
done
rm -rf "$tmp"
