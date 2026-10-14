#!/bin/bash
# OCR every staged PDF, 2 workers, sequential books
D="/mnt/user-data/uploads/補充資料"
for name in "$@"; do
  pdf="$D/$name.pdf"; [ -f "$pdf" ] || { echo "missing $name"; continue; }
  out="/home/claude/ocr/txt/$name"
  bash /home/claude/ocr/scripts/ocr.sh "$pdf" "$out" 0 2 &
  bash /home/claude/ocr/scripts/ocr.sh "$pdf" "$out" 1 2 &
  wait; echo "done $name $(date +%T)"
done
