#!/usr/bin/env bash
# Installs the guard hooks from .githooks/ and a snapshot of .agent/agents.yaml
# into the repository's shared hooks directory (.git/hooks, common to every
# worktree). Hooks run from there regardless of which branch is checked out,
# and a commit cannot edit the rules that judge it. Re-run after changing
# .githooks/ or agents.yaml; dispatch preflight checks the snapshot is current.
# usage: install-hooks.sh [--check]
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
HOOKS=$(cd "$(git rev-parse --git-common-dir)" && pwd)/hooks
FILES=(pre-commit pre-push)

if [ "$(git config --get core.hooksPath || true)" != "" ]; then
  echo "install-hooks: core.hooksPath is set ($(git config --get core.hooksPath)); unset it so .git/hooks is used." >&2
  exit 1
fi

if [ "${1:-}" = --check ]; then
  stale=0
  for f in "${FILES[@]}"; do cmp -s "$ROOT/.githooks/$f" "$HOOKS/$f" || { echo "install-hooks: $f is missing or stale" >&2; stale=1; }; done
  cmp -s "$ROOT/.agent/agents.yaml" "$HOOKS/agents.yaml" || { echo "install-hooks: agents.yaml snapshot is missing or stale" >&2; stale=1; }
  [ $stale = 0 ] && echo "install-hooks: installed hooks match this checkout"
  exit $stale
fi

mkdir -p "$HOOKS"
for f in "${FILES[@]}"; do
  install -m 0755 "$ROOT/.githooks/$f" "$HOOKS/$f"
done
install -m 0644 "$ROOT/.agent/agents.yaml" "$HOOKS/agents.yaml"
echo "install-hooks: installed ${FILES[*]} and agents.yaml into $HOOKS"
