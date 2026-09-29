#!/usr/bin/env bash
# Fails when .agent/STATE.md exceeds its line cap, so the lead condenses
# instead of appending. Run by dispatch preflight; safe to run by hand.
# usage: check-state.sh [path-to-STATE.md]
set -euo pipefail

CAP=150
ROOT=$(git rev-parse --show-toplevel)
FILE=${1:-"$ROOT/.agent/STATE.md"}

if [ ! -f "$FILE" ]; then
  echo "check-state: $FILE not found" >&2
  exit 1
fi

LINES=$(wc -l < "$FILE" | tr -d ' ')
if [ "$LINES" -gt "$CAP" ]; then
  echo "check-state: $FILE has $LINES lines (cap $CAP). Condense it: move narrative to .agent/journal/, rulings to DECISIONS.md." >&2
  exit 1
fi
echo "check-state: $FILE ok ($LINES/$CAP lines)"
